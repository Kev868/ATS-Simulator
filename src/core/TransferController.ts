import type { CircuitModel, SimEvent, SchemeSettings, CircuitComponent } from './types';
import { COMPONENT_REGISTRY } from './ComponentRegistry';

export type TransferState =
  | "NORMAL"
  | "PICKUP_TIMING"
  | "SOURCE_FAILED"
  | "TRANSFER_DELAY"
  | "TRANSFERRING"
  | "TRANSFERRED"
  | "RETRANSFER_TIMING"
  | "RETRANSFERRING"
  | "LOCKED_OUT";

export interface TransferControllerState {
  fsm: TransferState;
  timingAccumMs: number;
  failedSourceId: string | null;
  activeSourceId: string | null;
  transferWindowEvents: number[];
  transferCount: number;
}

export function createTransferControllerState(): TransferControllerState {
  return {
    fsm: "NORMAL",
    timingAccumMs: 0,
    failedSourceId: null,
    activeSourceId: null,
    transferWindowEvents: [],
    transferCount: 0,
  };
}

function isSourceHealthy(comp: CircuitComponent, settings: SchemeSettings): boolean {
  if (comp.state.failed) return false;
  const nomFreq = comp.properties.nominalFrequency ?? 60;
  if (comp.state.voltagePercent < settings.undervoltagePickup) return false;
  if (comp.state.voltagePercent > settings.overvoltagePickup) return false;
  if (comp.state.frequencyHz < nomFreq - (nomFreq - settings.underfrequencyPickup)) return false;
  if (comp.state.frequencyHz > nomFreq + (settings.overfrequencyPickup - nomFreq)) return false;
  return true;
}

function getSources(model: CircuitModel): CircuitComponent[] {
  return model.components.filter((c) => COMPONENT_REGISTRY[c.type].isSource);
}

function getBreakerFor(model: CircuitModel, sourceId: string): CircuitComponent | null {
  // Find a breaker whose line port is wired to the source's output port
  const sourceWires = model.wires.filter(
    (w) => w.fromComponentId === sourceId || w.toComponentId === sourceId,
  );
  for (const wire of sourceWires) {
    const breakerId = wire.fromComponentId === sourceId ? wire.toComponentId : wire.fromComponentId;
    const breaker = model.components.find((c) => c.id === breakerId && c.type === "circuit-breaker");
    if (breaker) return breaker;
  }
  return null;
}

function getAlternateSource(
  model: CircuitModel,
  failedId: string,
  settings: SchemeSettings,
): CircuitComponent | null {
  const sources = getSources(model);
  // Prefer the configured preferred source if it's not the failed one
  if (settings.preferredSourceId && settings.preferredSourceId !== failedId) {
    const pref = model.components.find((c) => c.id === settings.preferredSourceId);
    if (pref && isSourceHealthy(pref, settings)) return pref;
  }
  // Otherwise pick any healthy non-failed source
  return sources.find((s) => s.id !== failedId && isSourceHealthy(s, settings)) ?? null;
}

function syncCheckPass(source: CircuitComponent, active: CircuitComponent, settings: SchemeSettings): boolean {
  const deltaV = Math.abs(source.state.voltagePercent - active.state.voltagePercent);
  const deltaF = Math.abs(source.state.frequencyHz - active.state.frequencyHz);
  const deltaPhi = Math.abs(source.state.phaseAngleDeg - active.state.phaseAngleDeg);
  return deltaV <= settings.syncCheckDeltaV &&
    deltaF <= settings.syncCheckDeltaF &&
    deltaPhi <= settings.syncCheckDeltaPhi;
}

