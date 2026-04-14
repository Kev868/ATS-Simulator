import {
  SimState,
  Topology,
  TransferMode,
  Source,
  Breaker,
  Bus,
  Setpoints,
  ScenarioEvent,
  SourceHealth,
} from './types';
import { tickScheme } from './schemeController';
import { applyScenarioEvents } from './scenarioRunner';

export const DEFAULT_SETPOINTS: Setpoints = {
  uvThreshold: 85,
  uvPickupTime: 2000,
  ovThreshold: 110,
  ovPickupTime: 500,
  ufThreshold: 59.0,
  ufPickupTime: 2000,
  ofThreshold: 61.0,
  ofPickupTime: 500,
  transferDelay: 100,
  retransferDelay: 10000,
  syncCheckDV: 5,
  syncCheckDf: 0.2,
  syncCheckDPhi: 10,
  maxParallelTimeMs: 150,
  deadBusThreshold: 20,
  deadSourceThreshold: 20,
  maxTransfersInWindow: 3,
  transferWindowMs: 60000,
  preferredSource: 'M1',
  autoRetransfer: true,
};

function makeSources(topology: Topology): Source[] {
  const base: Source = {
    nominalVoltage: 13.8,
    nominalFrequency: 60,
    voltage: 100,
    frequency: 60,
    phaseAngle: 0,
    available: true,
    id: '',
    label: '',
  };

  if (topology === 'TWO_SOURCE') {
    return [
      { ...base, id: 'M1', label: 'Main 1' },
      { ...base, id: 'M2', label: 'Main 2' },
    ];
  }
  if (topology === 'MTM') {
    return [
      { ...base, id: 'M1', label: 'Main 1' },
      { ...base, id: 'M2', label: 'Main 2' },
    ];
  }
  // MMM
  return [
    { ...base, id: 'M1', label: 'Main 1' },
    { ...base, id: 'M2', label: 'Main 2' },
    { ...base, id: 'M3', label: 'Main 3' },
  ];
}

function makeBreakers(topology: Topology): Breaker[] {
  const base: Breaker = {
    operationTimeMs: 50,
    lockedOut: false,
    elapsed: 0,
    id: '',
    label: '',
    role: 'MAIN',
    state: 'OPEN',
  };

  if (topology === 'TWO_SOURCE') {
    return [
      { ...base, id: '52-M1', label: '52-M1', role: 'MAIN', state: 'CLOSED' },
      { ...base, id: '52-M2', label: '52-M2', role: 'MAIN', state: 'OPEN' },
    ];
  }
  if (topology === 'MTM') {
    return [
      { ...base, id: '52-M1', label: '52-M1', role: 'MAIN', state: 'CLOSED' },
      { ...base, id: '52-T', label: '52-T', role: 'TIE', state: 'OPEN' },
      { ...base, id: '52-M2', label: '52-M2', role: 'MAIN', state: 'OPEN' },
    ];
  }
  // MMM
  return [
    { ...base, id: '52-M1', label: '52-M1', role: 'MAIN', state: 'CLOSED' },
    { ...base, id: '52-T1', label: '52-T1', role: 'TIE', state: 'OPEN' },
    { ...base, id: '52-T2', label: '52-T2', role: 'TIE', state: 'OPEN' },
    { ...base, id: '52-M3', label: '52-M3', role: 'MAIN', state: 'OPEN' },
  ];
}

function makeBuses(topology: Topology): Bus[] {
  const base: Bus = {
    loadKW: 500,
    energized: false,
    voltage: 0,
    sourceId: null,
    id: '',
    label: '',
  };

  if (topology === 'TWO_SOURCE') {
    return [
      { ...base, id: 'BUS1', label: 'Bus 1', energized: true, voltage: 100, sourceId: 'M1' },
    ];
  }
  if (topology === 'MTM') {
    return [
      { ...base, id: 'BUS1', label: 'Bus 1', energized: true, voltage: 100, sourceId: 'M1' },
      { ...base, id: 'BUS2', label: 'Bus 2', energized: false, voltage: 0, sourceId: null },
    ];
  }
  // MMM
  return [
    { ...base, id: 'BUS1', label: 'Bus 1', energized: true, voltage: 100, sourceId: 'M1' },
    { ...base, id: 'BUS2', label: 'Bus 2', energized: true, voltage: 100, sourceId: 'M2' },
    { ...base, id: 'BUS3', label: 'Bus 3', energized: false, voltage: 0, sourceId: null },
  ];
}

export function createInitialState(topology: Topology, transferMode: TransferMode): SimState {
  const sources = makeSources(topology);
  const breakers = makeBreakers(topology);
  const buses = makeBuses(topology);

  const sourceHealth: Record<string, SourceHealth> = {};
  const sourceFaults: Record<string, string[]> = {};
  for (const s of sources) {
    sourceHealth[s.id] = 'HEALTHY';
    sourceFaults[s.id] = [];
  }

  const initialSchemeState = 'NORMAL_M1' as const;

  return {
    topology,
    transferMode,
    simTimeMs: 0,
    isRunning: false,
    speed: 1,
    isPaused: false,
    sources,
    breakers,
    buses,
    schemeState: initialSchemeState,
    setpoints: { ...DEFAULT_SETPOINTS },
    activeTimers: [],
    events: [
      {
        id: Math.random().toString(36).slice(2),
        simTimeMs: 0,
        severity: 'INFO',
        message: `Simulation initialized: ${topology} / ${transferMode}`,
      },
    ],
    transferCount: 0,
    transferHistory: [],
    lockoutActive: false,
    parallelStartMs: null,
    sourceHealth,
    sourceFaults,
    pickupTimers: [],
    schemeTimers: [],
    prevSchemeState: initialSchemeState,
    retransferPending: false,
    retransferTimerMs: 0,
    lastLiveSource: 'M1',
  };
}

export function stepSimulation(
  state: SimState,
  dtMs: number,
  pendingScenarioEvents?: ScenarioEvent[]
): SimState {
  let s = state;

  // Apply scenario events first
  if (pendingScenarioEvents && pendingScenarioEvents.length > 0) {
    const result = applyScenarioEvents(s, pendingScenarioEvents);
    s = result.state;
    // Note: caller must track the remaining events separately
  }

  return tickScheme(s, dtMs);
}
