import {
  SimState,
  Breaker,
  Source,
  Bus,
  LogEvent,
  LogSeverity,
  SchemeState,
  PickupTimer,
  SchemeTimer,
  SourceHealth,
  ActiveTimer,
} from './types';
import { tickBreaker, openBreaker, closeBreaker, isClosed } from './breakerFSM';
import { evaluateSource, isDead } from './sourceMonitor';
import { checkSync } from './syncCheck';

// ─── Helpers ────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2);
}

function addLog(
  events: LogEvent[],
  simTimeMs: number,
  severity: LogSeverity,
  message: string,
  detail?: string
): LogEvent[] {
  const entry: LogEvent = {
    id: uid(),
    simTimeMs,
    severity,
    message,
    detail,
  };
  // Keep last 500 events
  const next = [...events, entry];
  return next.length > 500 ? next.slice(next.length - 500) : next;
}

function findBreaker(breakers: Breaker[], id: string): Breaker | undefined {
  return breakers.find(b => b.id === id);
}

function updateBreaker(breakers: Breaker[], id: string, updater: (b: Breaker) => Breaker): Breaker[] {
  return breakers.map(b => (b.id === id ? updater(b) : b));
}

function findSource(sources: Source[], id: string): Source | undefined {
  return sources.find(s => s.id === id);
}

// ─── Pickup Timer Logic ──────────────────────────────────────────────────────

function updatePickupTimers(
  timers: PickupTimer[],
  sourceId: string,
  faultType: PickupTimer['faultType'],
  isActive: boolean,
  durationMs: number,
  dt: number
): { timers: PickupTimer[]; justFired: boolean } {
  let justFired = false;
  const existing = timers.find(t => t.sourceId === sourceId && t.faultType === faultType);

  if (!isActive) {
    // Reset the timer
    if (!existing || (!existing.active && existing.elapsedMs === 0)) {
      return { timers, justFired: false };
    }
    return {
      timers: timers.map(t =>
        t.sourceId === sourceId && t.faultType === faultType
          ? { ...t, active: false, elapsedMs: 0, fired: false }
          : t
      ),
      justFired: false,
    };
  }

  // Fault is active
  if (!existing) {
    const newTimer: PickupTimer = {
      sourceId,
      faultType,
      elapsedMs: dt,
      active: true,
      fired: false,
    };
    return { timers: [...timers, newTimer], justFired: false };
  }

  if (existing.fired) {
    // Already fired, keep it
    return { timers, justFired: false };
  }

  const newElapsed = existing.elapsedMs + dt;
  if (newElapsed >= durationMs) {
    justFired = true;
    return {
      timers: timers.map(t =>
        t.sourceId === sourceId && t.faultType === faultType
          ? { ...t, active: true, elapsedMs: newElapsed, fired: true }
          : t
      ),
      justFired,
    };
  }

  return {
    timers: timers.map(t =>
      t.sourceId === sourceId && t.faultType === faultType
        ? { ...t, active: true, elapsedMs: newElapsed }
        : t
    ),
    justFired: false,
  };
}

function isPickupFired(timers: PickupTimer[], sourceId: string, faultType: PickupTimer['faultType']): boolean {
  const t = timers.find(pt => pt.sourceId === sourceId && pt.faultType === faultType);
  return t?.fired ?? false;
}

function resetPickupTimersForSource(timers: PickupTimer[], sourceId: string): PickupTimer[] {
  return timers.map(t => (t.sourceId === sourceId ? { ...t, active: false, elapsedMs: 0, fired: false } : t));
}

// ─── Scheme Timer Logic ──────────────────────────────────────────────────────

function getSchemeTimer(timers: SchemeTimer[], id: string): SchemeTimer | undefined {
  return timers.find(t => t.id === id);
}

function startSchemeTimer(timers: SchemeTimer[], id: string, label: string, durationMs: number): SchemeTimer[] {
  const existing = timers.find(t => t.id === id);
  if (existing && existing.active) return timers; // already running
  const newTimer: SchemeTimer = { id, label, elapsedMs: 0, durationMs, active: true, complete: false };
  if (existing) {
    return timers.map(t => (t.id === id ? newTimer : t));
  }
  return [...timers, newTimer];
}

function cancelSchemeTimer(timers: SchemeTimer[], id: string): SchemeTimer[] {
  return timers.filter(t => t.id !== id);
}

function tickSchemeTimers(timers: SchemeTimer[], dt: number): SchemeTimer[] {
  return timers.map(t => {
    if (!t.active || t.complete) return t;
    const newElapsed = t.elapsedMs + dt;
    if (newElapsed >= t.durationMs) {
      return { ...t, elapsedMs: newElapsed, complete: true };
    }
    return { ...t, elapsedMs: newElapsed };
  });
}

function isTimerComplete(timers: SchemeTimer[], id: string): boolean {
  const t = timers.find(st => st.id === id);
  return t?.complete ?? false;
}

function isTimerActive(timers: SchemeTimer[], id: string): boolean {
  const t = timers.find(st => st.id === id);
  return (t?.active && !t?.complete) ?? false;
}

// ─── Bus Energization ────────────────────────────────────────────────────────

