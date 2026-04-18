import { describe, it, expect } from 'vitest';
import {
  createTransferControllerState,
  tickTransferController,
} from '../core/TransferController';
import { deserializeCircuit } from '../core/serialization';
import twoSourceJson from '../presets/two-source-ats.json';

function makeModel() {
  return deserializeCircuit(JSON.stringify(twoSourceJson));
}

function advanceTime(
  model: ReturnType<typeof makeModel>,
  ctrlState: ReturnType<typeof createTransferControllerState>,
  ms: number,
  tickMs = 50,
) {
  let t = 0;
  const allEvents = [];
  while (t < ms) {
    const dt = Math.min(tickMs, ms - t);
    const evts = tickTransferController(model, ctrlState, t, dt);
    allEvents.push(...evts);
    t += dt;
  }
  return allEvents;
}

describe('TransferController — open transition', () => {
  it('enters PICKUP_TIMING when source voltage drops', () => {
    const m = makeModel();
    const ctrl = createTransferControllerState();
    ctrl.activeSourceId = 'm1';

    const m1 = m.components.find((c) => c.id === 'm1')!;
    m1.state.voltagePercent = 80; // below 85% threshold

    const events = tickTransferController(m, ctrl, 0, 50);
    expect(ctrl.fsm).toBe('PICKUP_TIMING');
    expect(events.some((e) => e.type === 'SOURCE_UNHEALTHY')).toBe(true);
  });

  it('returns to NORMAL (ride-through) if source recovers before pickupDelay', () => {
    const m = makeModel();
    const ctrl = createTransferControllerState();
    ctrl.activeSourceId = 'm1';
    const m1 = m.components.find((c) => c.id === 'm1')!;

    m1.state.voltagePercent = 80;
    tickTransferController(m, ctrl, 0, 50); // enters PICKUP_TIMING

    m1.state.voltagePercent = 100; // recover
    const events = tickTransferController(m, ctrl, 50, 50);
    expect(ctrl.fsm).toBe('NORMAL');
    expect(events.some((e) => e.type === 'SOURCE_HEALTHY')).toBe(true);
  });

  it('declares SOURCE_FAILED after pickupDelay', () => {
    const m = makeModel();
    const ctrl = createTransferControllerState();
    ctrl.activeSourceId = 'm1';
    const m1 = m.components.find((c) => c.id === 'm1')!;
    m1.state.voltagePercent = 80;

    // Advance past 500ms pickupDelay
    const events = advanceTime(m, ctrl, 600);
    expect(ctrl.fsm === 'SOURCE_FAILED' || ctrl.fsm === 'TRANSFER_DELAY' || ctrl.fsm === 'TRANSFERRING' || ctrl.fsm === 'TRANSFERRED').toBe(true);
    expect(events.some((e) => e.type === 'SOURCE_FAILED')).toBe(true);
  });

  it('completes transfer to M2 after failure + delays', () => {
    const m = makeModel();
    // Make M2 ready (healthy, breaker can close)
    const m2 = m.components.find((c) => c.id === 'm2')!;
    m2.state.voltagePercent = 100;
    m2.state.frequencyHz = 60;

    const ctrl = createTransferControllerState();
    ctrl.activeSourceId = 'm1';
    const m1 = m.components.find((c) => c.id === 'm1')!;
    m1.state.voltagePercent = 80;

    // Advance past pickup (500ms) + transfer delay (100ms) + buffer
    const events = advanceTime(m, ctrl, 800);

    expect(ctrl.fsm).toBe('TRANSFERRED');
    expect(events.some((e) => e.type === 'TRANSFER_COMPLETE')).toBe(true);
    expect(events.some((e) => e.type === 'BREAKER_OPENED')).toBe(true);
    expect(events.some((e) => e.type === 'BREAKER_CLOSED')).toBe(true);
  });
});

describe('TransferController — retransfer', () => {
  it('retransfers to preferred source after restoration', () => {
    const m = makeModel();
    const m1 = m.components.find((c) => c.id === 'm1')!;
    const m2 = m.components.find((c) => c.id === 'm2')!;
    m2.state.voltagePercent = 100;
    m2.state.frequencyHz = 60;

    const ctrl = createTransferControllerState();
    ctrl.activeSourceId = 'm1';
    m1.state.voltagePercent = 80;

    // Transfer to M2
    advanceTime(m, ctrl, 800);
    expect(ctrl.fsm).toBe('TRANSFERRED');

    // Restore M1
    m1.state.voltagePercent = 100;
    m1.state.failed = false;

    // Advance past retransferDelay (10000ms)
    const events = advanceTime(m, ctrl, 11000);
    expect(ctrl.fsm).toBe('NORMAL');
    expect(events.some((e) => e.type === 'RETRANSFER_COMPLETE')).toBe(true);
  });
});
