// ─── Graph-based topology model ───────────────────────────────────────────────
// All custom topologies are represented as a directed graph:
//   Nodes  = GComponent (source, breaker, bus, load, ground, …)
//   Edges  = GWire (orthogonal, port-to-port)
// Simulation runs a BFS connectivity sweep each tick to determine energization.

// ─── Enumerations ─────────────────────────────────────────────────────────────

export type GCompType =
  | 'SOURCE'        // AC power source (utility or generator)
  | 'BREAKER'       // Circuit breaker (ANSI 52)
  | 'CONTACTOR'     // Contactor (lighter-duty switching)
  | 'NPORT_SWITCH'  // N-port automatic transfer switch (N = portCount)
  | 'BUS'           // Bus node (multi-port conductor)
  | 'LOAD'          // Aggregate load block
  | 'GROUND';       // Earth ground reference

export type GCompRole =
  | 'PREFERRED_SOURCE'    // Primary / preferred feeder
  | 'ALTERNATE_SOURCE'    // First backup feeder
  | 'TERTIARY_SOURCE'     // Second backup feeder
  | 'SOURCE_BREAKER'      // Breaker at the source terminal (main breaker)
  | 'TIE_BREAKER'         // Bus-sectionalising / bus-tie breaker
  | 'LOAD_BREAKER'        // Feeder breaker to a downstream load
  | 'MAIN_BUS'            // Primary load bus
  | 'SECONDARY_BUS'       // Secondary load bus (MTM bus-2)
  | 'TERTIARY_BUS'        // Third bus (MMM)
  | 'AGGREGATE_LOAD'      // Load block attached to a bus
  | 'NONE';               // Role not yet assigned

export type GBreakerState = 'OPEN' | 'CLOSING' | 'CLOSED' | 'TRIPPING';
export type GSourceType   = 'UTILITY' | 'GENERATOR';

// ─── Port ─────────────────────────────────────────────────────────────────────

export interface GPort {
  /** Unique within the owning component, e.g. 'top', 'left', 'p0', 'p1'. */
  id: string;
  /** Human-readable label displayed on the port in the builder. */
  label: string;
  /** Whether this port participates in wiring and connectivity. */
  enabled: boolean;
  /**
   * Offset from the component's grid-snapped centre, in grid units.
   * Positive x = right, positive y = down.
   */
  dx: number;
  dy: number;
  /** IDs of wires connected to this port. */
  connectedWireIds: string[];
}

// ─── Component properties (union of all per-type fields) ─────────────────────

export interface GComponentProps {
  // SOURCE ─────────────────────────────────────
  sourceType?: GSourceType;
  nominalVoltage?: number;   // kV
  nominalFrequency?: number; // Hz
  voltage?: number;          // % of nominal (0 – 130)
  frequency?: number;        // Hz
  phaseAngle?: number;       // degrees
  available?: boolean;

  // BREAKER / CONTACTOR ─────────────────────────
  breakerState?: GBreakerState;
  operationTimeMs?: number;
  lockedOut?: boolean;
  elapsed?: number;          // ms spent in current transient

  // NPORT_SWITCH ────────────────────────────────
  portCount?: number;        // 2 | 3 | 4

  // BUS ─────────────────────────────────────────
  // (energization is computed by the connectivity sweep — not stored here)

  // LOAD ────────────────────────────────────────
  loadKW?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface GComponent {
  id: string;
  type: GCompType;
  role: GCompRole;
  /** User-visible tag, e.g. "52-M1", "BUS-A", "UTIL-1". */
  tag: string;
  /** ANSI device number shown on the schematic, e.g. "52" for a breaker. */
  ansiNumber: string;
  /** Column position in grid units. */
  x: number;
  /** Row position in grid units. */
  y: number;
  /** Rotation: 0 | 90 | 180 | 270 degrees. */
  rotation: number;
  ports: GPort[];
  props: GComponentProps;
}

// ─── Wire ─────────────────────────────────────────────────────────────────────

export interface GWireSegment {
  x1: number; y1: number;
  x2: number; y2: number;
}

export interface GWire {
  id: string;
  fromCompId: string;
  fromPortId: string;
  toCompId: string;
  toPortId: string;
  /** Ordered list of orthogonal segments forming the Manhattan path. */
  segments: GWireSegment[];
}

// ─── Computed energization (output of connectivity sweep) ────────────────────

export interface GEnergization {
  energized: boolean;
  /** ID of the source component that is feeding this component. */
  sourceId: string | null;
  /** Voltage as % of nominal, 0 if de-energized. */
  voltage: number;
}

// ─── Topology definition ──────────────────────────────────────────────────────

export interface GraphTopology {
  id: string;
  name: string;
  /** Pixels per grid unit (default 20). */
  gridPx: number;
  /** Canvas width in grid units. */
  canvasW: number;
  /** Canvas height in grid units. */
  canvasH: number;
  components: GComponent[];
  wires: GWire[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function findCompsByRole(topo: GraphTopology, role: GCompRole): GComponent[] {
  return topo.components.filter(c => c.role === role);
}

export function findCompByRole(topo: GraphTopology, role: GCompRole): GComponent | undefined {
  return topo.components.find(c => c.role === role);
}

export function findCompsByType(topo: GraphTopology, type: GCompType): GComponent[] {
  return topo.components.filter(c => c.type === type);
}

/** Returns all wires connected to a given component (any port). */
export function wiresOfComp(topo: GraphTopology, compId: string): GWire[] {
  return topo.wires.filter(
    w => w.fromCompId === compId || w.toCompId === compId
  );
}

/** Returns the port object for a given compId.portId pair. */
export function findPort(topo: GraphTopology, compId: string, portId: string): GPort | undefined {
  return topo.components.find(c => c.id === compId)?.ports.find(p => p.id === portId);
}

/** Update a component's props immutably. */
export function updateCompProps(
  topo: GraphTopology,
  compId: string,
  patch: Partial<GComponentProps>
): GraphTopology {
  return {
    ...topo,
    components: topo.components.map(c =>
      c.id === compId ? { ...c, props: { ...c.props, ...patch } } : c
    ),
  };
}

/** Set a breaker's state immutably. */
export function setBreakerState(
  topo: GraphTopology,
  compId: string,
  state: GBreakerState
): GraphTopology {
  return updateCompProps(topo, compId, { breakerState: state, elapsed: 0 });
}
