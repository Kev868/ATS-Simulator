import { describe, it, expect } from 'vitest';
import { validateCircuit } from '../core/Validator';
import { deserializeCircuit } from '../core/serialization';
import minimalJson from './test-circuits/minimal.json';
import invalidWireJson from './test-circuits/invalid-wire.json';
import islandJson from './test-circuits/island.json';

describe('Validator', () => {
  it('minimal circuit is valid', () => {
    const m = deserializeCircuit(JSON.stringify(minimalJson));
    const report = validateCircuit(m);
    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it('invalid-wire circuit has error for missing port', () => {
    const m = deserializeCircuit(JSON.stringify(invalidWireJson));
    const report = validateCircuit(m);
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.code === 'WIRE_MISSING_TO_PORT')).toBe(true);
  });

  it('island circuit warns about isolated component', () => {
    const m = deserializeCircuit(JSON.stringify(islandJson));
    const report = validateCircuit(m);
    expect(report.warnings.some((w) => w.code === 'ISOLATED_COMPONENT')).toBe(true);
  });

  it('duplicate component IDs produce error', () => {
    const m = deserializeCircuit(JSON.stringify(minimalJson));
    const dup = { ...m.components[0] };
    m.components.push(dup);
    const report = validateCircuit(m);
    expect(report.errors.some((e) => e.code === 'DUPLICATE_COMPONENT_ID')).toBe(true);
  });

  it('circuit with no sources produces error', () => {
    const m = deserializeCircuit(JSON.stringify(minimalJson));
    m.components = m.components.filter((c) => c.type !== 'utility-source' && c.type !== 'generator-source');
    m.wires = m.wires.filter((w) => w.fromComponentId !== 's1' && w.toComponentId !== 's1');
    const report = validateCircuit(m);
    expect(report.errors.some((e) => e.code === 'NO_SOURCE')).toBe(true);
  });

  it('two-source preset is valid', async () => {
    const { default: json } = await import('../presets/two-source-ats.json');
    const m = deserializeCircuit(JSON.stringify(json));
    const report = validateCircuit(m);
    expect(report.errors).toHaveLength(0);
  });

  it('MTM preset is valid', async () => {
    const { default: json } = await import('../presets/main-tie-main.json');
    const m = deserializeCircuit(JSON.stringify(json));
    const report = validateCircuit(m);
    expect(report.errors).toHaveLength(0);
  });

  it('MMM preset is valid', async () => {
    const { default: json } = await import('../presets/main-main-main.json');
    const m = deserializeCircuit(JSON.stringify(json));
    const report = validateCircuit(m);
    expect(report.errors).toHaveLength(0);
  });
});
