// ─── Schema validation + coercion tests ───────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { validateSchema, coerceTopology, parseTopologyJSON } from '../engine/topoSchema';
import { GraphTopology } from '../engine/graphTopology';

// ─── Minimal valid fixture ────────────────────────────────────────────────────

const MINIMAL: GraphTopology = {
  id:         'test-minimal',
  name:       'Minimal Topology',
  gridPx:     20,
  canvasW:    30,
  canvasH:    20,
  components: [
    {
      id:         'SRC1',
      type:       'SOURCE',
      role:       'PREFERRED_SOURCE',
      tag:        'UTIL-1',
      ansiNumber: '',
      x:          3,  y: 8,
      rotation:   0,
      ports: [{ id: 'out', label: 'Out', enabled: true, dx: 1, dy: 0, connectedWireIds: ['w1'] }],
      props: { sourceType: 'UTILITY', nominalVoltage: 13.8, nominalFrequency: 60,
               voltage: 100, frequency: 60, phaseAngle: 0, available: true },
    },
    {
      id:         'BRK1',
      type:       'BREAKER',
      role:       'SOURCE_BREAKER',
      tag:        '52-1',
      ansiNumber: '52',
      x:          7,  y: 8,
      rotation:   0,
      ports: [
        { id: 'left',  label: 'L', enabled: true,  dx: -1, dy: 0, connectedWireIds: ['w1'] },
        { id: 'right', label: 'R', enabled: true,   dx:  1, dy: 0, connectedWireIds: [] },
      ],
      props: { breakerState: 'CLOSED', operationTimeMs: 50, lockedOut: false, elapsed: 0 },
    },
  ],
  wires: [
    {
      id:         'w1',
      fromCompId: 'SRC1', fromPortId: 'out',
      toCompId:   'BRK1', toPortId:   'left',
      segments:   [{ x1: 4, y1: 8, x2: 6, y2: 8 }],
    },
  ],
};

// ─── validateSchema ───────────────────────────────────────────────────────────

describe('validateSchema', () => {
  it('accepts a valid minimal topology', () => {
    const r = validateSchema(MINIMAL);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('rejects null', () => {
    const r = validateSchema(null);
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('rejects an array', () => {
    const r = validateSchema([]);
    expect(r.ok).toBe(false);
  });

  it('rejects missing "id" field', () => {
    const bad = { ...MINIMAL, id: undefined };
    const r = validateSchema(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('"id"'))).toBe(true);
  });

  it('rejects missing "name" field', () => {
    const bad = { ...MINIMAL, name: '' };
    const r = validateSchema(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('"name"'))).toBe(true);
  });

  it('rejects missing "components" field', () => {
    const { components: _, ...bad } = MINIMAL;
    const r = validateSchema(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('"components"'))).toBe(true);
  });

  it('rejects missing "wires" field', () => {
    const { wires: _, ...bad } = MINIMAL;
    const r = validateSchema(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('"wires"'))).toBe(true);
  });

  it('rejects component with invalid type', () => {
    const bad = {
      ...MINIMAL,
      components: [{ ...MINIMAL.components[0], type: 'WIDGET' }],
    };
    const r = validateSchema(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('type') && e.includes('WIDGET'))).toBe(true);
  });

  it('rejects duplicate component ids', () => {
    const bad = {
      ...MINIMAL,
      components: [MINIMAL.components[0], { ...MINIMAL.components[1], id: 'SRC1' }],
    };
    const r = validateSchema(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('Duplicate component id'))).toBe(true);
  });

  it('rejects duplicate wire ids', () => {
    const bad = {
      ...MINIMAL,
      wires: [MINIMAL.wires[0], { ...MINIMAL.wires[0] }],
    };
    const r = validateSchema(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('Duplicate wire id'))).toBe(true);
  });

  it('rejects wire fromCompId that does not match any component', () => {
    const bad = {
      ...MINIMAL,
      wires: [{ ...MINIMAL.wires[0], fromCompId: 'NONEXISTENT' }],
    };
    const r = validateSchema(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('fromCompId') && e.includes('NONEXISTENT'))).toBe(true);
  });

  it('rejects wire fromPortId that does not exist on the referenced component', () => {
    const bad = {
      ...MINIMAL,
      wires: [{ ...MINIMAL.wires[0], fromPortId: 'no-such-port' }],
    };
    const r = validateSchema(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('fromPortId') && e.includes('no-such-port'))).toBe(true);
  });

  it('ignores unknown extra fields (forward-compatibility)', () => {
    const withExtra = { ...MINIMAL, futureField: 'ignored', components: MINIMAL.components.map(c => ({ ...c, unknownProp: 42 })) };
    const r = validateSchema(withExtra);
    expect(r.ok).toBe(true);
  });

  it('names the specific missing field in the error message', () => {
    const bad = { ...MINIMAL, components: [{ ...MINIMAL.components[0], x: 'not-a-number' }] };
    const r = validateSchema(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes('"x"'))).toBe(true);
  });
});

