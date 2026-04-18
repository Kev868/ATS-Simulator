export const GRID_SIZE = 40; // px per grid unit

export const COLORS = {
  energized: "#22c55e",
  deenergized: "#6b7280",
  failed: "#ef4444",
  tripped: "#ef4444",
  locked: "#f59e0b",
  selected: "#3b82f6",
  grid: "#1e293b",
  background: "#0f172a",
  wire: "#6b7280",
  wireEnergized: "#22c55e",
  text: "#e2e8f0",
  textDim: "#94a3b8",
};

export const LINE_WEIGHTS = {
  wire: 2,
  busBar: 4,
  symbol: 2,
  selectedOutline: 2,
};

export const TIMING_DEFAULTS = {
  pickupDelay: 500,
  transferDelay: 100,
  retransferDelay: 10000,
  maxParallelTime: 100,
  lockoutWindow: 60000,
};

export const SETPOINT_DEFAULTS = {
  undervoltagePickup: 85,
  overvoltagePickup: 110,
  underfrequencyPickup: 57,
  overfrequencyPickup: 63,
  syncCheckDeltaV: 5,
  syncCheckDeltaF: 0.5,
  syncCheckDeltaPhi: 10,
};

export const SIM_TICK_MS = 16; // ~60fps real-time tick