function computeBusStates(state: SimState): Bus[] {
  const { topology, breakers, sources, setpoints, buses } = state;

  const getBreaker = (id: string) => findBreaker(breakers, id);
  const getSource = (id: string) => findSource(sources, id);

  const sourceAlive = (id: string): boolean => {
    const src = getSource(id);
    if (!src) return false;
    return !isDead(src, setpoints) && src.available;
  };

  const breakerClosed = (id: string): boolean => {
    const br = getBreaker(id);
    return br ? isClosed(br) : false;
  };

  if (topology === 'TWO_SOURCE') {
    const m1Closed = breakerClosed('52-M1');
    const m2Closed = breakerClosed('52-M2');
    const m1Live = sourceAlive('M1');
    const m2Live = sourceAlive('M2');

    let energized = false;
    let sourceId: string | null = null;
    let voltage = 0;

    if (m1Closed && m1Live) {
      energized = true;
      sourceId = 'M1';
      voltage = getSource('M1')?.voltage ?? 0;
    } else if (m2Closed && m2Live) {
      energized = true;
      sourceId = 'M2';
      voltage = getSource('M2')?.voltage ?? 0;
    }

    return buses.map(b =>
      b.id === 'BUS1'
        ? { ...b, energized, voltage, sourceId }
        : b
    );
  }

  if (topology === 'MTM') {
    const m1Closed = breakerClosed('52-M1');
    const tClosed = breakerClosed('52-T');
    const m2Closed = breakerClosed('52-M2');
    const m1Live = sourceAlive('M1');
    const m2Live = sourceAlive('M2');

    // Bus1: fed by M1 directly, or via tie from M2
    // Bus2: fed by M2 directly, or via tie from M1
    let bus1Energized = false;
    let bus1Source: string | null = null;
    let bus1Voltage = 0;

    let bus2Energized = false;
    let bus2Source: string | null = null;
    let bus2Voltage = 0;

    if (m1Closed && m1Live) {
      bus1Energized = true;
      bus1Source = 'M1';
      bus1Voltage = getSource('M1')?.voltage ?? 0;
    }

    if (m2Closed && m2Live) {
      bus2Energized = true;
      bus2Source = 'M2';
      bus2Voltage = getSource('M2')?.voltage ?? 0;
    }

    // Tie connects buses
    if (tClosed) {
      if (bus1Energized && !bus2Energized) {
        bus2Energized = true;
        bus2Source = bus1Source;
        bus2Voltage = bus1Voltage;
      } else if (bus2Energized && !bus1Energized) {
        bus1Energized = true;
        bus1Source = bus2Source;
        bus1Voltage = bus2Voltage;
      }
    }

    return buses.map(b => {
      if (b.id === 'BUS1') return { ...b, energized: bus1Energized, voltage: bus1Voltage, sourceId: bus1Source };
      if (b.id === 'BUS2') return { ...b, energized: bus2Energized, voltage: bus2Voltage, sourceId: bus2Source };
      return b;
    });
  }

  if (topology === 'MMM') {
    const m1Closed = breakerClosed('52-M1');
    const t1Closed = breakerClosed('52-T1');
    const t2Closed = breakerClosed('52-T2');
    const m3Closed = breakerClosed('52-M3');
    const m1Live = sourceAlive('M1');
    const m2Live = sourceAlive('M2');
    const m3Live = sourceAlive('M3');

    // For MMM, there's no 52-M2 — Bus2 is fed by T1 or T2 connections
    // Actually in MMM: M1-Bus1-T1-Bus2-T2-Bus3-M3
    // M2 feeds Bus2 directly (there's no 52-M2 breaker - Bus2 is the middle bus)
    // Wait, let me re-read. The spec says: 3 sources M1,M2,M3, 4 breakers: 52-M1, 52-T1, 52-T2, 52-M3
    // So M2 feeds... it's the bus sectionalizer. Bus2 is in the middle.
    // Normal: M1 closed feeding Bus1, M3 closed feeding Bus3, T1 and T2 open.
    // M2 is actually the source for Bus2 in normal? No - re-reading:
    // "Normal state has all mains closed, ties open (bus sectionalized)"
    // But there are only 4 breakers. Let me reconsider:
    // The 3 sources are at Bus1(M1), Bus2(M2?), Bus3(M3)
    // But no 52-M2 breaker. So M2 is always connected to Bus2.
    // Ties T1 connects Bus1↔Bus2, T2 connects Bus2↔Bus3.

    let bus1Energized = false;
    let bus1Source: string | null = null;
    let bus1Voltage = 0;

    let bus2Energized = false;
    let bus2Source: string | null = null;
    let bus2Voltage = 0;

    let bus3Energized = false;
    let bus3Source: string | null = null;
    let bus3Voltage = 0;

    if (m1Closed && m1Live) {
      bus1Energized = true;
      bus1Source = 'M1';
      bus1Voltage = getSource('M1')?.voltage ?? 0;
    }

    // M2 feeds bus2 directly (no breaker)
    if (m2Live) {
      bus2Energized = true;
      bus2Source = 'M2';
      bus2Voltage = getSource('M2')?.voltage ?? 0;
    }

    if (m3Closed && m3Live) {
      bus3Energized = true;
      bus3Source = 'M3';
      bus3Voltage = getSource('M3')?.voltage ?? 0;
    }

    // T1 connects Bus1 ↔ Bus2
    if (t1Closed) {
      if (bus1Energized && !bus2Energized) {
        bus2Energized = true;
        bus2Source = bus1Source;
        bus2Voltage = bus1Voltage;
      } else if (bus2Energized && !bus1Energized) {
        bus1Energized = true;
        bus1Source = bus2Source;
        bus1Voltage = bus2Voltage;
      }
    }

    // T2 connects Bus2 ↔ Bus3
    if (t2Closed) {
      if (bus2Energized && !bus3Energized) {
        bus3Energized = true;
        bus3Source = bus2Source;
        bus3Voltage = bus2Voltage;
      } else if (bus3Energized && !bus2Energized) {
        bus2Energized = true;
        bus2Source = bus3Source;
        bus2Voltage = bus3Voltage;
      }
    }

    // Second pass if T1 and T2 both closed: propagate
    if (t1Closed && t2Closed) {
      // If any bus is energized, all connected buses get energy
      const anyEnergized = bus1Energized || bus2Energized || bus3Energized;
      if (anyEnergized) {
        // Find the priority source
        let primarySource: string | null = bus1Source || bus2Source || bus3Source;
        let primaryVoltage = bus1Energized ? bus1Voltage : bus2Energized ? bus2Voltage : bus3Voltage;

        bus1Energized = true; bus1Source = primarySource; bus1Voltage = primaryVoltage;
        bus2Energized = true; bus2Source = primarySource; bus2Voltage = primaryVoltage;
        bus3Energized = true; bus3Source = primarySource; bus3Voltage = primaryVoltage;
      }
    }

    return buses.map(b => {
      if (b.id === 'BUS1') return { ...b, energized: bus1Energized, voltage: bus1Voltage, sourceId: bus1Source };
      if (b.id === 'BUS2') return { ...b, energized: bus2Energized, voltage: bus2Voltage, sourceId: bus2Source };
      if (b.id === 'BUS3') return { ...b, energized: bus3Energized, voltage: bus3Voltage, sourceId: bus3Source };
      return b;
    });
  }

  return buses;
}

// ─── Interlock Checks ────────────────────────────────────────────────────────

function checkMTMInterlock(breakers: Breaker[], closingId: string): boolean {
  // Never allow 52-M1, 52-T, 52-M2 all closed simultaneously (outside PARALLEL)
  const afterClose = breakers.map(b => (b.id === closingId ? { ...b, state: 'CLOSED' as const } : b));
  const m1 = findBreaker(afterClose, '52-M1');
  const tie = findBreaker(afterClose, '52-T');
  const m2 = findBreaker(afterClose, '52-M2');
  if (m1 && tie && m2) {
    return isClosed(m1) && isClosed(tie) && isClosed(m2);
  }
  return false;
}

function checkMMMInterlock(breakers: Breaker[], closingId: string): boolean {
  // Never allow a configuration that creates a loop or parallels incompatible sources
  // Main rule: at most 2 of {52-M1, 52-T1, 52-T2, 52-M3} can feed the same bus
  // Simplified: T1 and T2 closed + M1 and M3 closed would parallel M1 and M3 (different sources)
  const afterClose = breakers.map(b => (b.id === closingId ? { ...b, state: 'CLOSED' as const } : b));
  const m1 = findBreaker(afterClose, '52-M1');
  const t1 = findBreaker(afterClose, '52-T1');
  const t2 = findBreaker(afterClose, '52-T2');
  const m3 = findBreaker(afterClose, '52-M3');

  // If T1 and T2 both closed, M1 and M3 would be paralleled - block
  if (t1 && t2 && m1 && m3) {
    if (isClosed(t1) && isClosed(t2) && isClosed(m1) && isClosed(m3)) {
      return true;
    }
  }
  return false;
}

// ─── Lockout Check ───────────────────────────────────────────────────────────

