import type { CircuitModel, SchemeSettings } from './types';
import { TIMING_DEFAULTS, SETPOINT_DEFAULTS } from './constants';

const DEFAULT_SCHEME_SETTINGS: SchemeSettings = {
  transferMode: "open-transition",
  preferredSourceId: null,
  undervoltagePickup: SETPOINT_DEFAULTS.undervoltagePickup,
  overvoltagePickup: SETPOINT_DEFAULTS.overvoltagePickup,
  underfrequencyPickup: SETPOINT_DEFAULTS.underfrequencyPickup,
  overfrequencyPickup: SETPOINT_DEFAULTS.overfrequencyPickup,
  pickupDelay: TIMING_DEFAULTS.pickupDelay,
  transferDelay: TIMING_DEFAULTS.transferDelay,
  retransferDelay: TIMING_DEFAULTS.retransferDelay,
  autoRetransfer: true,
  syncCheckDeltaV: SETPOINT_DEFAULTS.syncCheckDeltaV,
  syncCheckDeltaF: SETPOINT_DEFAULTS.syncCheckDeltaF,
  syncCheckDeltaPhi: SETPOINT_DEFAULTS.syncCheckDeltaPhi,
  maxParallelTime: TIMING_DEFAULTS.maxParallelTime,
  lockoutAfterN: 3,
  lockoutWindow: TIMING_DEFAULTS.lockoutWindow,
};

export function createEmptyCircuit(name = "Untitled Circuit"): CircuitModel {
  return {
    version: "2.0",
    name,
    components: [],
    wires: [],
    schemeSettings: { ...DEFAULT_SCHEME_SETTINGS },
  };
}

export function serializeCircuit(model: CircuitModel): string {
  return JSON.stringify(model, null, 2);
}

export function deserializeCircuit(json: string): CircuitModel {
  const raw = JSON.parse(json);
  return migrateCircuit(raw);
}

function migrateCircuit(raw: unknown): CircuitModel {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error("Invalid circuit data: not an object");
  }
  const data = raw as Record<string, unknown>;

  // Version migration: if not 2.0, try to handle it
  if (data.version !== "2.0") {
    throw new Error(`Unsupported circuit version: ${data.version}`);
  }

  // Merge scheme settings with defaults (handles missing fields from older saves)
  const scheme = (data.schemeSettings ?? {}) as Partial<SchemeSettings>;
  const mergedScheme: SchemeSettings = { ...DEFAULT_SCHEME_SETTINGS, ...scheme };

  return {
    version: "2.0",
    name: (data.name as string) ?? "Unnamed",
    components: Array.isArray(data.components) ? data.components : [],
    wires: Array.isArray(data.wires) ? data.wires : [],
    schemeSettings: mergedScheme,
  };
}

export function cloneCircuit(model: CircuitModel): CircuitModel {
  return deserializeCircuit(serializeCircuit(model));
}
