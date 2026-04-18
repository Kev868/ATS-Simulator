// Single source of truth for all circuit data types.
// No other file defines circuit interfaces.

export type ComponentType =
  | "utility-source"
  | "generator-source"
  | "circuit-breaker"
  | "bus-segment"
  | "load"
  | "ground"
  | "junction";

export interface PortDefinition {
  id: string;
  label: string;
  relativeX: number;
  relativeY: number;
  enabled: boolean;
  direction: "in" | "out" | "bidirectional";
}

export interface ComponentProperties {
  nominalVoltage?: number;
  nominalFrequency?: number;
  loadKW?: number;
  loadKVA?: number;
  ratedCurrent?: number;
  tripSetting?: number;
  busLength?: number;
  startupTime?: number;
  rampRate?: number;
}

export interface ComponentRuntimeState {
  closed: boolean;
  energized: boolean;
  failed: boolean;
  tripped: boolean;
  locked: boolean;
  voltagePercent: number;
  frequencyHz: number;
  phaseAngleDeg: number;
}

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  tag: string;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  ports: PortDefinition[];
  properties: ComponentProperties;
  state: ComponentRuntimeState;
  selected?: boolean;
  highlighted?: boolean;
}

export interface CircuitWire {
  id: string;
  fromComponentId: string;
  fromPortId: string;
  toComponentId: string;
  toPortId: string;
}

export interface SchemeSettings {
  transferMode: "open-transition" | "closed-transition" | "fast-transfer";
  preferredSourceId: string | null;
  undervoltagePickup: number;
  overvoltagePickup: number;
  underfrequencyPickup: number;
  overfrequencyPickup: number;
  pickupDelay: number;
  transferDelay: number;
  retransferDelay: number;
  autoRetransfer: boolean;
  syncCheckDeltaV: number;
  syncCheckDeltaF: number;
  syncCheckDeltaPhi: number;
  maxParallelTime: number;
  lockoutAfterN: number;
  lockoutWindow: number;
}

export interface CircuitModel {
  version: "2.0";
  name: string;
  components: CircuitComponent[];
  wires: CircuitWire[];
  schemeSettings: SchemeSettings;
}

export interface PortNode {
  componentId: string;
  portId: string;
  absoluteX: number;
  absoluteY: number;
}

export interface GraphEdge {
  wireId: string;
  from: PortNode;
  to: PortNode;
}

export interface AdjacencyGraph {
  nodes: Map<string, PortNode>;
  edges: GraphEdge[];
  adjacency: Map<string, string[]>;
}

export type SimEventType =
  | "SOURCE_HEALTHY" | "SOURCE_UNHEALTHY" | "SOURCE_FAILED" | "SOURCE_RESTORED"
  | "BREAKER_OPENED" | "BREAKER_CLOSED" | "BREAKER_TRIPPED" | "BREAKER_BLOCKED"
  | "TRANSFER_INITIATED" | "TRANSFER_COMPLETE" | "RETRANSFER_INITIATED" | "RETRANSFER_COMPLETE"
  | "SYNC_CHECK_PASS" | "SYNC_CHECK_FAIL"
  | "BUS_ENERGIZED" | "BUS_DEENERGIZED"
  | "LOCKOUT_ACTIVATED"
  | "INTERLOCK_BLOCKED"
  | "WARNING" | "INFO";

export interface SimEvent {
  timestamp: number;
  type: SimEventType;
  componentTag: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface SimulationState {
  running: boolean;
  paused: boolean;
  simulatedTimeMs: number;
  speedMultiplier: number;
  events: SimEvent[];
  transferCount: number;
  lockedOut: boolean;
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  componentId?: string;
  wireId?: string;
}