function checkLockout(state: SimState): boolean {
  const { setpoints, transferHistory, simTimeMs } = state;
  const windowStart = simTimeMs - setpoints.transferWindowMs;
  const recentTransfers = transferHistory.filter(t => t >= windowStart);
  return recentTransfers.length >= setpoints.maxTransfersInWindow;
}

// ─── Source Fault Aggregation ────────────────────────────────────────────────

function sourceHasFiredFault(pickupTimers: PickupTimer[], sourceId: string): boolean {
  return pickupTimers.some(t => t.sourceId === sourceId && t.fired);
}

function sourceIsDead(sources: Source[], setpoints: SimState['setpoints'], sourceId: string): boolean {
  const src = findSource(sources, sourceId);
  if (!src) return true;
  return isDead(src, setpoints);
}

// ─── Transfer Recording ──────────────────────────────────────────────────────

function recordTransfer(state: SimState): SimState {
  const history = [...state.transferHistory, state.simTimeMs];
  // Prune old
  const windowStart = state.simTimeMs - state.setpoints.transferWindowMs;
  const pruned = history.filter(t => t >= windowStart);

  return {
    ...state,
    transferCount: state.transferCount + 1,
    transferHistory: pruned,
  };
}

// ─── MTM Scheme FSM ──────────────────────────────────────────────────────────

function tickMTM(state: SimState, _dt: number): SimState {
  let s = { ...state };
  const { setpoints, simTimeMs } = s;

  const m1Dead = sourceIsDead(s.sources, setpoints, 'M1');
  const m2Dead = sourceIsDead(s.sources, setpoints, 'M2');
  const m1FaultFired = sourceHasFiredFault(s.pickupTimers, 'M1');
  const m2FaultFired = sourceHasFiredFault(s.pickupTimers, 'M2');
  const m1Lost = m1Dead || m1FaultFired;
  const m2Lost = m2Dead || m2FaultFired;

  switch (s.schemeState) {
    case 'NORMAL_M1': {
      // M1 is feeding Bus1. Tie open. M2 open or standby.
      if (m1Lost) {
        // Start transfer delay timer if not running
        if (!isTimerActive(s.schemeTimers, 'XFER_DELAY') && !isTimerComplete(s.schemeTimers, 'XFER_DELAY')) {
          s = { ...s, schemeTimers: startSchemeTimer(s.schemeTimers, 'XFER_DELAY', 'Transfer Delay', setpoints.transferDelay) };
          s = { ...s, events: addLog(s.events, simTimeMs, 'WARN', `M1 fault detected, starting transfer delay ${setpoints.transferDelay}ms`) };
        }
      } else {
        // Clear transfer delay if fault cleared
        if (isTimerActive(s.schemeTimers, 'XFER_DELAY')) {
          s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'XFER_DELAY') };
          s = { ...s, events: addLog(s.events, simTimeMs, 'INFO', 'M1 fault cleared, transfer delay cancelled') };
        }
      }

      if (isTimerComplete(s.schemeTimers, 'XFER_DELAY')) {
        s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'XFER_DELAY') };

        if (checkLockout(s)) {
          s = { ...s, schemeState: 'LOCKOUT', lockoutActive: true };
          s = { ...s, events: addLog(s.events, simTimeMs, 'ALARM', 'LOCKOUT: Too many transfers in window (ANSI 86)') };
          break;
        }

        if (m2Dead) {
          s = { ...s, schemeState: 'BOTH_DEAD' };
          s = { ...s, events: addLog(s.events, simTimeMs, 'ALARM', 'Both sources lost — BOTH_DEAD') };
          break;
        }

        // Execute transfer from M1 to M2 (via Tie)
        s = executeTransferMTM(s, 'M1_TO_M2');
      }
      break;
    }

    case 'NORMAL_M2': {
      if (m2Lost) {
        if (!isTimerActive(s.schemeTimers, 'XFER_DELAY') && !isTimerComplete(s.schemeTimers, 'XFER_DELAY')) {
          s = { ...s, schemeTimers: startSchemeTimer(s.schemeTimers, 'XFER_DELAY', 'Transfer Delay', setpoints.transferDelay) };
          s = { ...s, events: addLog(s.events, simTimeMs, 'WARN', `M2 fault detected, starting transfer delay ${setpoints.transferDelay}ms`) };
        }
      } else {
        if (isTimerActive(s.schemeTimers, 'XFER_DELAY')) {
          s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'XFER_DELAY') };
          s = { ...s, events: addLog(s.events, simTimeMs, 'INFO', 'M2 fault cleared, transfer delay cancelled') };
        }
      }

      if (isTimerComplete(s.schemeTimers, 'XFER_DELAY')) {
        s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'XFER_DELAY') };

        if (checkLockout(s)) {
          s = { ...s, schemeState: 'LOCKOUT', lockoutActive: true };
          s = { ...s, events: addLog(s.events, simTimeMs, 'ALARM', 'LOCKOUT: Too many transfers in window (ANSI 86)') };
          break;
        }

        if (m1Dead) {
          s = { ...s, schemeState: 'BOTH_DEAD' };
          s = { ...s, events: addLog(s.events, simTimeMs, 'ALARM', 'Both sources lost — BOTH_DEAD') };
          break;
        }

        s = executeTransferMTM(s, 'M2_TO_M1');
      }
      break;
    }

    case 'TIE_FROM_M2': {
      // M2 feeding both buses via tie. Check M2 health.
      if (m2Lost) {
        s = { ...s, schemeState: 'BOTH_DEAD' };
        s = { ...s, events: addLog(s.events, simTimeMs, 'ALARM', 'M2 lost while in TIE_FROM_M2 — BOTH_DEAD') };
        // Trip tie breaker
        s = { ...s, breakers: updateBreaker(s.breakers, '52-T', b => openBreaker(b, simTimeMs)) };
        break;
      }

      // Check for auto-retransfer to M1 if M1 is restored
      if (!m1Dead && !m1FaultFired && setpoints.autoRetransfer) {
        const preferred = setpoints.preferredSource;
        const shouldRetransfer =
          preferred === 'M1' ||
          (preferred === 'LAST_LIVE' && s.lastLiveSource === 'M1');

        if (shouldRetransfer) {
          if (!isTimerActive(s.schemeTimers, 'RETRANSFER') && !isTimerComplete(s.schemeTimers, 'RETRANSFER')) {
            s = { ...s, schemeTimers: startSchemeTimer(s.schemeTimers, 'RETRANSFER', 'Retransfer Delay', setpoints.retransferDelay) };
            s = { ...s, events: addLog(s.events, simTimeMs, 'INFO', `M1 restored, retransfer delay ${setpoints.retransferDelay}ms started`) };
          }
        }
      } else {
        // M1 lost again or not healthy, cancel retransfer
        if (isTimerActive(s.schemeTimers, 'RETRANSFER')) {
          s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'RETRANSFER') };
          s = { ...s, events: addLog(s.events, simTimeMs, 'WARN', 'M1 not healthy, retransfer cancelled') };
        }
      }

      if (isTimerComplete(s.schemeTimers, 'RETRANSFER')) {
        s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'RETRANSFER') };
        if (!m1Dead && !m1FaultFired) {
          s = executeRetransferMTM(s, 'RETRANSFER_TO_M1');
        }
      }
      break;
    }

    case 'TIE_FROM_M1': {
      if (m1Lost) {
        s = { ...s, schemeState: 'BOTH_DEAD' };
        s = { ...s, events: addLog(s.events, simTimeMs, 'ALARM', 'M1 lost while in TIE_FROM_M1 — BOTH_DEAD') };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-T', b => openBreaker(b, simTimeMs)) };
        break;
      }

      if (!m2Dead && !m2FaultFired && setpoints.autoRetransfer) {
        const preferred = setpoints.preferredSource;
        const shouldRetransfer =
          preferred === 'M2' ||
          (preferred === 'LAST_LIVE' && s.lastLiveSource === 'M2');

        if (shouldRetransfer) {
          if (!isTimerActive(s.schemeTimers, 'RETRANSFER') && !isTimerComplete(s.schemeTimers, 'RETRANSFER')) {
            s = { ...s, schemeTimers: startSchemeTimer(s.schemeTimers, 'RETRANSFER', 'Retransfer Delay', setpoints.retransferDelay) };
            s = { ...s, events: addLog(s.events, simTimeMs, 'INFO', `M2 restored, retransfer delay ${setpoints.retransferDelay}ms started`) };
          }
        }
      } else {
        if (isTimerActive(s.schemeTimers, 'RETRANSFER')) {
          s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'RETRANSFER') };
        }
      }

      if (isTimerComplete(s.schemeTimers, 'RETRANSFER')) {
        s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'RETRANSFER') };
        if (!m2Dead && !m2FaultFired) {
          s = executeRetransferMTM(s, 'RETRANSFER_TO_M2');
        }
      }
      break;
    }

    case 'BOTH_DEAD': {
      // Wait for a source to restore
      if (!m1Dead && !m1FaultFired) {
        s = { ...s, events: addLog(s.events, simTimeMs, 'INFO', 'M1 restored from BOTH_DEAD, transferring') };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-T', b => openBreaker(b, simTimeMs)) };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-M2', b => openBreaker(b, simTimeMs)) };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-M1', b => closeBreaker(b, simTimeMs)) };
        s = { ...s, schemeState: 'NORMAL_M1' };
      } else if (!m2Dead && !m2FaultFired) {
        s = { ...s, events: addLog(s.events, simTimeMs, 'INFO', 'M2 restored from BOTH_DEAD, transferring') };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-T', b => openBreaker(b, simTimeMs)) };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-M1', b => openBreaker(b, simTimeMs)) };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-M2', b => closeBreaker(b, simTimeMs)) };
        s = { ...s, schemeState: 'NORMAL_M2' };
      }
      break;
    }

    case 'PARALLEL': {
      // Parallel state — closed transition in progress
      const tClosed = isClosed(findBreaker(s.breakers, '52-T') ?? { state: 'OPEN' } as Breaker);
      const parallelTimer = getSchemeTimer(s.schemeTimers, 'PARALLEL_TIMER');

      if (parallelTimer) {
        if (parallelTimer.complete || (s.parallelStartMs !== null && simTimeMs - s.parallelStartMs >= setpoints.maxParallelTimeMs)) {
          // Trip the source we're transferring away from
          const tripTarget = s.schemeTimers.find(t => t.id === 'PARALLEL_TRIP_M1') ? 'M1' : 'M2';
          const tripId = tripTarget === 'M1' ? '52-M1' : '52-M2';
          const nextState: SchemeState = tripTarget === 'M1' ? 'TIE_FROM_M2' : 'TIE_FROM_M1';

          s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'PARALLEL_TIMER') };
          s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'PARALLEL_TRIP_M1') };
          s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'PARALLEL_TRIP_M2') };
          s = { ...s, breakers: updateBreaker(s.breakers, tripId, b => openBreaker(b, simTimeMs)) };
          s = { ...s, schemeState: nextState, parallelStartMs: null };
          s = { ...s, events: addLog(s.events, simTimeMs, 'ACTION', `Closed transition complete: tripped ${tripId}, now ${nextState}`) };
          s = recordTransfer(s);
        }
      } else if (!tClosed) {
        // Tie failed to close, abort
        s = { ...s, schemeState: 'NORMAL_M1', parallelStartMs: null };
        s = { ...s, events: addLog(s.events, simTimeMs, 'ALARM', 'Parallel state aborted: tie not closed') };
      }
      break;
    }

    case 'LOCKOUT': {
      // Stay in lockout until manually reset
      break;
    }

    default:
      break;
  }

  return s;
}

