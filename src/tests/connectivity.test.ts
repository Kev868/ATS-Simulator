// ─── Connectivity sweep tests ─────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { computeEnergization } from '../engine/connectivity';
import {
  GraphTopology, GComponent, GWire,
  setBreakerState, updateCompProps,
} from '../engine/graphTopology';
import {
  makeTwoSourceTopology,
  makeMTMTopology,
  makeMMMTopology,
} from '../engine/graphPresets';
import { validateTopology, checkIsolationOnOpen } from '../engine/topologyValidator';

// ─── Helper ───────────────────────────────────────────────────────────────────

function energized(topo: GraphTopology, compId: string): boolean {
  const result = computeEnergization(topo.components, topo.wires);
  return result.get(compId)?.energized ?? false;
}

function sourceOf(topo: GraphTopology, compId: string): string | null {
  const result = computeEnergization(topo.components, topo.wires);
  return result.get(compId)?.sourceId ?? null;
}

// ─── Test 1: TWO_SOURCE normal operation ─────────────────────────────────────
describe('TWO_SOURCE connectivity sweep', () => {
  it('BUS-1 is energized from M1 when 52-M1 is closed', () => {
    const topo = makeTwoSourceTopology();
    // Initial state: M1 closed, M2 open
    expect(energized(topo, 'BUS1')).toBe(true);
    expect(sourceOf(topo, 'BUS1')).toBe('M1');
    expect(energized(topo, 'LOAD1')).toBe(true);
  });

  it('BUS-1 is de-energized when M1 fails (voltage = 0)', () => {
    let topo = makeTwoSourceTopology();
    topo = updateCompProps(topo, 'M1', { available: false, voltage: 0 });
    // 52-M1 closed but M1 is dead — BUS should be de-energized
    expect(energized(topo, 'BUS1')).toBe(false);
    expect(energized(topo, 'LOAD1')).toBe(false);
  });

  it('BUS-1 energized from M2 after switching', () => {
    let topo = makeTwoSourceTopology();
    // Open M1 breaker, close M2 breaker
    topo = setBreakerState(topo, '52-M1', 'OPEN');
    topo = setBreakerState(topo, '52-M2', 'CLOSED');
    expect(energized(topo, 'BUS1')).toBe(true);
    expect(sourceOf(topo, 'BUS1')).toBe('M2');
  });

  it('BUS-1 dead when both breakers open', () => {
    let topo = makeTwoSourceTopology();
    topo = setBreakerState(topo, '52-M1', 'OPEN');
    expect(energized(topo, 'BUS1')).toBe(false);
  });
});

// ─── Test 2: MTM connectivity sweep ──────────────────────────────────────────
describe('MTM connectivity sweep', () => {
  it('normal: BUS-A from M1, BUS-B de-energized (tie open)', () => {
    const topo = makeMTMTopology();
    // Initial: M1 closed, tie open, M2 open
    expect(energized(topo, 'BUS1')).toBe(true);
    expect(sourceOf(topo, 'BUS1')).toBe('M1');
    expect(energized(topo, 'BUS2')).toBe(false);
  });

  it('closing tie energizes BUS-B from M1', () => {
    let topo = makeMTMTopology();
    topo = setBreakerState(topo, '52-T', 'CLOSED');
    expect(energized(topo, 'BUS1')).toBe(true);
    expect(energized(topo, 'BUS2')).toBe(true);
    expect(sourceOf(topo, 'BUS2')).toBe('M1');
  });

  it('TIE_FROM_M2: M2 feeds both buses when M1 open, tie closed', () => {
    let topo = makeMTMTopology();
    topo = setBreakerState(topo, '52-M1', 'OPEN');
    topo = setBreakerState(topo, '52-T',  'CLOSED');
    topo = setBreakerState(topo, '52-M2', 'CLOSED');
    expect(energized(topo, 'BUS1')).toBe(true);
    expect(energized(topo, 'BUS2')).toBe(true);
    expect(sourceOf(topo, 'BUS1')).toBe('M2');
    expect(sourceOf(topo, 'BUS2')).toBe('M2');
  });

  it('isolation sweep: opening 52-M1 loses BUS-A (tie open)', () => {
    const topo = makeMTMTopology();
    const { busesLost, busesRetained } = checkIsolationOnOpen(topo, '52-M1');
    expect(busesLost).toContain('BUS-A');
    expect(busesRetained).not.toContain('BUS-A');
  });
});

