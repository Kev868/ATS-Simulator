// ─── Topology JSON schema validation + coercion ───────────────────────────────
//
// Two-phase approach:
//   validateSchema(obj)  — structural check; returns errors for required fields.
//                          Unknown extra fields are silently ignored (forward-compat).
//   coerceTopology(obj)  — fills missing optional fields with documented defaults.
//                          Only call this AFTER validateSchema reports ok.
//
// Required fields (reject if missing):
//   top-level : id, name, components[], wires[]
//   component : id, type, x, y, ports[], props
//   port      : id, dx, dy
//   wire      : id, fromCompId, fromPortId, toCompId, toPortId
//
// Optional fields (fill with defaults):
//   top-level : gridPx=20, canvasW=60, canvasH=40
//   component : role="NONE", tag=id, ansiNumber="", rotation=0
//   port      : label=id, enabled=true, connectedWireIds=[]
//   wire      : segments=[]

import {
  GraphTopology, GComponent, GWire, GPort, GWireSegment,
  GCompType, GCompRole, GComponentProps,
} from './graphTopology';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SchemaResult {
  ok: boolean;
  errors: string[];
}

// ─── Valid enum sets ──────────────────────────────────────────────────────────

const VALID_TYPES = new Set<string>([
  'SOURCE', 'BREAKER', 'CONTACTOR', 'NPORT_SWITCH', 'BUS', 'LOAD', 'GROUND',
]);

const VALID_ROLES = new Set<string>([
  'PREFERRED_SOURCE', 'ALTERNATE_SOURCE', 'TERTIARY_SOURCE',
  'SOURCE_BREAKER', 'TIE_BREAKER', 'LOAD_BREAKER',
  'MAIN_BUS', 'SECONDARY_BUS', 'TERTIARY_BUS',
  'AGGREGATE_LOAD', 'NONE',
]);

// ─── Structural validator ─────────────────────────────────────────────────────