function executeTransferMTM(state: SimState, direction: 'M1_TO_M2' | 'M2_TO_M1'): SimState {
  let s = { ...state };
  const { simTimeMs, transferMode, setpoints } = s;

  const fromId = direction === 'M1_TO_M2' ? '52-M1' : '52-M2';
  const toId = direction === 'M1_TO_M2' ? '52-M2' : '52-M1';
  const nextState: SchemeState = direction === 'M1_TO_M2' ? 'TIE_FROM_M2' : 'TIE_FROM_M1';
  const fromSourceId = direction === 'M1_TO_M2' ? 'M1' : 'M2';
  const toSource = direction === 'M1_TO_M2'
    ? findSource(s.sources, 'M2')
    : findSource(s.sources, 'M1');
  const fromSource = direction === 'M1_TO_M2'
    ? findSource(s.sources, 'M1')
    : findSource(s.sources, 'M2');

  s = { ...s, events: addLog(s.events, simTimeMs, 'ACTION', `Initiating ${transferMode} transfer from ${fromSourceId}`) };

  if (transferMode === 'CLOSED_TRANSITION') {
    // Check sync
    if (toSource && fromSource && !isDead(toSource, setpoints)) {
      const syncResult = checkSync(fromSource, toSource, setpoints);
      if (!syncResult.pass) {
        s = { ...s, events: addLog(s.events, simTimeMs, 'ALARM', `Sync check failed (ANSI 25): ${syncResult.reason}`) };
        s = { ...s, events: addLog(s.events, simTimeMs, 'WARN', 'Falling back to OPEN_TRANSITION') };
        // Fall back to open transition
        return executeOpenTransition(s, fromId, nextState, direction);
      }
      // Close tie first, then open main
      s = { ...s, breakers: updateBreaker(s.breakers, '52-T', b => closeBreaker(b, simTimeMs)) };
      s = { ...s, schemeState: 'PARALLEL', parallelStartMs: simTimeMs };
      const tripTimerId = direction === 'M1_TO_M2' ? 'PARALLEL_TRIP_M1' : 'PARALLEL_TRIP_M2';
      s = { ...s, schemeTimers: startSchemeTimer(s.schemeTimers, 'PARALLEL_TIMER', 'Parallel Timer', setpoints.maxParallelTimeMs) };
      s = { ...s, schemeTimers: startSchemeTimer(s.schemeTimers, tripTimerId, `Trip ${fromId}`, setpoints.maxParallelTimeMs) };
      s = { ...s, events: addLog(s.events, simTimeMs, 'ACTION', `Sync OK, closed tie 52-T, entering PARALLEL state`) };
      s = { ...s, lastLiveSource: toSource.id };
      return s;
    } else {
      // To source is dead, fall back
      s = { ...s, events: addLog(s.events, simTimeMs, 'WARN', 'Alternate source dead, cannot execute closed transition, falling back') };
      return executeOpenTransition(s, fromId, nextState, direction);
    }
  }

  if (transferMode === 'FAST_TRANSFER') {
    // Open main and close tie nearly simultaneously (50ms)
    s = { ...s, breakers: updateBreaker(s.breakers, fromId, b => openBreaker(b, simTimeMs)) };
    // Close tie after a minimal delay (handled by closing immediately; breaker timing handles it)
    s = { ...s, breakers: updateBreaker(s.breakers, '52-T', b => closeBreaker(b, simTimeMs)) };
    s = { ...s, schemeState: nextState };
    s = { ...s, events: addLog(s.events, simTimeMs, 'ACTION', `Fast transfer: opened ${fromId}, closed 52-T`) };
    s = recordTransfer(s);
    if (toSource) s = { ...s, lastLiveSource: toSource.id };
    return s;
  }

  // Default: OPEN_TRANSITION
  return executeOpenTransition(s, fromId, nextState, direction);
}

