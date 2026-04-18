import { describe, it, expect } from 'vitest';
import { createSimulationState, createTransferControllerState, tickSimulation } from '../core/SimulationEngine';
import { deserializeCircuit } from '../core/serialization';
import { applyEnergization } from '../core/EnergizationSolver';
import twoSourceJson from '../presets/two-source-ats.json';

describe('SimulationEngine', () => {
  it('energizes circuit on first tick', () => {
    const model = deserializeCircuit(JSON.stringify(twoSourceJson));
    applyEnergization(model);
    const sim = createSimulationState();
    const ctrl = createTransferControllerState();

    tickSimulation(model, sim, ctrl, 16);

    const bus = model.components.find((c) => c.id === 'bus1');
    expect(bus?.state.energized).toBe(true);
  });

  it('advances simulatedTimeMs', () => {
    const model = deserializeCircuit(JSON.stringify(twoSourceJson));
    const sim = createSimulationState();
    const ctrl = createTransferControllerState();

    tickSimulation(model, sim, ctrl, 100);
    expect(sim.simulatedTimeMs).toBe(100);

    tickSimulation(model, sim, ctrl, 50);
    expect(sim.simulatedTimeMs).toBe(150);
  });

  it('appends events to simState.events', () => {
    const model = deserializeCircuit(JSON.stringify(twoSourceJson));
    const m1 = model.components.find((c) => c.id === 'm1')!;
    m1.state.voltagePercent = 80;

    const sim = createSimulationState();
    const ctrl = createTransferControllerState();
    ctrl.activeSourceId = 'm1';

    tickSimulation(model, sim, ctrl, 50);
    expect(sim.events.length).toBeGreaterThan(0);
  });

  it('emits BUS_ENERGIZED event when bus becomes energized', () => {
    const model = deserializeCircuit(JSON.stringify(twoSourceJson));
    // Start with bus de-energized (source failed)
    const m1 = model.components.find((c) => c.id === 'm1')!;
    m1.state.failed = true;
    applyEnergization(model);

    const sim = createSimulationState();
    const ctrl = createTransferControllerState();

    // Restore source
    m1.state.failed = false;
    tickSimulation(model, sim, ctrl, 16);

    expect(sim.events.some((e) => e.type === 'BUS_ENERGIZED')).toBe(true);
  });
});
