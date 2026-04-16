// ─── Topology Interpreter ─────────────────────────────────────────────────────
// Owns the entire pipeline from raw JSON to a fully resolved, renderable model.
// Completely decoupled from the builder's internal state.
//
// Pipeline:
//   Raw JSON string
//     → Parse (JSON.parse, catch SyntaxError)
//     → Schema detection (identify format, handle legacy/partial variants)
//     → Normalize (canonical GraphTopology)
//     → Validate (structural integrity from topoSchema + topologyValidator)
//     → Resolve (port absolute positions, wire routes, energization)
//     → Output: TopologyModel

import {
  GraphTopology,
  GComponent,
  GWire,
  GEnergization,
  GCompType,
  GCompRole,
  GComponentProps,
} from './graphTopology';
import { validateSchema, coerceTopology } from './topoSchema';
import { computeEnergization } from './connectivity';
import { validateTopology } from './topologyValidator';

// ─── Resolved model types ─────────────────────────────────────────────────────

export interface ResolvedPort {
  id: string;
  label: string;
  enabled: boolean;
  dx: number; dy: number;           // relative offset in grid units (from component centre)
  absX: number; absY: number;       // absolute pixel position
  connectedWireIds: string[];
}

export interface ResolvedComponent {
  id: string;
  type: GCompType;
  role: GCompRole;
  tag: string;
  ansiNumber: string;
  x: number; y: number;             // grid coords
  px: number; py: number;           // pixel coords (component centre)
  rotation: number;
  ports: ResolvedPort[];
  props: GComponentProps;
  energization: GEnergization;
}

export interface ResolvedWire {
  id: string;
  fromCompId: string; fromPortId: string;
  toCompId:   string; toPortId:   string;
  fromPx: number; fromPy: number;  // absolute pixel origin
  toPx:   number; toPy:   number;  // absolute pixel destination
  /** Manhattan-routed segments in pixel coordinates, recomputed from port positions */
  segments: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  energized: boolean;
  sourceId: string | null;
}

export interface BusSegment {
  compId: string;
  tag: string;
  role: GCompRole;
  px: number; py: number;
  orientation: 'horizontal' | 'vertical';
  energization: GEnergization;
}

export interface ConnectivityGraph {
  /** Component adjacency regardless of breaker state: compId → adjacent compIds */
  adjacency: Map<string, string[]>;
}

export interface TopologyModel {
  metadata: {
    id: string;
    name: string;
    source: 'preset' | 'custom' | 'loaded';
    filename?: string;
    gridPx: number;
    canvasW: number;
    canvasH: number;
  };
  /** Original GraphTopology, preserved for builder import */
  raw: GraphTopology;
  components: ResolvedComponent[];
  wires: ResolvedWire[];
  buses: BusSegment[];
  connectivity: ConnectivityGraph;
  /** Raw energization map from the BFS sweep */
  energization: Map<string, GEnergization>;
  schemeSettings: { transferMode: 'OPEN_TRANSITION' | 'CLOSED_TRANSITION' | 'FAST_TRANSFER' };
  /** Non-fatal issues discovered during interpretation */
  warnings: string[];
}

export type InterpretResult =
  | { ok: true;  model: TopologyModel }
  | { ok: false; errors: string[] };

// ─── Schema detection & normalization ─────────────────────────────────────────

type NormalizeResult =
  | { ok: true;  topo: GraphTopology; warnings: string[] }
  | { ok: false; errors: string[] };