function executeOpenTransition(
  state: SimState,
  fromBreakerID: string,
  nextState: SchemeState,
  direction: 'M1_TO_M2' | 'M2_TO_M1'
): SimState {
  let s = { ...state };
  const { simTimeMs } = s;
  const toSourceId = direction === 'M1_TO_M2' ? 'M2' : 'M1';
  const toSource = findSource(s.sources, toSourceId);

  // Open the losing main
  s = { ...s, breakers: updateBreaker(s.breakers, fromBreakerID, b => openBreaker(b, simTimeMs)) };
  // Close the tie
  s = { ...s, breakers: updateBreaker(s.breakers, '52-T', b => closeBreaker(b, simTimeMs)) };
  s = { ...s, schemeState: nextState };
  s = { ...s, events: addLog(s.events, simTimeMs, 'ACTION', `Open transition: opened ${fromBreakerID}, closing 52-T → ${nextState}`) };
  s = recordTransfer(s);
  if (toSource) s = { ...s, lastLiveSource: toSource.id };
  return s;
}

function executeRetransferMTM(state: SimState, direction: 'RETRANSFER_TO_M1' | 'RETRANSFER_TO_M2'): SimState {
  let s = { ...state };
  const { simTimeMs, transferMode, setpoints } = s;
  const toMainId = direction === 'RETRANSFER_TO_M1' ? '52-M1' : '52-M2';
  const nextState: SchemeState = direction === 'RETRANSFER_TO_M1' ? 'NORMAL_M1' : 'NORMAL_M2';
  const toSourceId = direction === 'RETRANSFER_TO_M1' ? 'M1' : 'M2';
  const fromSourceId = direction === 'RETRANSFER_TO_M1' ? 'M2' : 'M1';
  const toSource = findSource(s.sources, toSourceId);
  const fromSource = findSource(s.sources, fromSourceId);

  s = { ...s, events: addLog(s.events, simTimeMs, 'ACTION', `Initiating retransfer to ${toSourceId}`) };

  if (transferMode === 'CLOSED_TRANSITION' && toSource && fromSource) {
    const syncResult = checkSync(toSource, fromSource, setpoints);
    if (syncResult.pass) {
      s = { ...s, breakers: updateBreaker(s.breakers, toMainId, b => closeBreaker(b, simTimeMs)) };
      s = { ...s, schemeState: 'PARALLEL', parallelStartMs: simTimeMs };
      const tripTimerId = direction === 'RETRANSFER_TO_M1' ? 'PARALLEL_TRIP_M2' : 'PARALLEL_TRIP_M1';
      s = { ...s, schemeTimers: startSchemeTimer(s.schemeTimers, 'PARALLEL_TIMER', 'Parallel Retransfer Timer', setpoints.maxParallelTimeMs) };
      s = { ...s, schemeTimers: startSchemeTimer(s.schemeTimers, tripTimerId, 'Trip Tie', setpoints.maxParallelTimeMs) };
      s = { ...s, events: addLog(s.events, simTimeMs, 'ACTION', `Sync OK for retransfer, entering PARALLEL`) };
      s = { ...s, lastLiveSource: toSourceId };
      return s;
    }
  }

  // Open transition retransfer
  s = { ...s, breakers: updateBreaker(s.breakers, '52-T', b => openBreaker(b, simTimeMs)) };
  s = { ...s, breakers: updateBreaker(s.breakers, toMainId, b => closeBreaker(b, simTimeMs)) };
  s = { ...s, schemeState: nextState };
  s = { ...s, events: addLog(s.events, simTimeMs, 'ACTION', `Retransfer complete: opened 52-T, closed ${toMainId} → ${nextState}`) };
  s = recordTransfer(s);
  s = { ...s, lastLiveSource: toSourceId };
  return s;
}

// ─── TWO_SOURCE Scheme FSM ───────────────────────────────────────────────────

