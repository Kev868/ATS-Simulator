// ─── Topology Interpreter tests ───────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  interpretTopology,
  interpretTopologyJSON,
  detectSimPreset,
} from '../engine/TopologyInterpreter';
import {
  makeTwoSourceTopology,
  makeMTMTopology,
  makeMMMTopology,
} from '../engine/graphPresets';

// ─── 1. Preset round-trips through the interpreter ───────────────────────────

describe('interpretTopology — presets', () => {
  it('interprets TWO_SOURCE preset: correct component and wire counts', () => {
    const topo  = makeTwoSourceTopology();
    const model = interpretTopology(topo, 'preset');

    // 2 sources + 2 breakers + 1 bus + 1 load
    expect(model.components).toHaveLength(6);
    // 5 wires: w1-w5
    expect(model.wires).toHaveLength(5);
    expect(model.metadata.source).toBe('preset');
    expect(model.metadata.name).toBe('Two-Source ATS');
  });

  it('interprets MTM preset: correct component and wire counts', () => {
    const topo  = makeMTMTopology();
    const model = interpretTopology(topo, 'preset');

    // 2 sources + 3 breakers + 2 buses + 2 loads
    expect(model.components).toHaveLength(9);
    expect(model.wires).toHaveLength(8);
  });

  it('interprets MMM preset: correct component and wire counts', () => {
    const topo  = makeMMMTopology();
    const model = interpretTopology(topo, 'preset');

    // 3 sources + 4 breakers + 3 buses + 2 loads
    expect(model.components).toHaveLength(12);
    expect(model.wires).toHaveLength(11);
  });

  it('resolves port absolute positions from grid coords and offsets', () => {
    const topo  = makeTwoSourceTopology();
    const model = interpretTopology(topo, 'preset');

    // M1 source is at grid (1,5) with an 'out' port at dx=2.
    // Expected absX = (1 + 2) * 20 = 60, absY = 5 * 20 = 100
    const m1 = model.components.find(c => c.id === 'M1');
    expect(m1).toBeDefined();
    const outPort = m1!.ports.find(p => p.id === 'out');
    expect(outPort?.absX).toBe((1 + 2) * 20);  // 60
    expect(outPort?.absY).toBe(5 * 20);          // 100
  });

  it('computes wire segments between non-coincident port positions', () => {
    const topo  = makeTwoSourceTopology();
    const model = interpretTopology(topo, 'preset');

    // In the TWO_SOURCE preset, adjacent components are packed tightly so
    // many port endpoints coincide (zero-length wires → 0 segments is correct).
    // Wire w5 (BUS1.bot1 → LOAD1.top) has non-coincident endpoints and must
    // produce at least one segment.
    const w5 = model.wires.find(w => w.id === 'w5');
    expect(w5).toBeDefined();
    expect(w5!.segments.length).toBeGreaterThan(0);

    // Sanity: wires with coincident endpoints produce 0 segments (not an error)
    const coincident = model.wires.filter(
      w => Math.abs(w.fromPx - w.toPx) < 1 && Math.abs(w.fromPy - w.toPy) < 1,
    );
    for (const w of coincident) {
      expect(w.segments.length).toBe(0);
    }
  });

  it('computes energization: M1 source energizes BUS1 on TWO_SOURCE preset', () => {
    const topo  = makeTwoSourceTopology();
    const model = interpretTopology(topo, 'preset');

    // 52-M1 is CLOSED in the preset, so BUS1 should be energized from M1
    const bus = model.components.find(c => c.id === 'BUS1');
    expect(bus?.energization.energized).toBe(true);
    expect(bus?.energization.sourceId).toBe('M1');
  });

  it('carries metadata fields from the source topology', () => {
    const topo  = makeMTMTopology();
    const model = interpretTopology(topo, 'preset');

    expect(model.metadata.id).toBe('preset-mtm');
    expect(model.metadata.gridPx).toBe(20);
    expect(model.metadata.canvasW).toBe(50);
  });
});

// ─── 2. interpretTopologyJSON — JSON string input ─────────────────────────────