export function tickTransferController(
  model: CircuitModel,
  ctrlState: TransferControllerState,
  simTimeMs: number,
  deltaMs: number,
): SimEvent[] {
  const events: SimEvent[] = [];
  const settings = model.schemeSettings;

  const emit = (type: SimEvent["type"], tag: string, message: string) => {
    events.push({ timestamp: simTimeMs, type, componentTag: tag, message });
  };

  const openBreaker = (comp: CircuitComponent) => {
    if (comp.state.closed) {
      comp.state.closed = false;
      emit("BREAKER_OPENED", comp.tag, `${comp.tag} opened`);
    }
  };

  const closeBreaker = (comp: CircuitComponent) => {
    if (!comp.state.closed && !comp.state.locked && !comp.state.tripped) {
      comp.state.closed = true;
      emit("BREAKER_CLOSED", comp.tag, `${comp.tag} closed`);
    }
  };

  const sources = getSources(model);

  // Clean old events outside the lockout window
  ctrlState.transferWindowEvents = ctrlState.transferWindowEvents.filter(
    (t) => simTimeMs - t < settings.lockoutWindow,
  );

  switch (ctrlState.fsm) {
    case "NORMAL": {
      // Determine which source is active (has closed breaker)
      if (!ctrlState.activeSourceId) {
        const preferred = settings.preferredSourceId
          ? model.components.find((c) => c.id === settings.preferredSourceId)
          : sources[0];
        if (preferred) ctrlState.activeSourceId = preferred.id;
      }

      // Monitor active source
      const activeSource = model.components.find((c) => c.id === ctrlState.activeSourceId);
      if (activeSource && !isSourceHealthy(activeSource, settings)) {
        ctrlState.fsm = "PICKUP_TIMING";
        ctrlState.timingAccumMs = 0;
        ctrlState.failedSourceId = activeSource.id;
        emit("SOURCE_UNHEALTHY", activeSource.tag, `${activeSource.tag} fell below pickup threshold`);
      }
      break;
    }

    case "PICKUP_TIMING": {
      ctrlState.timingAccumMs += deltaMs;
      const failedSource = model.components.find((c) => c.id === ctrlState.failedSourceId);

      if (failedSource && isSourceHealthy(failedSource, settings)) {
        // Ride-through
        ctrlState.fsm = "NORMAL";
        ctrlState.timingAccumMs = 0;
        ctrlState.failedSourceId = null;
        emit("SOURCE_HEALTHY", failedSource.tag, `${failedSource.tag} restored — ride-through`);
        break;
      }

      if (ctrlState.timingAccumMs >= settings.pickupDelay) {
        ctrlState.fsm = "SOURCE_FAILED";
        ctrlState.timingAccumMs = 0;
        if (failedSource) {
          failedSource.state.failed = true;
          emit("SOURCE_FAILED", failedSource.tag, `${failedSource.tag} declared failed after pickup delay`);
        }
      }
      break;
    }

    case "SOURCE_FAILED": {
      ctrlState.fsm = "TRANSFER_DELAY";
      ctrlState.timingAccumMs = 0;
      emit("TRANSFER_INITIATED", "ATS", `Transfer initiated, waiting transfer delay`);
      break;
    }

    case "TRANSFER_DELAY": {
      ctrlState.timingAccumMs += deltaMs;
      if (ctrlState.timingAccumMs >= settings.transferDelay) {
        ctrlState.fsm = "TRANSFERRING";
        ctrlState.timingAccumMs = 0;
      }
      break;
    }

    case "TRANSFERRING": {
      const failedSource = model.components.find((c) => c.id === ctrlState.failedSourceId);
      const altSource = getAlternateSource(model, ctrlState.failedSourceId ?? "", settings);

      if (!altSource) {
        emit("WARNING", "ATS", "No alternate source available — transfer aborted");
        ctrlState.fsm = "NORMAL";
        break;
      }

      const failedBreaker = failedSource ? getBreakerFor(model, failedSource.id) : null;
      const altBreaker = getBreakerFor(model, altSource.id);

      if (!altBreaker) {
        emit("WARNING", "ATS", `No breaker found for alternate source ${altSource.tag}`);
        ctrlState.fsm = "NORMAL";
        break;
      }

      if (settings.transferMode === "open-transition" || settings.transferMode === "fast-transfer") {
        if (failedBreaker) openBreaker(failedBreaker);
        closeBreaker(altBreaker);
        ctrlState.activeSourceId = altSource.id;
        ctrlState.transferWindowEvents.push(simTimeMs);
        ctrlState.transferCount += 1;
        emit("TRANSFER_COMPLETE", altSource.tag, `Transfer complete — now on ${altSource.tag}`);
        ctrlState.fsm = "TRANSFERRED";

        if (ctrlState.transferWindowEvents.length >= settings.lockoutAfterN) {
          ctrlState.fsm = "LOCKED_OUT";
          emit("LOCKOUT_ACTIVATED", "ATS", `Lockout activated after ${settings.lockoutAfterN} transfers`);
        }
      } else if (settings.transferMode === "closed-transition") {
        const activeSource = model.components.find((c) => c.id === ctrlState.activeSourceId);
        if (activeSource && syncCheckPass(altSource, activeSource, settings)) {
          emit("SYNC_CHECK_PASS", "ATS", `Sync check passed`);
          closeBreaker(altBreaker);
          // Momentary parallel — open failed side immediately
          if (failedBreaker) openBreaker(failedBreaker);
          ctrlState.activeSourceId = altSource.id;
          ctrlState.transferWindowEvents.push(simTimeMs);
          emit("TRANSFER_COMPLETE", altSource.tag, `Closed-transition transfer complete — now on ${altSource.tag}`);
          ctrlState.fsm = "TRANSFERRED";

          if (ctrlState.transferWindowEvents.length >= settings.lockoutAfterN) {
            ctrlState.fsm = "LOCKED_OUT";
            emit("LOCKOUT_ACTIVATED", "ATS", `Lockout activated after ${settings.lockoutAfterN} transfers`);
          }
        } else {
          emit("SYNC_CHECK_FAIL", "ATS", `Sync check failed — falling back to open transition`);
          if (failedBreaker) openBreaker(failedBreaker);
          closeBreaker(altBreaker);
          ctrlState.activeSourceId = altSource.id;
          ctrlState.transferWindowEvents.push(simTimeMs);
          emit("TRANSFER_COMPLETE", altSource.tag, `Open-transition fallback transfer complete`);
          ctrlState.fsm = "TRANSFERRED";
        }
      }
      break;
    }

    case "TRANSFERRED": {
      if (!settings.autoRetransfer) break;
      const preferredId = settings.preferredSourceId;
      if (!preferredId || preferredId === ctrlState.activeSourceId) break;

      const preferred = model.components.find((c) => c.id === preferredId);
      if (preferred && isSourceHealthy(preferred, settings)) {
        ctrlState.fsm = "RETRANSFER_TIMING";
        ctrlState.timingAccumMs = 0;
        emit("SOURCE_RESTORED", preferred.tag, `${preferred.tag} restored — starting retransfer timer`);
      }
      break;
    }

    case "RETRANSFER_TIMING": {
      ctrlState.timingAccumMs += deltaMs;
      if (ctrlState.timingAccumMs >= settings.retransferDelay) {
        ctrlState.fsm = "RETRANSFERRING";
        ctrlState.timingAccumMs = 0;
        emit("RETRANSFER_INITIATED", "ATS", `Retransfer initiated`);
      }
      break;
    }

    case "RETRANSFERRING": {
      const preferredId = settings.preferredSourceId;
      if (!preferredId) {
        ctrlState.fsm = "NORMAL";
        break;
      }
      const preferred = model.components.find((c) => c.id === preferredId);
      const activeSource = model.components.find((c) => c.id === ctrlState.activeSourceId);

      if (!preferred || !isSourceHealthy(preferred, settings)) {
        ctrlState.fsm = "TRANSFERRED";
        break;
      }

      const prefBreaker = getBreakerFor(model, preferred.id);
      const activeBreaker = activeSource ? getBreakerFor(model, activeSource.id) : null;

      if (prefBreaker) closeBreaker(prefBreaker);
      if (activeBreaker && activeSource?.id !== preferredId) openBreaker(activeBreaker);

      if (preferred) preferred.state.failed = false;
      ctrlState.activeSourceId = preferredId;
      ctrlState.failedSourceId = null;
      emit("RETRANSFER_COMPLETE", preferred.tag, `Retransfer complete — back on ${preferred.tag}`);
      ctrlState.fsm = "NORMAL";
      break;
    }

    case "LOCKED_OUT": {
      // Frozen — no automatic action
      break;
    }
  }

  return events;
}