function tickTwoSource(state: SimState, _dt: number): SimState {
  let s = { ...state };
  const { setpoints, simTimeMs } = s;

  const m1Dead = sourceIsDead(s.sources, setpoints, 'M1');
  const m2Dead = sourceIsDead(s.sources, setpoints, 'M2');
  const m1FaultFired = sourceHasFiredFault(s.pickupTimers, 'M1');
  const m2FaultFired = sourceHasFiredFault(s.pickupTimers, 'M2');
  const m1Lost = m1Dead || m1FaultFired;
  const m2Lost = m2Dead || m2FaultFired;

  switch (s.schemeState) {
    case 'NORMAL_M1': {
      if (m1Lost) {
        if (!isTimerActive(s.schemeTimers, 'XFER_DELAY') && !isTimerComplete(s.schemeTimers, 'XFER_DELAY')) {
          s = { ...s, schemeTimers: startSchemeTimer(s.schemeTimers, 'XFER_DELAY', 'Transfer Delay', setpoints.transferDelay) };
          s = { ...s, events: addLog(s.events, simTimeMs, 'WARN', 'M1 fault, transfer delay started') };
        }
      } else {
        if (isTimerActive(s.schemeTimers, 'XFER_DELAY')) {
          s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'XFER_DELAY') };
          s = { ...s, events: addLog(s.events, simTimeMs, 'INFO', 'M1 fault cleared, transfer cancelled') };
        }
      }

      if (isTimerComplete(s.schemeTimers, 'XFER_DELAY')) {
        s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'XFER_DELAY') };

        if (checkLockout(s)) {
          s = { ...s, schemeState: 'LOCKOUT', lockoutActive: true };
          s = { ...s, events: addLog(s.events, simTimeMs, 'ALARM', 'LOCKOUT (ANSI 86)') };
          break;
        }

        if (m2Dead) {
          s = { ...s, schemeState: 'BOTH_DEAD' };
          s = { ...s, events: addLog(s.events, simTimeMs, 'ALARM', 'Both sources dead') };
          break;
        }

        // Transfer: open 52-M1, close 52-M2
        s = { ...s, breakers: updateBreaker(s.breakers, '52-M1', b => openBreaker(b, simTimeMs)) };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-M2', b => closeBreaker(b, simTimeMs)) };
        s = { ...s, schemeState: 'NORMAL_M2' };
        s = { ...s, events: addLog(s.events, simTimeMs, 'ACTION', 'Transfer: opened 52-M1, closed 52-M2 → NORMAL_M2') };
        s = recordTransfer(s);
        s = { ...s, lastLiveSource: 'M2' };
      }
      break;
    }

    case 'NORMAL_M2': {
      if (m2Lost) {
        if (!isTimerActive(s.schemeTimers, 'XFER_DELAY') && !isTimerComplete(s.schemeTimers, 'XFER_DELAY')) {
          s = { ...s, schemeTimers: startSchemeTimer(s.schemeTimers, 'XFER_DELAY', 'Transfer Delay', setpoints.transferDelay) };
          s = { ...s, events: addLog(s.events, simTimeMs, 'WARN', 'M2 fault, transfer delay started') };
        }
      } else {
        if (isTimerActive(s.schemeTimers, 'XFER_DELAY')) {
          s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'XFER_DELAY') };
          s = { ...s, events: addLog(s.events, simTimeMs, 'INFO', 'M2 fault cleared, transfer cancelled') };
        }
      }

      if (isTimerComplete(s.schemeTimers, 'XFER_DELAY')) {
        s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'XFER_DELAY') };

        if (checkLockout(s)) {
          s = { ...s, schemeState: 'LOCKOUT', lockoutActive: true };
          s = { ...s, events: addLog(s.events, simTimeMs, 'ALARM', 'LOCKOUT (ANSI 86)') };
          break;
        }

        if (m1Dead) {
          s = { ...s, schemeState: 'BOTH_DEAD' };
          s = { ...s, events: addLog(s.events, simTimeMs, 'ALARM', 'Both sources dead') };
          break;
        }

        // Transfer back to M1 (or to preferred)
        s = { ...s, breakers: updateBreaker(s.breakers, '52-M2', b => openBreaker(b, simTimeMs)) };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-M1', b => closeBreaker(b, simTimeMs)) };
        s = { ...s, schemeState: 'NORMAL_M1' };
        s = { ...s, events: addLog(s.events, simTimeMs, 'ACTION', 'Transfer: opened 52-M2, closed 52-M1 → NORMAL_M1') };
        s = recordTransfer(s);
        s = { ...s, lastLiveSource: 'M1' };
      }

      // Auto-retransfer
      if (!m1Dead && !m1FaultFired && setpoints.autoRetransfer && setpoints.preferredSource === 'M1') {
        if (!isTimerActive(s.schemeTimers, 'RETRANSFER') && !isTimerComplete(s.schemeTimers, 'RETRANSFER')) {
          s = { ...s, schemeTimers: startSchemeTimer(s.schemeTimers, 'RETRANSFER', 'Retransfer Delay', setpoints.retransferDelay) };
          s = { ...s, events: addLog(s.events, simTimeMs, 'INFO', 'M1 available, starting retransfer delay') };
        }
      }

      if (isTimerComplete(s.schemeTimers, 'RETRANSFER')) {
        s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'RETRANSFER') };
        if (!m1Dead && !m1FaultFired) {
          s = { ...s, breakers: updateBreaker(s.breakers, '52-M2', b => openBreaker(b, simTimeMs)) };
          s = { ...s, breakers: updateBreaker(s.breakers, '52-M1', b => closeBreaker(b, simTimeMs)) };
          s = { ...s, schemeState: 'NORMAL_M1' };
          s = { ...s, events: addLog(s.events, simTimeMs, 'ACTION', 'Auto-retransfer to M1 complete') };
          s = recordTransfer(s);
          s = { ...s, lastLiveSource: 'M1' };
        }
      }
      break;
    }

    case 'BOTH_DEAD': {
      if (!m1Dead && !m1FaultFired) {
        s = { ...s, breakers: updateBreaker(s.breakers, '52-M2', b => openBreaker(b, simTimeMs)) };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-M1', b => closeBreaker(b, simTimeMs)) };
        s = { ...s, schemeState: 'NORMAL_M1' };
        s = { ...s, events: addLog(s.events, simTimeMs, 'INFO', 'M1 restored from BOTH_DEAD') };
      } else if (!m2Dead && !m2FaultFired) {
        s = { ...s, breakers: updateBreaker(s.breakers, '52-M1', b => openBreaker(b, simTimeMs)) };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-M2', b => closeBreaker(b, simTimeMs)) };
        s = { ...s, schemeState: 'NORMAL_M2' };
        s = { ...s, events: addLog(s.events, simTimeMs, 'INFO', 'M2 restored from BOTH_DEAD') };
      }
      break;
    }

    case 'LOCKOUT':
      break;

    default:
      break;
  }

  return s;
}

// ─── MMM Scheme FSM ──────────────────────────────────────────────────────────