function detectAndNormalize(obj: unknown): NormalizeResult {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return {
      ok: false,
      errors: [
        `Expected a JSON object describing a topology, but got ${Array.isArray(obj) ? 'an array' : typeof obj}.`,
        'An ATS topology file must be a JSON object with "components" and "wires" arrays.',
      ],
    };
  }

  const raw = obj as Record<string, unknown>;
  const warnings: string[] = [];

  // Version field: unknown version → warn, continue
  if ('version' in raw && raw.version !== 1 && raw.version !== '1') {
    warnings.push(
      `Unrecognized topology version "${raw.version}" — attempting to parse as current format`,
    );
  }

  const hasComponents = Array.isArray(raw.components);
  const hasWires      = 'wires' in raw;

  // ── Legacy node/edge format ────────────────────────────────────────────────
  if (!hasComponents && !hasWires && Array.isArray(raw.nodes) && Array.isArray(raw.edges)) {
    warnings.push('Detected legacy node/edge format — attempting recovery');
    const remapped = remapLegacyNodeEdge(raw);
    if (!remapped) {
      return {
        ok: false,
        errors: [
          'Could not recover from legacy node/edge format.',
          'Please re-export from the topology builder (File → Export JSON).',
        ],
      };
    }
    return { ok: true, topo: remapped, warnings };
  }

  // ── Completely unrecognizable ──────────────────────────────────────────────
  if (!hasComponents && !hasWires) {
    const keys = Object.keys(raw).slice(0, 8);
    return {
      ok: false,
      errors: [
        'This file does not appear to be an ATS topology.',
        `Expected an object with "components" and "wires" arrays, but found: ${
          keys.join(', ')
        }${Object.keys(raw).length > 8 ? '…' : ''}.`,
      ],
    };
  }

  // ── Partial topology: has components but no wires ──────────────────────────
  if (hasComponents && !hasWires) {
    warnings.push('"wires" array is absent — loading topology with no connections');
    const patched = { ...raw, wires: [] };
    const sv = validateSchema(patched);
    if (!sv.ok) return { ok: false, errors: sv.errors };
    return { ok: true, topo: coerceTopology(patched), warnings };
  }

  // ── Missing components (has wires but no components) ───────────────────────
  if (!hasComponents) {
    return {
      ok: false,
      errors: ['"components" array is missing — the file has wires but no components to connect'],
    };
  }

  // ── Normal path: validate schema and coerce ────────────────────────────────
  const sv = validateSchema(raw);
  if (!sv.ok) return { ok: false, errors: sv.errors };

  return { ok: true, topo: coerceTopology(raw), warnings };
}

/** Best-effort remap of legacy { nodes, edges } format. Returns null on failure. */
function remapLegacyNodeEdge(raw: Record<string, unknown>): GraphTopology | null {
  try {
    const nodes = raw.nodes as Array<Record<string, unknown>>;
    const edges = raw.edges as Array<Record<string, unknown>>;

    const components: GComponent[] = nodes.map((n, i) => ({
      id:         String(n.id ?? `comp-${i}`),
      type:       (n.type ?? 'LOAD') as GCompType,
      role:       (n.role ?? 'NONE') as GCompRole,
      tag:        String(n.tag ?? n.label ?? n.id ?? `comp-${i}`),
      ansiNumber: String(n.ansiNumber ?? ''),
      x:          Number(n.x ?? 0),
      y:          Number(n.y ?? 0),
      rotation:   Number(n.rotation ?? 0),
      ports: Array.isArray(n.ports)
        ? (n.ports as GComponent['ports'])
        : [{ id: 'default', label: 'P', enabled: true, dx: 0, dy: 0, connectedWireIds: [] }],
      props: (typeof n.props === 'object' && n.props !== null
        ? n.props
        : {}) as GComponentProps,
    }));

    const wires: GWire[] = edges.map((e, i) => ({
      id:         String(e.id ?? `w-${i}`),
      fromCompId: String(e.source     ?? e.from     ?? e.fromCompId ?? ''),
      fromPortId: String(e.sourcePort ?? e.fromPort ?? e.fromPortId ?? 'out'),
      toCompId:   String(e.target     ?? e.to       ?? e.toCompId   ?? ''),
      toPortId:   String(e.targetPort ?? e.toPort   ?? e.toPortId   ?? 'in'),
      segments:   [],
    }));

    return {
      id:       String(raw.id   ?? 'imported'),
      name:     String(raw.name ?? 'Imported Topology'),
      gridPx:   Number(raw.gridPx  ?? 20),
      canvasW:  Number(raw.canvasW ?? 60),
      canvasH:  Number(raw.canvasH ?? 40),
      components,
      wires,
    };
  } catch {
    return null;
  }
}