describe('interpretTopologyJSON', () => {
  it('round-trips a preset topology through JSON', () => {
    const topo   = makeTwoSourceTopology();
    const json   = JSON.stringify(topo);
    const result = interpretTopologyJSON(json, 'two-source.json');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { model } = result;
    expect(model.metadata.filename).toBe('two-source.json');
    expect(model.components).toHaveLength(6);
    expect(model.wires).toHaveLength(5);
    // Port absolute positions should be computed
    const m1 = model.components.find(c => c.id === 'M1');
    expect(m1?.ports[0].absX).toBeDefined();
  });

  it('returns ok:false with JSON error message for malformed JSON', () => {
    const result = interpretTopologyJSON('{ not valid json }}}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.toLowerCase().includes('json'))).toBe(true);
  });

  it('returns ok:false when required "components" field is missing', () => {
    const result = interpretTopologyJSON('{"id":"x","name":"y","wires":[]}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Should surface as either schema error or detection error
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('accepts partial topology (components only, no wires) with a warning', () => {
    const topo = makeTwoSourceTopology();
    const { wires: _wires, ...noWires } = topo;
    const result = interpretTopologyJSON(JSON.stringify(noWires));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Must warn about missing wires
    expect(result.model.warnings.some(w => w.includes('wires'))).toBe(true);
    expect(result.model.wires).toHaveLength(0);
  });

  it('rejects a completely unrecognizable JSON object with a descriptive error', () => {
    const result = interpretTopologyJSON('{"foo":1,"bar":2}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Error should explain what was expected
    expect(result.errors.some(e =>
      e.toLowerCase().includes('components') || e.toLowerCase().includes('topology'),
    )).toBe(true);
  });

  it('handles an unknown version field with a warning (not an error)', () => {
    const topo   = makeTwoSourceTopology();
    const result = interpretTopologyJSON(JSON.stringify({ ...topo, version: 99 }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.warnings.some(w => w.includes('version'))).toBe(true);
  });

  it('ignores extra unknown fields (forward-compatibility)', () => {
    const topo   = makeTwoSourceTopology();
    const result = interpretTopologyJSON(
      JSON.stringify({ ...topo, futureField: 'ignored', schemeSettings: { zoom: 2 } }),
    );
    expect(result.ok).toBe(true);
  });

  it('surfaces a specific validation error for a wire with a bad fromPortId', () => {
    const topo = makeTwoSourceTopology();
    const badWires = [{ ...topo.wires[0], fromPortId: 'no-such-port' }, ...topo.wires.slice(1)];
    const bad = { ...topo, wires: badWires };
    const result = interpretTopologyJSON(JSON.stringify(bad));

    // Schema validation should catch the bad port reference
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes('fromPortId') || e.includes('no-such-port'))).toBe(true);
  });

  it('does NOT silently fall back to a default topology on failure', () => {
    const result = interpretTopologyJSON('{}');
    expect(result.ok).toBe(false);
    // Confirm there is no .model on a failed result
    expect((result as Record<string, unknown>).model).toBeUndefined();
  });
});

// ─── 3. detectSimPreset ───────────────────────────────────────────────────────

describe('detectSimPreset', () => {
  it('detects TWO_SOURCE from a topology with no tie breakers', () => {
    const model = interpretTopology(makeTwoSourceTopology(), 'preset');
    expect(detectSimPreset(model)).toBe('TWO_SOURCE');
  });

  it('detects MTM from a topology with exactly one tie breaker', () => {
    const model = interpretTopology(makeMTMTopology(), 'preset');
    expect(detectSimPreset(model)).toBe('MTM');
  });

  it('detects MMM from a topology with two tie breakers', () => {
    const model = interpretTopology(makeMMMTopology(), 'preset');
    expect(detectSimPreset(model)).toBe('MMM');
  });

  it('detects MMM from a topology with a TERTIARY_SOURCE role', () => {
    const topo  = makeTwoSourceTopology();
    const withTertiary = {
      ...topo,
      components: topo.components.map((c, i) =>
        i === 0 ? { ...c, role: 'TERTIARY_SOURCE' as const } : c,
      ),
    };
    const model = interpretTopology(withTertiary, 'custom');
    expect(detectSimPreset(model)).toBe('MMM');
  });
});

// ─── 4. Connectivity and energization ────────────────────────────────────────

describe('connectivity and energization', () => {
  it('builds an adjacency graph with all components as keys', () => {
    const topo  = makeMTMTopology();
    const model = interpretTopology(topo, 'preset');

    for (const comp of topo.components) {
      expect(model.connectivity.adjacency.has(comp.id)).toBe(true);
    }
  });

  it('MTM preset: BUS-A is energized from M1, BUS-B is de-energized (tie OPEN)', () => {
    const topo  = makeMTMTopology();
    const model = interpretTopology(topo, 'preset');

    const busA = model.components.find(c => c.tag === 'BUS-A');
    const busB = model.components.find(c => c.tag === 'BUS-B');

    expect(busA?.energization.energized).toBe(true);
    expect(busA?.energization.sourceId).toBe('M1');

    expect(busB?.energization.energized).toBe(false);
  });

  it('wires connecting energized components of the same source are marked energized', () => {
    const topo  = makeTwoSourceTopology();
    const model = interpretTopology(topo, 'preset');

    // Wire w2 connects 52-M1 (right) to BUS1 (left).
    // 52-M1 is CLOSED, so both ends should be energized from M1.
    const w2 = model.wires.find(w => w.id === 'w2');
    expect(w2?.energized).toBe(true);
    expect(w2?.sourceId).toBe('M1');
  });
});