function tickMMM(state: SimState, _dt: number): SimState {
  let s = { ...state };
  const { setpoints, simTimeMs } = s;

  const m1Dead = sourceIsDead(s.sources, setpoints, 'M1');
  const m2Dead = sourceIsDead(s.sources, setpoints, 'M2');
  const m3Dead = sourceIsDead(s.sources, setpoints, 'M3');

  const m1FaultFired = sourceHasFiredFault(s.pickupTimers, 'M1');
  const m3FaultFired = sourceHasFiredFault(s.pickupTimers, 'M3');

  const m1Lost = m1Dead || m1FaultFired;
  const m2Lost = m2Dead;
  const m3Lost = m3Dead || m3FaultFired;

  switch (s.schemeState) {
    case 'NORMAL_M1': {
      // M1 feeds Bus1, M2 feeds Bus2, M3 feeds Bus3, T1&T2 open
      if (m1Lost && !isTimerActive(s.schemeTimers, 'XFER_DELAY')) {
        s = { ...s, schemeTimers: startSchemeTimer(s.schemeTimers, 'XFER_DELAY', 'Transfer Delay', setpoints.transferDelay) };
        s = { ...s, events: addLog(s.events, simTimeMs, 'WARN', 'M1 fault detected, starting transfer delay') };
      }
      if (!m1Lost && isTimerActive(s.schemeTimers, 'XFER_DELAY')) {
        s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'XFER_DELAY') };
      }
      if (isTimerComplete(s.schemeTimers, 'XFER_DELAY')) {
        s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'XFER_DELAY') };
        if (!m2Lost) {
          // M2 feeds Bus1 via T1
          s = { ...s, breakers: updateBreaker(s.breakers, '52-M1', b => openBreaker(b, simTimeMs)) };
          s = { ...s, breakers: updateBreaker(s.breakers, '52-T1', b => closeBreaker(b, simTimeMs)) };
          s = { ...s, schemeState: 'TIE_FROM_M2' };
          s = { ...s, events: addLog(s.events, simTimeMs, 'ACTION', 'M1 lost: opened 52-M1, closed 52-T1 → TIE_FROM_M2') };
          s = recordTransfer(s);
        } else if (!m3Lost) {
          // M3 feeds all via T1 and T2
          s = { ...s, breakers: updateBreaker(s.breakers, '52-M1', b => openBreaker(b, simTimeMs)) };
          s = { ...s, breakers: updateBreaker(s.breakers, '52-T1', b => closeBreaker(b, simTimeMs)) };
          s = { ...s, breakers: updateBreaker(s.breakers, '52-T2', b => closeBreaker(b, simTimeMs)) };
          s = { ...s, schemeState: 'TIE_FROM_M3' };
          s = { ...s, events: addLog(s.events, simTimeMs, 'ACTION', 'M1 and M2 lost: T1+T2 closed, M3 feeds all → TIE_FROM_M3') };
          s = recordTransfer(s);
        } else {
          s = { ...s, schemeState: 'ALL_DEAD' };
          s = { ...s, events: addLog(s.events, simTimeMs, 'ALARM', 'All sources lost — ALL_DEAD') };
        }
      }
      break;
    }

    case 'TIE_FROM_M2': {
      // M2 feeding Bus1 via T1, M3 feeding Bus3 (if M3 alive)
      if (m2Lost) {
        if (!m3Lost) {
          // Try M3 via T2
          s = { ...s, breakers: updateBreaker(s.breakers, '52-T1', b => openBreaker(b, simTimeMs)) };
          s = { ...s, breakers: updateBreaker(s.breakers, '52-T2', b => closeBreaker(b, simTimeMs)) };
          s = { ...s, schemeState: 'TIE_FROM_M3' };
          s = { ...s, events: addLog(s.events, simTimeMs, 'ALARM', 'M2 lost in TIE_FROM_M2, switching to M3') };
          s = recordTransfer(s);
        } else {
          s = { ...s, schemeState: 'ALL_DEAD' };
          s = { ...s, events: addLog(s.events, simTimeMs, 'ALARM', 'All sources lost — ALL_DEAD') };
        }
      }
      // Auto-retransfer to M1 if restored
      if (!m1Lost && setpoints.autoRetransfer && !isTimerActive(s.schemeTimers, 'RETRANSFER')) {
        s = { ...s, schemeTimers: startSchemeTimer(s.schemeTimers, 'RETRANSFER', 'Retransfer Delay', setpoints.retransferDelay) };
        s = { ...s, events: addLog(s.events, simTimeMs, 'INFO', 'M1 restored, retransfer timer started') };
      }
      if (m1Lost && isTimerActive(s.schemeTimers, 'RETRANSFER')) {
        s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'RETRANSFER') };
      }
      if (isTimerComplete(s.schemeTimers, 'RETRANSFER')) {
        s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'RETRANSFER') };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-T1', b => openBreaker(b, simTimeMs)) };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-M1', b => closeBreaker(b, simTimeMs)) };
        s = { ...s, schemeState: 'NORMAL_M1' };
        s = { ...s, events: addLog(s.events, simTimeMs, 'ACTION', 'Retransfer to M1 complete → NORMAL_M1') };
        s = recordTransfer(s);
      }
      break;
    }

    case 'TIE_FROM_M3': {
      if (m3Lost) {
        s = { ...s, schemeState: 'ALL_DEAD' };
        s = { ...s, events: addLog(s.events, simTimeMs, 'ALARM', 'M3 lost in TIE_FROM_M3 — ALL_DEAD') };
      }
      if (!m1Lost && setpoints.autoRetransfer && !isTimerActive(s.schemeTimers, 'RETRANSFER')) {
        s = { ...s, schemeTimers: startSchemeTimer(s.schemeTimers, 'RETRANSFER', 'Retransfer Delay', setpoints.retransferDelay) };
      }
      if (isTimerComplete(s.schemeTimers, 'RETRANSFER')) {
        s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'RETRANSFER') };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-T1', b => openBreaker(b, simTimeMs)) };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-T2', b => openBreaker(b, simTimeMs)) };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-M1', b => closeBreaker(b, simTimeMs)) };
        s = { ...s, schemeState: 'NORMAL_M1' };
        s = { ...s, events: addLog(s.events, simTimeMs, 'ACTION', 'Retransfer to M1 complete from TIE_FROM_M3 → NORMAL_M1') };
        s = recordTransfer(s);
      }
      break;
    }

    case 'ALL_DEAD': {
      if (!m1Lost) {
        s = { ...s, breakers: updateBreaker(s.breakers, '52-T1', b => openBreaker(b, simTimeMs)) };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-T2', b => openBreaker(b, simTimeMs)) };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-M1', b => closeBreaker(b, simTimeMs)) };
        s = { ...s, schemeState: 'NORMAL_M1' };
        s = { ...s, events: addLog(s.events, simTimeMs, 'INFO', 'M1 restored from ALL_DEAD') };
      } else if (!m2Lost) {
        s = { ...s, breakers: updateBreaker(s.breakers, '52-T1', b => openBreaker(b, simTimeMs)) };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-T2', b => openBreaker(b, simTimeMs)) };
        s = { ...s, schemeState: 'TIE_FROM_M2' };
        s = { ...s, events: addLog(s.events, simTimeMs, 'INFO', 'M2 restored from ALL_DEAD') };
      } else if (!m3Lost) {
        s = { ...s, breakers: updateBreaker(s.breakers, '52-T1', b => openBreaker(b, simTimeMs)) };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-T2', b => openBreaker(b, simTimeMs)) };
        s = { ...s, breakers: updateBreaker(s.breakers, '52-M3', b => closeBreaker(b, simTimeMs)) };
        s = { ...s, schemeState: 'NORMAL_M3' };
        s = { ...s, events: addLog(s.events, simTimeMs, 'INFO', 'M3 restored from ALL_DEAD') };
      }
      break;
    }

    case 'NORMAL_M3': {
      if (m3Lost && !isTimerActive(s.schemeTimers, 'XFER_DELAY')) {
        s = { ...s, schemeTimers: startSchemeTimer(s.schemeTimers, 'XFER_DELAY', 'Transfer Delay', setpoints.transferDelay) };
        s = { ...s, events: addLog(s.events, simTimeMs, 'WARN', 'M3 fault, transfer delay started') };
      }
      if (isTimerComplete(s.schemeTimers, 'XFER_DELAY')) {
        s = { ...s, schemeTimers: cancelSchemeTimer(s.schemeTimers, 'XFER_DELAY') };
        if (!m1Lost) {
          s = { ...s, breakers: updateBreaker(s.breakers, '52-M3', b => openBreaker(b, simTimeMs)) };
          s = { ...s, breakers: updateBreaker(s.breakers, '52-T2', b => closeBreaker(b, simTimeMs)) };
          s = { ...s, schemeState: 'TIE_FROM_M2' };
          s = { ...s, events: addLog(s.events, simTimeMs, 'ACTION', 'M3 lost: fallback to M2 via T2') };
          s = recordTransfer(s);
        } else {
          s = { ...s, schemeState: 'ALL_DEAD' };
        }
      }
      break;
    }

    case 'LOCKOUT':
      break;

    default:
      break;
  }

  return s;
}

// ─── Main Tick ───────────────────────────────────────────────────────────────