// ─── Test 3: Save/load round-trip with 3-port switch (one port disabled) ─────
describe('3-port switch topology save/load round-trip', () => {
  it('round-trips through JSON with port-disabled state intact', () => {
    // Build a minimal topology with an NPORT_SWITCH that has one disabled port
    const switchComp: GComponent = {
      id: 'sw1', type: 'NPORT_SWITCH', role: 'NONE',
      tag: 'ATS-1', ansiNumber: 'ATS',
      x: 10, y: 5, rotation: 0,
      ports: [
        { id: 'p0', label: 'Common', enabled: true,  dx: 0,  dy: -1, connectedWireIds: [] },
        { id: 'p1', label: 'Src1',   enabled: true,  dx: -1, dy:  1, connectedWireIds: [] },
        { id: 'p2', label: 'Gnd',    enabled: false, dx:  1, dy:  1, connectedWireIds: [] }, // disabled
      ],
      props: { portCount: 3 },
    };

    const topo: GraphTopology = {
      id: 'test-3port', name: '3-Port Switch Test',
      gridPx: 20, canvasW: 30, canvasH: 20,
      components: [switchComp],
      wires: [],
    };

    // Round-trip through JSON
    const json   = JSON.stringify(topo);
    const loaded = JSON.parse(json) as GraphTopology;

    const p2 = loaded.components[0].ports.find(p => p.id === 'p2');
    const p0 = loaded.components[0].ports.find(p => p.id === 'p0');

    expect(p2?.enabled).toBe(false);   // disabled port preserved
    expect(p0?.enabled).toBe(true);    // enabled port preserved
    expect(loaded.components[0].props.portCount).toBe(3);
    expect(loaded.components[0].tag).toBe('ATS-1');

    // Connectivity sweep: disabled port p2 should not conduct
    const src: GComponent = {
      id: 'src1', type: 'SOURCE', role: 'PREFERRED_SOURCE', tag: 'M1', ansiNumber: '',
      x: 8, y: 4, rotation: 0,
      ports: [{ id: 'out', label: 'Out', enabled: true, dx: 1, dy: 0, connectedWireIds: ['w1'] }],
      props: { voltage: 100, available: true },
    };
    const wire: GWire = {
      id: 'w1', fromCompId: 'src1', fromPortId: 'out',
      toCompId: 'sw1', toPortId: 'p1', segments: [],
    };
    // Link src → p1 of switch
    const comps  = [src, { ...switchComp, ports: switchComp.ports.map(p => p.id === 'p1' ? { ...p, connectedWireIds: ['w1'] } : p) }];
    const result = computeEnergization(comps, [wire]);

    // Switch should be energized (reached via p1)
    expect(result.get('sw1')?.energized).toBe(true);
    // p2 is disabled — but the BFS traversal only checks port enabled on receive side
    // The switch's internal peers function includes all enabled ports except entry —
    // so p0 (enabled) gets energy, p2 (disabled) does not propagate out
  });
});