export function validateSchema(obj: unknown): SchemaResult {
  const errors: string[] = [];

  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return { ok: false, errors: ['Root value must be a JSON object'] };
  }

  const raw = obj as Record<string, unknown>;

  // ── Top-level required fields
  if (typeof raw.id !== 'string' || !raw.id)
    errors.push('Missing required field: "id" (string)');
  if (typeof raw.name !== 'string' || !raw.name)
    errors.push('Missing required field: "name" (string)');
  if (!Array.isArray(raw.components))
    errors.push('Missing required field: "components" (array)');
  if (!Array.isArray(raw.wires))
    errors.push('Missing required field: "wires" (array)');

  if (errors.length > 0) return { ok: false, errors };

  const compArray  = raw.components as unknown[];
  const wireArray  = raw.wires     as unknown[];

  // ── Component validation
  const compIds = new Set<string>();
  for (let i = 0; i < compArray.length; i++) {
    const c = compArray[i];
    if (typeof c !== 'object' || c === null) {
      errors.push(`components[${i}]: expected object, got ${typeof c}`);
      continue;
    }
    const rc = c as Record<string, unknown>;
    const label = `Component at index ${i} ("${rc.tag ?? rc.id ?? '?'}")`;

    if (typeof rc.id !== 'string' || !rc.id) {
      errors.push(`${label}: missing required field "id"`);
      continue; // can't check duplicate without id
    }
    if (compIds.has(rc.id as string))
      errors.push(`Duplicate component id "${rc.id}"`);
    compIds.add(rc.id as string);

    if (typeof rc.type !== 'string' || !VALID_TYPES.has(rc.type as string))
      errors.push(`${label}: invalid type "${rc.type}" — must be one of ${[...VALID_TYPES].join(', ')}`);
    if (typeof rc.x !== 'number')
      errors.push(`${label}: missing required field "x" (number)`);
    if (typeof rc.y !== 'number')
      errors.push(`${label}: missing required field "y" (number)`);
    if (typeof rc.props !== 'object' || rc.props === null)
      errors.push(`${label}: missing required field "props" (object)`);
    if (!Array.isArray(rc.ports))
      errors.push(`${label}: missing required field "ports" (array)`);

    // Optional role check
    if (rc.role !== undefined && typeof rc.role === 'string' && !VALID_ROLES.has(rc.role))
      errors.push(`${label}: unknown role "${rc.role}" — will be treated as NONE`);

    // Port validation
    if (Array.isArray(rc.ports)) {
      const portIds = new Set<string>();
      for (let pi = 0; pi < rc.ports.length; pi++) {
        const p = rc.ports[pi];
        if (typeof p !== 'object' || p === null) {
          errors.push(`${label} ports[${pi}]: expected object`);
          continue;
        }
        const rp = p as Record<string, unknown>;
        if (typeof rp.id !== 'string' || !rp.id) {
          errors.push(`${label} ports[${pi}]: missing required field "id"`);
          continue;
        }
        if (portIds.has(rp.id as string))
          errors.push(`${label}: duplicate port id "${rp.id}"`);
        portIds.add(rp.id as string);

        if (typeof rp.dx !== 'number')
          errors.push(`${label} port "${rp.id}": missing required field "dx" (number)`);
        if (typeof rp.dy !== 'number')
          errors.push(`${label} port "${rp.id}": missing required field "dy" (number)`);
      }
    }
  }

  // ── Wire validation
  const wireIds = new Set<string>();
  for (let i = 0; i < wireArray.length; i++) {
    const w = wireArray[i];
    if (typeof w !== 'object' || w === null) {
      errors.push(`wires[${i}]: expected object, got ${typeof w}`);
      continue;
    }
    const rw = w as Record<string, unknown>;
    const label = `Wire at index ${i} ("${rw.id ?? '?'}")`;

    if (typeof rw.id !== 'string' || !rw.id) {
      errors.push(`${label}: missing required field "id"`);
      continue;
    }
    if (wireIds.has(rw.id as string))
      errors.push(`Duplicate wire id "${rw.id}"`);
    wireIds.add(rw.id as string);

    if (typeof rw.fromCompId !== 'string' || !rw.fromCompId)
      errors.push(`${label}: missing required field "fromCompId"`);
    else if (!compIds.has(rw.fromCompId as string))
      errors.push(`${label}: fromCompId "${rw.fromCompId}" does not match any component id`);

    if (typeof rw.fromPortId !== 'string' || !rw.fromPortId)
      errors.push(`${label}: missing required field "fromPortId"`);

    if (typeof rw.toCompId !== 'string' || !rw.toCompId)
      errors.push(`${label}: missing required field "toCompId"`);
    else if (!compIds.has(rw.toCompId as string))
      errors.push(`${label}: toCompId "${rw.toCompId}" does not match any component id`);

    if (typeof rw.toPortId !== 'string' || !rw.toPortId)
      errors.push(`${label}: missing required field "toPortId"`);
  }

  // ── Cross-reference: wire port IDs exist on the referenced components
  // (only when errors so far are non-fatal — skip if compIds may be incomplete)
  if (errors.length === 0) {
    const compsById = new Map(
      (raw.components as unknown[]).map(c => {
        const rc = c as Record<string, unknown>;
        return [rc.id as string, rc.ports as unknown[]];
      })
    );

    for (let i = 0; i < wireArray.length; i++) {
      const rw = wireArray[i] as Record<string, unknown>;
      const fromPorts = compsById.get(rw.fromCompId as string);
      if (fromPorts && !fromPorts.some(p => (p as Record<string, unknown>).id === rw.fromPortId)) {
        errors.push(`Wire "${rw.id}": fromPortId "${rw.fromPortId}" not found on component "${rw.fromCompId}"`);
      }
      const toPorts = compsById.get(rw.toCompId as string);
      if (toPorts && !toPorts.some(p => (p as Record<string, unknown>).id === rw.toPortId)) {
        errors.push(`Wire "${rw.id}": toPortId "${rw.toPortId}" not found on component "${rw.toCompId}"`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

// ─── Coercion (fills optional fields with defaults) ───────────────────────────

function coercePort(raw: unknown): GPort {
  const r = raw as Record<string, unknown>;
  return {
    id:               r.id as string,
    label:            typeof r.label === 'string' ? r.label : r.id as string,
    enabled:          r.enabled !== false,
    dx:               r.dx as number,
    dy:               r.dy as number,
    connectedWireIds: Array.isArray(r.connectedWireIds)
      ? (r.connectedWireIds as unknown[]).filter(x => typeof x === 'string') as string[]
      : [],
  };
}

function coerceWire(raw: unknown): GWire {
  const r = raw as Record<string, unknown>;
  return {
    id:         r.id as string,
    fromCompId: r.fromCompId as string,
    fromPortId: r.fromPortId as string,
    toCompId:   r.toCompId as string,
    toPortId:   r.toPortId as string,
    segments:   Array.isArray(r.segments)
      ? (r.segments as unknown[]).map(s => {
          const rs = s as Record<string, unknown>;
          return {
            x1: typeof rs.x1 === 'number' ? rs.x1 : 0,
            y1: typeof rs.y1 === 'number' ? rs.y1 : 0,
            x2: typeof rs.x2 === 'number' ? rs.x2 : 0,
            y2: typeof rs.y2 === 'number' ? rs.y2 : 0,
          } as GWireSegment;
        })
      : [],
  };
}

function coerceComponent(raw: unknown): GComponent {
  const r = raw as Record<string, unknown>;
  const role = (VALID_ROLES.has(r.role as string) ? r.role : 'NONE') as GCompRole;
  return {
    id:         r.id as string,
    type:       r.type as GCompType,
    role,
    tag:        typeof r.tag === 'string' ? r.tag : r.id as string,
    ansiNumber: typeof r.ansiNumber === 'string' ? r.ansiNumber : '',
    x:          r.x as number,
    y:          r.y as number,
    rotation:   typeof r.rotation === 'number' ? (r.rotation as number) : 0,
    ports:      Array.isArray(r.ports) ? (r.ports as unknown[]).map(coercePort) : [],
    props:      (r.props ?? {}) as GComponentProps,
  };
}

export function coerceTopology(raw: unknown): GraphTopology {
  const r = raw as Record<string, unknown>;
  return {
    id:         r.id as string,
    name:       r.name as string,
    gridPx:     typeof r.gridPx  === 'number' ? (r.gridPx  as number) : 20,
    canvasW:    typeof r.canvasW === 'number' ? (r.canvasW as number) : 60,
    canvasH:    typeof r.canvasH === 'number' ? (r.canvasH as number) : 40,
    components: (r.components as unknown[]).map(coerceComponent),
    wires:      (r.wires     as unknown[]).map(coerceWire),
  };
}

// ─── Combined: parse + validate + coerce ─────────────────────────────────────
//
// Returns { topo } on success, { errors } on failure.

export type ParseResult =
  | { ok: true;  topo: GraphTopology }
  | { ok: false; errors: string[] };

export function parseTopologyJSON(jsonText: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return {
      ok: false,
      errors: [`File is not valid JSON: ${(e as Error).message}`],
    };
  }

  const schema = validateSchema(parsed);
  if (!schema.ok) return { ok: false, errors: schema.errors };

  return { ok: true, topo: coerceTopology(parsed) };
}