export function tickScheme(state: SimState, dt: number): SimState {
  let s = { ...state };

  // 1. Tick all breakers
  s = { ...s, breakers: s.breakers.map(b => tickBreaker(b, dt)) };

  // 2. Evaluate source health
  const newSourceHealth: Record<string, SourceHealth> = {};
  const newSourceFaults: Record<string, string[]> = {};
  for (const src of s.sources) {
    const eval_ = evaluateSource(src, s.setpoints);
    newSourceHealth[src.id] = eval_.health;
    newSourceFaults[src.id] = eval_.faults;
  }
  s = { ...s, sourceHealth: newSourceHealth, sourceFaults: newSourceFaults };

  // 3. Update pickup timers per source
  for (const src of s.sources) {
    const isUV = src.voltage < s.setpoints.uvThreshold && src.voltage > s.setpoints.deadSourceThreshold && src.available;
    const isOV = src.voltage > s.setpoints.ovThreshold && src.available;
    const isUF = src.frequency < s.setpoints.ufThreshold && src.voltage > s.setpoints.deadSourceThreshold && src.available;
    const isOF = src.frequency > s.setpoints.ofThreshold && src.voltage > s.setpoints.deadSourceThreshold && src.available;

    const prev_UV = isPickupFired(s.pickupTimers, src.id, 'UV');
    const prev_OV = isPickupFired(s.pickupTimers, src.id, 'OV');
    const prev_UF = isPickupFired(s.pickupTimers, src.id, 'UF');
    const prev_OF = isPickupFired(s.pickupTimers, src.id, 'OF');

    let result = updatePickupTimers(s.pickupTimers, src.id, 'UV', isUV, s.setpoints.uvPickupTime, dt);
    s = { ...s, pickupTimers: result.timers };
    if (result.justFired && !prev_UV) {
      s = { ...s, events: addLog(s.events, s.simTimeMs, 'ALARM', `ANSI 27 UV pickup fired for ${src.id}`) };
    }

    result = updatePickupTimers(s.pickupTimers, src.id, 'OV', isOV, s.setpoints.ovPickupTime, dt);
    s = { ...s, pickupTimers: result.timers };
    if (result.justFired && !prev_OV) {
      s = { ...s, events: addLog(s.events, s.simTimeMs, 'ALARM', `ANSI 59 OV pickup fired for ${src.id}`) };
    }

    result = updatePickupTimers(s.pickupTimers, src.id, 'UF', isUF, s.setpoints.ufPickupTime, dt);
    s = { ...s, pickupTimers: result.timers };
    if (result.justFired && !prev_UF) {
      s = { ...s, events: addLog(s.events, s.simTimeMs, 'ALARM', `ANSI 81U UF pickup fired for ${src.id}`) };
    }

    result = updatePickupTimers(s.pickupTimers, src.id, 'OF', isOF, s.setpoints.ofPickupTime, dt);
    s = { ...s, pickupTimers: result.timers };
    if (result.justFired && !prev_OF) {
      s = { ...s, events: addLog(s.events, s.simTimeMs, 'ALARM', `ANSI 81O OF pickup fired for ${src.id}`) };
    }

    // Reset pickup timers when source recovers (no longer dead, no longer in fault condition)
    const nowDead = isDead(src, s.setpoints) || !src.available;
    if (!isUV && !isOV && !isUF && !isOF && !nowDead) {
      // Source has recovered — reset all fired timers so retransfer logic can trigger cleanly
      if (sourceHasFiredFault(s.pickupTimers, src.id)) {
        s = { ...s, pickupTimers: resetPickupTimersForSource(s.pickupTimers, src.id) };
        s = { ...s, events: addLog(s.events, s.simTimeMs, 'INFO', `${src.id} faults cleared`) };
      }
    }
  }

  // 4. Advance scheme timers
  s = { ...s, schemeTimers: tickSchemeTimers(s.schemeTimers, dt) };

  // 5. Run scheme FSM
  const prevState = s.schemeState;
  if (s.lockoutActive && s.schemeState !== 'LOCKOUT') {
    s = { ...s, schemeState: 'LOCKOUT' };
  }

  if (!s.lockoutActive) {
    switch (s.topology) {
      case 'TWO_SOURCE':
        s = tickTwoSource(s, dt);
        break;
      case 'MTM':
        s = tickMTM(s, dt);
        break;
      case 'MMM':
        s = tickMMM(s, dt);
        break;
    }
  }

  if (s.schemeState !== prevState) {
    s = { ...s, events: addLog(s.events, s.simTimeMs, 'ACTION', `Scheme state: ${prevState} → ${s.schemeState}`) };
  }

  // 6. Update bus energization
  s = { ...s, buses: computeBusStates(s) };

  // 7. Update active timers display
  const displayTimers: ActiveTimer[] = s.schemeTimers.map(t => ({
    id: t.id,
    label: t.label,
    startedAt: s.simTimeMs - t.elapsedMs,
    durationMs: t.durationMs,
    elapsedMs: t.elapsedMs,
    complete: t.complete,
    active: t.active && !t.complete,
  }));
  s = { ...s, activeTimers: displayTimers };

  // 8. Advance sim time
  s = { ...s, simTimeMs: s.simTimeMs + dt };

  return s;
}

// Export the helper for manual breaker operations from useSimulation
export function manualCloseBreaker(state: SimState, breakerId: string): SimState {
  let s = { ...state };
  const breaker = findBreaker(s.breakers, breakerId);
  if (!breaker) return s;

  // Check interlocks
  let interlockViolation = false;
  if (s.topology === 'MTM') {
    interlockViolation = checkMTMInterlock(s.breakers, breakerId);
  } else if (s.topology === 'MMM') {
    interlockViolation = checkMMMInterlock(s.breakers, breakerId);
  }

  if (interlockViolation) {
    s = { ...s, events: addLog(s.events, s.simTimeMs, 'ALARM', `Interlock: closing ${breakerId} blocked — would violate bus protection`) };
    return s;
  }

  s = { ...s, breakers: updateBreaker(s.breakers, breakerId, b => closeBreaker(b, s.simTimeMs)) };
  s = { ...s, events: addLog(s.events, s.simTimeMs, 'ACTION', `Manual close: ${breakerId}`) };
  s = { ...s, schemeState: 'MANUAL_OVERRIDE' };
  return s;
}

export function manualOpenBreaker(state: SimState, breakerId: string): SimState {
  let s = { ...state };
  s = { ...s, breakers: updateBreaker(s.breakers, breakerId, b => openBreaker(b, s.simTimeMs)) };
  s = { ...s, events: addLog(s.events, s.simTimeMs, 'ACTION', `Manual open: ${breakerId}`) };
  s = { ...s, schemeState: 'MANUAL_OVERRIDE' };
  return s;
}

export function resetLockout(state: SimState): SimState {
  let s = { ...state };
  s = { ...s, lockoutActive: false, transferHistory: [], schemeState: 'NORMAL_M1' };
  s = { ...s, events: addLog(s.events, s.simTimeMs, 'ACTION', 'Lockout reset (ANSI 86 reset)') };
  return s;
}