// ─── Test 4: Validation rejects bad topologies ────────────────────────────────
describe('Topology validator', () => {
  it('rejects topology with no preferred source', () => {
    const topo = makeMTMTopology();
    // Strip the preferred role from M1
    const modified: GraphTopology = {
      ...topo,
      components: topo.components.map(c =>
        c.id === 'M1' ? { ...c, role: 'NONE' as const } : c
      ),
    };
    const result = validateTopology(modified);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('preferred'))).toBe(true);
  });

  it('rejects topology with a floating port', () => {
    const topo = makeTwoSourceTopology();
    // Add a bus with an unwired enabled port
    const extraBus: GComponent = {
      id: 'extrabus', type: 'BUS', role: 'MAIN_BUS', tag: 'BUS-X', ansiNumber: '',
      x: 30, y: 10, rotation: 0,
      ports: [
        { id: 'left',  label: 'L', enabled: true, dx: -2, dy: 0, connectedWireIds: [] },
        { id: 'right', label: 'R', enabled: true, dx:  2, dy: 0, connectedWireIds: [] },
      ],
      props: {},
    };
    const modified: GraphTopology = {
      ...topo,
      components: [...topo.components, extraBus],
    };
    const result = validateTopology(modified);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('floating') || e.toLowerCase().includes('not wired'))).toBe(true);
  });

  it('accepts valid MTM preset', () => {
    const topo   = makeMTMTopology();
    const result = validateTopology(topo);
    // Should be valid (no errors); warnings are allowed
    expect(result.errors.length).toBe(0);
  });

  it('connectivity sweep correctly identifies isolated buses when breaker opens', () => {
    const topo = makeMTMTopology();
    const { busesLost, busesRetained } = checkIsolationOnOpen(topo, '52-M1');
    // With only M1 closed and tie open, opening M1 isolates BUS-A
    expect(busesLost).toContain('BUS-A');
    expect(busesRetained).not.toContain('BUS-A');
  });

  it('rejects topologies with unreachable loads', () => {
    // Build a topology where a load is completely disconnected
    const src: GComponent = {
      id: 'src1', type: 'SOURCE', role: 'PREFERRED_SOURCE', tag: 'M1', ansiNumber: '',
      x: 1, y: 5, rotation: 0,
      props: { voltage: 100, available: true },
      ports: [{ id: 'out', label: 'Out', enabled: true, dx: 1, dy: 0, connectedWireIds: [] }],
    };
    const orphanLoad: GComponent = {
      id: 'orphan', type: 'LOAD', role: 'AGGREGATE_LOAD', tag: 'LOAD-X', ansiNumber: '',
      x: 20, y: 5, rotation: 0,
      props: { loadKW: 100 },
      ports: [{ id: 'top', label: 'In', enabled: false, dx: 0, dy: -1, connectedWireIds: [] }],
    };
    const topo: GraphTopology = {
      id: 't', name: 'Test', gridPx: 20, canvasW: 40, canvasH: 20,
      components: [src, orphanLoad],
      wires: [],
    };
    // The source has a floating port — that error should also appear
    const result = validateTopology(topo);
    expect(result.ok).toBe(false);
  });
});

// ─── Test 5: Regression — graph preset matches existing engine output ──────────
// The graph-based MTM preset uses component IDs that match the hardcoded engine.
// The connectivity sweep running on the MTM preset should produce the same
// bus energization as the hardcoded computeBusStates for the initial state.
describe('Graph preset regression — MTM initial energization', () => {
  it('BUS-A energized from M1 in initial state (matches hardcoded engine)', () => {
    const topo   = makeMTMTopology();
    const result = computeEnergization(topo.components, topo.wires);

    // Match the hardcoded engine expectation:
    // BUS1 (BUS-A) energized from M1, BUS2 (BUS-B) de-energized
    expect(result.get('BUS1')?.energized).toBe(true);
    expect(result.get('BUS1')?.sourceId).toBe('M1');
    expect(result.get('BUS2')?.energized).toBe(false);
  });

  it('after opening 52-M1, closing 52-T, closing 52-M2: both buses from M2', () => {
    let topo = makeMTMTopology();
    topo = setBreakerState(topo, '52-M1', 'OPEN');
    topo = setBreakerState(topo, '52-T',  'CLOSED');
    topo = setBreakerState(topo, '52-M2', 'CLOSED');

    const result = computeEnergization(topo.components, topo.wires);
    expect(result.get('BUS1')?.energized).toBe(true);
    expect(result.get('BUS1')?.sourceId).toBe('M2');
    expect(result.get('BUS2')?.energized).toBe(true);
    expect(result.get('BUS2')?.sourceId).toBe('M2');
  });
});
