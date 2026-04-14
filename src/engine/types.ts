export type Topology = 'TWO_SOURCE' | 'MTM' | 'MMM';
export type TransferMode = 'OPEN_TRANSITION' | 'CLOSED_TRANSITION' | 'FAST_TRANSFER';
export type BreakerState = 'OPEN' | 'CLOSING' | 'CLOSED' | 'TRIPPING';
export type BreakerRole = 'MAIN' | 'TIE';
export type SourceHealth = 'HEALTHY' | 'DEGRADED' | 'FAILED';

export type SchemeState =
  | 'INIT'
  | 'NORMAL_M1'
  | 'NORMAL_M2'
  | 'NORMAL_M3'
  | 'TIE_FROM_M1'
  | 'TIE_FROM_M2'
  | 'TIE_FROM_M3'
  | 'BOTH_DEAD'
  | 'ALL_DEAD'
  | 'PARALLEL'
  | 'LOCKOUT'
  | 'MANUAL_OVERRIDE';

export interface Source {
  id: string;
  label: string;
  nominalVoltage: number;
  nominalFrequency: number;
  voltage: number;       // % of nominal, 0–130
  frequency: number;     // Hz
  phaseAngle: number;    // degrees
  available: boolean;
}

export interface Breaker {
  id: string;
  label: string;
  role: BreakerRole;
  state: BreakerState;
  operationTimeMs: number;
  lockedOut: boolean;
  elapsed: number;       // ms spent in current transient state
}

export interface Bus {
  id: string;
  label: string;
  loadKW: number;
  energized: boolean;
  voltage: number;       // % of nominal
  sourceId: string | null;
}

export interface Setpoints {
  uvThreshold: number;
  uvPickupTime: number;
  ovThreshold: number;
  ovPickupTime: number;
  ufThreshold: number;
  ufPickupTime: number;
  ofThreshold: number;
  ofPickupTime: number;
  transferDelay: number;
  retransferDelay: number;
  syncCheckDV: number;
  syncCheckDf: number;
  syncCheckDPhi: number;
  maxParallelTimeMs: number;
  deadBusThreshold: number;
  deadSourceThreshold: number;
  maxTransfersInWindow: number;
  transferWindowMs: number;
  preferredSource: 'M1' | 'M2' | 'LAST_LIVE';
  autoRetransfer: boolean;
}

export interface ActiveTimer {
  id: string;
  label: string;
  startedAt: number;
  durationMs: number;
  elapsedMs: number;
  complete: boolean;
  active: boolean;
}

export type LogSeverity = 'INFO' | 'WARN' | 'ALARM' | 'ACTION';

export interface LogEvent {
  id: string;
  simTimeMs: number;
  severity: LogSeverity;
  message: string;
  detail?: string;
}

// Internal timer tracking in state
export interface PickupTimer {
  sourceId: string;
  faultType: 'UV' | 'OV' | 'UF' | 'OF';
  elapsedMs: number;
  active: boolean;
  fired: boolean;
}

export interface SchemeTimer {
  id: string;
  label: string;
  elapsedMs: number;
  durationMs: number;
  active: boolean;
  complete: boolean;
}

export interface SimState {
  topology: Topology;
  transferMode: TransferMode;
  simTimeMs: number;
  isRunning: boolean;
  speed: number;
  isPaused: boolean;
  sources: Source[];
  breakers: Breaker[];
  buses: Bus[];
  schemeState: SchemeState;
  setpoints: Setpoints;
  activeTimers: ActiveTimer[];
  events: LogEvent[];
  transferCount: number;
  transferHistory: number[];
  lockoutActive: boolean;
  parallelStartMs: number | null;
  sourceHealth: Record<string, SourceHealth>;
  sourceFaults: Record<string, string[]>;
  pickupTimers: PickupTimer[];
  schemeTimers: SchemeTimer[];
  // Track the previous scheme state for detecting changes
  prevSchemeState: SchemeState;
  // For retransfer tracking
  retransferPending: boolean;
  retransferTimerMs: number;
  // Which source was the "last live" preferred source
  lastLiveSource: string;
}

export interface ScenarioEvent {
  timeMs: number;
  description: string;
  action: (state: SimState) => Partial<SimState>;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  events: ScenarioEvent[];
}
