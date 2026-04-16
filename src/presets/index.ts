// ─── Preset topologies as TopologyModel ──────────────────────────────────────
// Each preset converts from the existing GraphTopology definitions through
// graphTopologyToModel, so the canonical component positions, ports, and
// wiring are defined in exactly one place (graphPresets.ts).

import { TopologyModel } from '../models/TopologyModel';
import { graphTopologyToModel } from '../models/convertGraphTopology';
import {
  makeTwoSourceTopology,
  makeMTMTopology,
  makeMMMTopology,
} from '../engine/graphPresets';
import { Topology } from '../engine/types';

export function getTwoSourceModel(): TopologyModel {
  return graphTopologyToModel(makeTwoSourceTopology(), 'preset');
}

export function getMTMModel(): TopologyModel {
  return graphTopologyToModel(makeMTMTopology(), 'preset');
}

export function getMMMModel(): TopologyModel {
  return graphTopologyToModel(makeMMMTopology(), 'preset');
}

/** Look up a preset TopologyModel by the engine's Topology enum value. */
export function getPresetModel(preset: Topology): TopologyModel {
  switch (preset) {
    case 'TWO_SOURCE': return getTwoSourceModel();
    case 'MTM':        return getMTMModel();
    case 'MMM':        return getMMMModel();
  }
}
