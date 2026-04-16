// ─── Convert builder GraphTopology → shared TopologyModel ────────────────────
// Iterates over every component and wire in the builder's stored state and
// maps them 1:1 into the canonical TopologyModel.  No values are recalculated
// or inferred — the actual stored positions, tags, rotations, and properties
// are preserved exactly.

import { GraphTopology, GComponent, GWire } from '../engine/graphTopology';
import { TopologyModel, Component, Wire, Port } from './TopologyModel';

/** Map builder GCompType + GComponentProps → TopologyModel.Component.type */
function mapComponentType(comp: GComponent): Component['type'] {
  switch (comp.type) {
    case 'SOURCE':
      return comp.props.sourceType === 'GENERATOR' ? 'generator-source' : 'utility-source';
    case 'BREAKER':
      return 'breaker';
    case 'CONTACTOR':
      return 'switch';
    case 'NPORT_SWITCH':
      return 'switch';
    case 'BUS':
      return 'bus';
    case 'LOAD':
      return 'load';
    case 'GROUND':
      return 'ground';
    default:
      console.warn(`[convertGraphTopology] Unknown component type "${comp.type}" on "${comp.tag}" — mapping as load`);
      return 'load';
  }
}

function mapPorts(comp: GComponent): Port[] {
  return comp.ports.map(p => ({
    id:        p.id,
    enabled:   p.enabled,
    relativeX: p.dx,
    relativeY: p.dy,
  }));
}

function mapComponent(comp: GComponent): Component {
  return {
    id:         comp.id,
    type:       mapComponentType(comp),
    subtype:    comp.props.sourceType as string | undefined,
    tag:        comp.tag,
    role:       comp.role,
    x:          comp.x,
    y:          comp.y,
    rotation:   comp.rotation as 0 | 90 | 180 | 270,
    ports:      mapPorts(comp),
    properties: { ...comp.props },
  };
}

function mapWire(wire: GWire): Wire {
  return {
    id:              wire.id,
    fromComponentId: wire.fromCompId,
    fromPortId:      wire.fromPortId,
    toComponentId:   wire.toCompId,
    toPortId:        wire.toPortId,
  };
}

/**
 * Convert a builder GraphTopology into the shared TopologyModel.
 * All values come directly from the builder's stored state — nothing is
 * inferred, recalculated, or regenerated.
 */
export function graphTopologyToModel(
  topo: GraphTopology,
  source: 'custom' | 'preset' | 'loaded' = 'custom',
): TopologyModel {
  return {
    version:        '1',
    name:           topo.name,
    source,
    components:     topo.components.map(mapComponent),
    wires:          topo.wires.map(mapWire),
    schemeSettings: {
      gridPx:  topo.gridPx,
      canvasW: topo.canvasW,
      canvasH: topo.canvasH,
    },
  };
}
