import { describe, it, expect } from 'vitest';
import { serializeCircuit, deserializeCircuit } from '../core/serialization';
import minimalJson from './test-circuits/minimal.json';
import twoSourceJson from '../presets/two-source-ats.json';

describe('serialization', () => {
  it('round-trips minimal circuit', () => {
    const original = deserializeCircuit(JSON.stringify(minimalJson));
    const serialized = serializeCircuit(original);
    const restored = deserializeCircuit(serialized);

    expect(restored.name).toBe(original.name);
    expect(restored.components).toHaveLength(original.components.length);
    expect(restored.wires).toHaveLength(original.wires.length);
    expect(restored.components.map((c) => c.id)).toEqual(original.components.map((c) => c.id));
    expect(restored.wires.map((w) => w.id)).toEqual(original.wires.map((w) => w.id));
  });

  it('round-trips two-source preset', () => {
    const original = deserializeCircuit(JSON.stringify(twoSourceJson));
    const restored = deserializeCircuit(serializeCircuit(original));
    expect(restored.components).toHaveLength(original.components.length);
    expect(restored.wires).toHaveLength(original.wires.length);
    expect(restored.schemeSettings.transferMode).toBe(original.schemeSettings.transferMode);
    expect(restored.schemeSettings.preferredSourceId).toBe(original.schemeSettings.preferredSourceId);
  });

  it('throws on unsupported version', () => {
    expect(() => deserializeCircuit('{"version":"1.0","components":[],"wires":[]}')).toThrow();
  });

  it('preserves all scheme settings through round-trip', () => {
    const m = deserializeCircuit(JSON.stringify(twoSourceJson));
    const s = m.schemeSettings;
    const restored = deserializeCircuit(serializeCircuit(m));
    const rs = restored.schemeSettings;

    expect(rs.undervoltagePickup).toBe(s.undervoltagePickup);
    expect(rs.pickupDelay).toBe(s.pickupDelay);
    expect(rs.transferDelay).toBe(s.transferDelay);
    expect(rs.retransferDelay).toBe(s.retransferDelay);
    expect(rs.autoRetransfer).toBe(s.autoRetransfer);
    expect(rs.lockoutAfterN).toBe(s.lockoutAfterN);
  });
});