// ─── coerceTopology ───────────────────────────────────────────────────────────

describe('coerceTopology', () => {
  it('fills missing optional gridPx with 20', () => {
    const raw = { ...MINIMAL };
    delete (raw as Record<string, unknown>).gridPx;
    const t = coerceTopology(raw);
    expect(t.gridPx).toBe(20);
  });

  it('fills missing optional canvasW with 60', () => {
    const raw = { ...MINIMAL };
    delete (raw as Record<string, unknown>).canvasW;
    const t = coerceTopology(raw);
    expect(t.canvasW).toBe(60);
  });

  it('fills missing component rotation with 0', () => {
    const raw = { ...MINIMAL, components: [{ ...MINIMAL.components[0], rotation: undefined }] };
    const t = coerceTopology(raw);
    expect(t.components[0].rotation).toBe(0);
  });

  it('fills missing component tag with the component id', () => {
    const raw = { ...MINIMAL, components: [{ ...MINIMAL.components[0], tag: undefined }] };
    const t = coerceTopology(raw);
    expect(t.components[0].tag).toBe('SRC1');
  });

  it('fills missing port label with the port id', () => {
    const raw = {
      ...MINIMAL,
      components: [{
        ...MINIMAL.components[0],
        ports: [{ ...MINIMAL.components[0].ports[0], label: undefined }],
      }],
    };
    const t = coerceTopology(raw);
    expect(t.components[0].ports[0].label).toBe('out');
  });

  it('defaults port enabled to true when missing', () => {
    const raw = {
      ...MINIMAL,
      components: [{
        ...MINIMAL.components[0],
        ports: [{ ...MINIMAL.components[0].ports[0], enabled: undefined }],
      }],
    };
    const t = coerceTopology(raw);
    expect(t.components[0].ports[0].enabled).toBe(true);
  });

  it('defaults wire segments to [] when missing', () => {
    const raw = { ...MINIMAL, wires: [{ ...MINIMAL.wires[0], segments: undefined }] };
    const t = coerceTopology(raw);
    expect(t.wires[0].segments).toEqual([]);
  });
});

// ─── parseTopologyJSON — round-trip ───────────────────────────────────────────

describe('parseTopologyJSON', () => {
  it('round-trips a valid topology through JSON', () => {
    const json   = JSON.stringify(MINIMAL);
    const result = parseTopologyJSON(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.topo.id).toBe(MINIMAL.id);
    expect(result.topo.components).toHaveLength(MINIMAL.components.length);
    expect(result.topo.wires).toHaveLength(MINIMAL.wires.length);
    expect(result.topo.components[0].id).toBe('SRC1');
    expect(result.topo.wires[0].id).toBe('w1');
  });

  it('returns { ok: false } for malformed JSON', () => {
    const result = parseTopologyJSON('{ not valid json }}}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.toLowerCase().includes('json'))).toBe(true);
  });

  it('returns { ok: false } for JSON missing required fields', () => {
    const result = parseTopologyJSON('{"name": "missing components"}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes('"components"'))).toBe(true);
  });

  it('does NOT silently fall back to a default topology on failure', () => {
    const result = parseTopologyJSON('{}');
    expect(result.ok).toBe(false);
    // Confirm there is no .topo on a failed result
    expect((result as Record<string, unknown>).topo).toBeUndefined();
  });

  it('succeeds and ignores unknown extra fields', () => {
    const withExtra = { ...MINIMAL, schemeSettings: { foo: 1 }, viewport: { zoom: 2 } };
    const result = parseTopologyJSON(JSON.stringify(withExtra));
    expect(result.ok).toBe(true);
  });

  it('preserves all component fields in round-trip', () => {
    const result = parseTopologyJSON(JSON.stringify(MINIMAL));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const c = result.topo.components[0];
    expect(c.type).toBe('SOURCE');
    expect(c.role).toBe('PREFERRED_SOURCE');
    expect(c.x).toBe(3);
    expect(c.ports[0].dx).toBe(1);
    expect(c.props.voltage).toBe(100);
  });

  it('preserves wire segments in round-trip', () => {
    const result = parseTopologyJSON(JSON.stringify(MINIMAL));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const seg = result.topo.wires[0].segments[0];
    expect(seg.x1).toBe(4);
    expect(seg.y1).toBe(8);
    expect(seg.x2).toBe(6);
    expect(seg.y2).toBe(8);
  });
});
