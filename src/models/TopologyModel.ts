// ─── Shared TopologyModel ─────────────────────────────────────────────────────
// The single canonical type used by the builder, simulation renderer, presets,
// and loaded-file pipeline.  Both the builder and the simulation consume this
// — nothing else.

export interface Port {
  id: string;
  enabled: boolean;
  relativeX: number;  // offset from component center (grid units)
  relativeY: number;
}

export interface Component {
  id: string;
  type:
    | 'utility-source'
    | 'generator-source'
    | 'breaker'
    | 'switch'
    | 'bus'
    | 'load'
    | 'ground';
  subtype?: string;
  tag: string;
  role?: string;
  x: number;          // grid position from builder
  y: number;
  rotation: 0 | 90 | 180 | 270;
  ports: Port[];
  properties: Record<string, unknown>;  // voltage, frequency, kW, breakerState, etc.
}

export interface Wire {
  id: string;
  fromComponentId: string;
  fromPortId: string;
  toComponentId: string;
  toPortId: string;
}

export interface TopologyModel {
  version: string;
  name: string;
  source: 'preset' | 'custom' | 'loaded';
  components: Component[];
  wires: Wire[];
  schemeSettings: Record<string, unknown>;
}