// ─── Resolution ───────────────────────────────────────────────────────────────

/**
 * Compute orthogonal (Manhattan) wire route segments in pixel coordinates.
 * Recomputed from scratch — does not trust stored segment data.
 */
function computeManhattanRoute(
  fromPx: number, fromPy: number,
  toPx:   number, toPy:   number,
  gridPx: number,
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const dx = Math.abs(toPx - fromPx);
  const dy = Math.abs(toPy - fromPy);
  if (dx < 0.5 && dy < 0.5) return [];
  if (dy < 0.5) return [{ x1: fromPx, y1: fromPy, x2: toPx, y2: toPy }]; // horizontal
  if (dx < 0.5) return [{ x1: fromPx, y1: fromPy, x2: toPx, y2: toPy }]; // vertical
  // L-shape: horizontal first, then vertical.  Midpoint snapped to grid.
  const midX = Math.round((fromPx + toPx) / 2 / gridPx) * gridPx;
  return [
    { x1: fromPx, y1: fromPy, x2: midX,  y2: fromPy },
    { x1: midX,   y1: fromPy, x2: midX,  y2: toPy   },
    { x1: midX,   y1: toPy,   x2: toPx,  y2: toPy   },
  ];
}

function resolveTopologyModel(
  topo:               GraphTopology,
  source:             'preset' | 'custom' | 'loaded',
  filename:           string | undefined,
  detectionWarnings:  string[],
): TopologyModel {
  const { gridPx } = topo;
  const energMap = computeEnergization(topo.components, topo.wires);

  // ── Resolve components ─────────────────────────────────────────────────────
  const components: ResolvedComponent[] = topo.components.map(comp => {
    const px = comp.x * gridPx;
    const py = comp.y * gridPx;
    const ports: ResolvedPort[] = comp.ports.map(p => ({
      ...p,
      absX: px + p.dx * gridPx,
      absY: py + p.dy * gridPx,
    }));
    const energization = energMap.get(comp.id) ?? { energized: false, sourceId: null, voltage: 0 };
    return { ...comp, px, py, ports, energization };
  });

  const compMap = new Map(components.map(c => [c.id, c]));

  // ── Resolve wires ──────────────────────────────────────────────────────────
  const wires: ResolvedWire[] = topo.wires.map(w => {
    const fromComp = compMap.get(w.fromCompId);
    const toComp   = compMap.get(w.toCompId);
    const fromPort = fromComp?.ports.find(p => p.id === w.fromPortId);
    const toPort   = toComp?.ports.find(p => p.id === w.toPortId);

    const fromPx = fromPort?.absX ?? 0;
    const fromPy = fromPort?.absY ?? 0;
    const toPx   = toPort?.absX   ?? 0;
    const toPy   = toPort?.absY   ?? 0;

    const segments = computeManhattanRoute(fromPx, fromPy, toPx, toPy, gridPx);

    // Wire is energized when both endpoints share the same source
    const fromE = energMap.get(w.fromCompId);
    const toE   = energMap.get(w.toCompId);
    const energized = !!(
      fromE?.energized && toE?.energized && fromE.sourceId === toE.sourceId
    );

    return {
      ...w,
      fromPx, fromPy, toPx, toPy,
      segments,
      energized,
      sourceId: energized ? (fromE?.sourceId ?? null) : null,
    };
  });

  // ── Bus segments ───────────────────────────────────────────────────────────
  const buses: BusSegment[] = components
    .filter(c => c.type === 'BUS')
    .map(c => {
      const xSpan = c.ports.reduce((acc, p) => Math.max(acc, Math.abs(p.dx)), 0);
      const ySpan = c.ports.reduce((acc, p) => Math.max(acc, Math.abs(p.dy)), 0);
      return {
        compId:      c.id,
        tag:         c.tag,
        role:        c.role,
        px:          c.px,
        py:          c.py,
        orientation: (xSpan >= ySpan ? 'horizontal' : 'vertical') as 'horizontal' | 'vertical',
        energization: c.energization,
      };
    });

  // ── Connectivity graph (topology-level adjacency, breaker-agnostic) ────────
  const adjacency = new Map<string, string[]>();
  for (const c of topo.components) adjacency.set(c.id, []);
  for (const w of topo.wires) {
    adjacency.get(w.fromCompId)?.push(w.toCompId);
    adjacency.get(w.toCompId)?.push(w.fromCompId);
  }

  // ── Collect all warnings ───────────────────────────────────────────────────
  const valResult = validateTopology(topo);
  const warnings  = [...detectionWarnings, ...valResult.warnings];

  return {
    metadata: {
      id:      topo.id,
      name:    topo.name,
      source,
      filename,
      gridPx,
      canvasW: topo.canvasW,
      canvasH: topo.canvasH,
    },
    raw: topo,
    components,
    wires,
    buses,
    connectivity: { adjacency },
    energization: energMap,
    schemeSettings: { transferMode: 'OPEN_TRANSITION' },
    warnings,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Interpret a raw JSON string into a fully resolved TopologyModel.
 * This is the main entry point for loading from files.
 *
 * Returns { ok: false } with specific error messages at each stage:
 *   - Parse failure   → JSON syntax error text
 *   - Detection fail  → what was expected vs what was found
 *   - Schema failure  → which fields are missing or invalid
 *
 * Non-fatal issues (floating ports, unassigned roles, etc.) are surfaced
 * as model.warnings rather than blocking the load.
 */
export function interpretTopologyJSON(
  jsonText: string,
  filename?: string,
): InterpretResult {
  // Stage 1: JSON parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    const msg = err instanceof SyntaxError ? err.message : String(err);
    return {
      ok: false,
      errors: [
        `This file is not valid JSON: ${msg}`,
        'Check for missing commas, unmatched brackets, or trailing commas.',
      ],
    };
  }

  // Stage 2 & 3: Detect schema and normalize to GraphTopology
  const normalized = detectAndNormalize(parsed);
  if (!normalized.ok) return { ok: false, errors: normalized.errors };

  // Stage 4–5: Resolve (energization, absolute positions, routes)
  const model = resolveTopologyModel(
    normalized.topo,
    'loaded',
    filename,
    normalized.warnings,
  );

  return { ok: true, model };
}

/**
 * Build a TopologyModel from an already-parsed GraphTopology.
 * Used for presets and post-builder exports.
 */
export function interpretTopology(
  topo:     GraphTopology,
  source:   'preset' | 'custom' | 'loaded' = 'custom',
  filename?: string,
): TopologyModel {
  return resolveTopologyModel(topo, source, filename, []);
}

/**
 * Infer the closest simulation preset type from a topology's component roles.
 * Used to select which FSM to run when the user clicks "Run Simulation".
 *
 * MMM  → 2+ tie breakers or any tertiary role
 * MTM  → exactly 1 tie breaker
 * TWO_SOURCE → no tie breakers
 */
export function detectSimPreset(
  model: TopologyModel,
): 'TWO_SOURCE' | 'MTM' | 'MMM' {
  const topo     = model.raw;
  const tieBrks  = topo.components.filter(c => c.role === 'TIE_BREAKER');
  const tertiary = topo.components.filter(
    c => c.role === 'TERTIARY_SOURCE' || c.role === 'TERTIARY_BUS',
  );
  if (tertiary.length > 0 || tieBrks.length >= 2) return 'MMM';
  if (tieBrks.length === 1)                         return 'MTM';
  return 'TWO_SOURCE';
}
