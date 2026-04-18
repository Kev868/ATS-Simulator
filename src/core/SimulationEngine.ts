import type { CircuitModel, SimulationState, SimEvent } from './types';
import { buildAdjacencyGraph } from './CircuitGraph';
import { solveEnergization } from './EnergizationSolver';
import {
  tickTransferController,
  createTransferControllerState,
  type TransferControllerState,
} from './TransferController';

export function createSimulationState(): SimulationState {
  return {
    running: false,
    paused: false,
    simulatedTimeMs: 0,
    speedMultiplier: 1,
    events: [],
    transferCount: 0,
    lockedOut: false,
  };
}

export function tickSimulation(
  model: CircuitModel,
  simState: SimulationState,
  ctrlState: TransferControllerState,
  deltaMs: number,
): SimEvent[] {
  const events: SimEvent[] = [];

  // Run the transfer controller FSM
  const transferEvents = tickTransferController(model, ctrlState, simState.simulatedTimeMs, deltaMs);
  events.push(...transferEvents);

  // Propagate controller state to simulation state
  simState.transferCount = ctrlState.transferCount;
  simState.lockedOut = ctrlState.fsm === "LOCKED_OUT";

  // Rebuild graph and recompute energization after any state changes
  const graph = buildAdjacencyGraph(model);
  const energizationMap = solveEnergization(model, graph);

  for (const comp of model.components) {
    const wasEnergized = comp.state.energized;
    const isNowEnergized = energizationMap.get(comp.id) ?? false;

    if (comp.type === "bus-segment" && wasEnergized !== isNowEnergized) {
      events.push({
        timestamp: simState.simulatedTimeMs,
        type: isNowEnergized ? "BUS_ENERGIZED" : "BUS_DEENERGIZED",
        componentTag: comp.tag,
        message: `${comp.tag} ${isNowEnergized ? "energized" : "de-energized"}`,
      });
    }

    comp.state.energized = isNowEnergized;
  }

  // Advance simulated time
  simState.simulatedTimeMs += deltaMs;

  // Append events to simState log
  simState.events.push(...events);

  return events;
}

export { createTransferControllerState };
export type { TransferControllerState };
