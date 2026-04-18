import { describe, it, expect } from 'vitest';
import { applyEnergization } from '../core/EnergizationSolver';
import { deserializeCircuit } from '../core/serialization';
import minimalJson from './test-circuits/minimal.json';
import twoSourceJson from '../presets/two-source-ats.json';
import mtmJson from '../presets/main-tie-main.json';

describe('EnergizationSolver — minimal', () => {
  it('all components energized when source live and breaker closed', () => {
    const m = deserializeCircuit(JSON.stringify(minimalJson));
    applyEnergization(m);
    expect(m.components.find((c) => c.id === 's1')!.state.energized).toBe(true);
    expect(m.components.find((c) => c.id === 'b1')!.state.energized).toBe(true);
    expect(m.components.find((c) => c.id === 'bus1')!.state.energized).toBe(true);
    expect(m.components.find((c) => c.id === 'l1')!.state.energized).toBe(true);
  });

  it('nothing energized when source failed', () => {
    const m = deserializeCircuit(JSON.stringify(minimalJson));
    m.components.find((c) => c.id === 's1')!.state.failed = true;
    applyEnergization(m);
    for (const comp of m.components) {
      expect(comp.state.energized).toBe(false);
    }
  });

  it('bus and load de-energized when breaker open', () => {
    const m = deserializeCircuit(JSON.stringify(minimalJson));
    m.components.find((c) => c.id === 'b1')!.state.closed = false;
    applyEnergization(m);
    expect(m.components.find((c) => c.id === 's1')!.state.energized).toBe(true);
    // b1 is reachable from s1 through wire to line port, but load side is cut
    expect(m.components.find((c) => c.id === 'bus1')!.state.energized).toBe(false);
    expect(m.components.find((c) => c.id === 'l1')!.state.energized).toBe(false);
  });
});

describe('EnergizationSolver — two-source ATS', () => {
  it('bus energized from M1 when M1 main breaker closed, M2 breaker open', () => {
    const m = deserializeCircuit(JSON.stringify(twoSourceJson));
    applyEnergization(m);
    // 52-M1 is closed, 52-M2 is open by default
    expect(m.components.find((c) => c.id === 'bus1')!.state.energized).toBe(true);
    expect(m.components.find((c) => c.id === 'm1')!.state.energized).toBe(true);
    expect(m.components.find((c) => c.id === 'load1')!.state.energized).toBe(true);
  });

  it('bus stays energized when M1 fails (M2 breaker closed)', () => {
    const m = deserializeCircuit(JSON.stringify(twoSourceJson));
    m.components.find((c) => c.id === 'm1')!.state.failed = true;
    m.components.find((c) => c.id === 'b52m2')!.state.closed = true;
    applyEnergization(m);
    expect(m.components.find((c) => c.id === 'bus1')!.state.energized).toBe(true);
  });

  it('bus de-energized when both sources fail', () => {
    const m = deserializeCircuit(JSON.stringify(twoSourceJson));
    m.components.find((c) => c.id === 'm1')!.state.failed = true;
    m.components.find((c) => c.id === 'm2')!.state.failed = true;
    applyEnergization(m);
    expect(m.components.find((c) => c.id === 'bus1')!.state.energized).toBe(false);
  });

  it('bus re-energizes when M2 restored', () => {
    const m = deserializeCircuit(JSON.stringify(twoSourceJson));
    m.components.find((c) => c.id === 'm1')!.state.failed = true;
    m.components.find((c) => c.id === 'b52m1')!.state.closed = false;
    m.components.find((c) => c.id === 'b52m2')!.state.closed = true;
    applyEnergization(m);
    expect(m.components.find((c) => c.id === 'bus1')!.state.energized).toBe(true);
  });
});

describe('EnergizationSolver — MTM', () => {
  it('BUS-1 energized from M1 and BUS-2 from M2 when tie open', () => {
    const m = deserializeCircuit(JSON.stringify(mtmJson));
    applyEnergization(m);
    expect(m.components.find((c) => c.id === 'bus1')!.state.energized).toBe(true);
    expect(m.components.find((c) => c.id === 'bus2')!.state.energized).toBe(true);
  });

  it('BUS-1 de-energizes when 52-M1 opens', () => {
    const m = deserializeCircuit(JSON.stringify(mtmJson));
    m.components.find((c) => c.id === 'b52m1')!.state.closed = false;
    applyEnergization(m);
    expect(m.components.find((c) => c.id === 'bus1')!.state.energized).toBe(false);
    expect(m.components.find((c) => c.id === 'bus2')!.state.energized).toBe(true);
  });

  it('BUS-1 re-energizes via tie when 52-M1 open, tie closed', () => {
    const m = deserializeCircuit(JSON.stringify(mtmJson));
    m.components.find((c) => c.id === 'b52m1')!.state.closed = false;
    m.components.find((c) => c.id === 'b52tie')!.state.closed = true;
    applyEnergization(m);
    expect(m.components.find((c) => c.id === 'bus1')!.state.energized).toBe(true);
  });

  it('both buses de-energized when both sources fail', () => {
    const m = deserializeCircuit(JSON.stringify(mtmJson));
    m.components.find((c) => c.id === 'm1')!.state.failed = true;
    m.components.find((c) => c.id === 'm2')!.state.failed = true;
    applyEnergization(m);
    expect(m.components.find((c) => c.id === 'bus1')!.state.energized).toBe(false);
    expect(m.components.find((c) => c.id === 'bus2')!.state.energized).toBe(false);
  });
});
