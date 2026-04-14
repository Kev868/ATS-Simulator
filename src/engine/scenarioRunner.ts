import { SimState, ScenarioEvent, Scenario } from './types';

export function applyScenarioEvents(
  state: SimState,
  pendingEvents: ScenarioEvent[]
): { state: SimState; remaining: ScenarioEvent[] } {
  const toApply = pendingEvents.filter(e => e.timeMs <= state.simTimeMs);
  const remaining = pendingEvents.filter(e => e.timeMs > state.simTimeMs);

  let current = state;
  for (const event of toApply) {
    const patch = event.action(current);
    current = { ...current, ...patch };
  }

  return { state: current, remaining };
}

export const PRESET_SCENARIOS: Scenario[] = [
  {
    id: 'loss_preferred',
    name: 'Loss of Preferred Source',
    description: 'M1 fails at t=3s, ATS transfers to M2 via tie',
    events: [
      {
        timeMs: 3000,
        description: 'Fail M1',
        action: (state: SimState) => ({
          sources: state.sources.map(s => s.id === 'M1' ? { ...s, voltage: 0, available: false } : s),
        }),
      },
    ],
  },
  {
    id: 'brief_sag',
    name: 'Brief Voltage Sag (rides through)',
    description: 'M1 sags to 80% at t=2s, restores at t=3.5s (within UV pickup delay)',
    events: [
      {
        timeMs: 2000,
        description: 'M1 voltage sag to 80%',
        action: (state: SimState) => ({
          sources: state.sources.map(s => s.id === 'M1' ? { ...s, voltage: 80 } : s),
        }),
      },
      {
        timeMs: 3500,
        description: 'M1 voltage restored',
        action: (state: SimState) => ({
          sources: state.sources.map(s => s.id === 'M1' ? { ...s, voltage: 100 } : s),
        }),
      },
    ],
  },
  {
    id: 'sustained_sag',
    name: 'Sustained Voltage Sag (transfers)',
    description: 'M1 sags to 80% at t=2s and stays (UV pickup expires, transfer occurs)',
    events: [
      {
        timeMs: 2000,
        description: 'M1 sustained sag to 80%',
        action: (state: SimState) => ({
          sources: state.sources.map(s => s.id === 'M1' ? { ...s, voltage: 80 } : s),
        }),
      },
    ],
  },
  {
    id: 'failed_closed_transition',
    name: 'Failed Closed Transition (out of sync)',
    description: 'M1 fails, M2 is out of sync — closed transition blocked by sync check',
    events: [
      {
        timeMs: 1000,
        description: 'Offset M2 phase by 30°',
        action: (state: SimState) => ({
          sources: state.sources.map(s => s.id === 'M2' ? { ...s, phaseAngle: 30 } : s),
        }),
      },
      {
        timeMs: 3000,
        description: 'Fail M1',
        action: (state: SimState) => ({
          sources: state.sources.map(s => s.id === 'M1' ? { ...s, voltage: 0 } : s),
        }),
      },
    ],
  },
  {
    id: 'successful_closed_transition',
    name: 'Successful Closed Transition',
    description: 'Sources in sync, closed transition completes cleanly',
    events: [
      {
        timeMs: 3000,
        description: 'Fail M1',
        action: (state: SimState) => ({
          sources: state.sources.map(s => s.id === 'M1' ? { ...s, voltage: 0 } : s),
        }),
      },
    ],
  },
  {
    id: 'loss_both',
    name: 'Loss of Both Sources',
    description: 'M1 fails at t=3s, M2 fails at t=5s — both buses go dead',
    events: [
      {
        timeMs: 3000,
        description: 'Fail M1',
        action: (state: SimState) => ({
          sources: state.sources.map(s => s.id === 'M1' ? { ...s, voltage: 0 } : s),
        }),
      },
      {
        timeMs: 5000,
        description: 'Fail M2',
        action: (state: SimState) => ({
          sources: state.sources.map(s => s.id === 'M2' ? { ...s, voltage: 0 } : s),
        }),
      },
    ],
  },
  {
    id: 'retransfer',
    name: 'Auto-Retransfer on Preferred Restoration',
    description: 'M1 fails (transfers to M2), then M1 restores and auto-retransfers back',
    events: [
      {
        timeMs: 3000,
        description: 'Fail M1',
        action: (state: SimState) => ({
          sources: state.sources.map(s => s.id === 'M1' ? { ...s, voltage: 0 } : s),
        }),
      },
      {
        timeMs: 10000,
        description: 'Restore M1',
        action: (state: SimState) => ({
          sources: state.sources.map(s => s.id === 'M1' ? { ...s, voltage: 100, available: true } : s),
        }),
      },
    ],
  },
];
