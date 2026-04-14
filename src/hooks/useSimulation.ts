import { useState, useRef, useEffect, useCallback } from 'react';
import {
  SimState,
  Topology,
  TransferMode,
  Source,
  Setpoints,
  Scenario,
  ScenarioEvent,
} from '../engine/types';
import { createInitialState, stepSimulation } from '../engine/atsEngine';
import { manualCloseBreaker, manualOpenBreaker, resetLockout } from '../engine/schemeController';
import { applyScenarioEvents } from '../engine/scenarioRunner';

// Fixed simulated time advanced per engine tick (ms).
// What changes with speedMultiplier is the wall-clock interval between dispatches.
const SIM_TICK_MS = 10;
// Minimum wall-clock interval to avoid starving the browser event loop.
const MIN_WALL_INTERVAL_MS = 4;

export function useSimulation() {
  const [state, setState] = useState<SimState>(() =>
    createInitialState('MTM', 'OPEN_TRANSITION')
  );

  const pendingEventsRef = useRef<ScenarioEvent[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<SimState>(state);

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Simulation loop.
  // wallInterval = max(MIN, SIM_TICK_MS / speedMultiplier)
  // At high speeds the interval hits the browser floor, so we advance
  // multiple simulated ticks per dispatch to compensate.
  useEffect(() => {
    if (state.isRunning && !state.isPaused) {
      const speed = state.speed; // speedMultiplier (0.05 … 5)
      const wallInterval = Math.max(MIN_WALL_INTERVAL_MS, SIM_TICK_MS / speed);
      const ticksPerDispatch = Math.max(1, Math.round((speed * wallInterval) / SIM_TICK_MS));

      intervalRef.current = setInterval(() => {
        const current = stateRef.current;
        let s = current;
        for (let i = 0; i < ticksPerDispatch; i++) {
          const { state: afterEvents, remaining } = applyScenarioEvents(s, pendingEventsRef.current);
          pendingEventsRef.current = remaining;
          s = stepSimulation(afterEvents, SIM_TICK_MS);
        }
        setState(s);
      }, wallInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isRunning, state.isPaused, state.speed]);

  const startSim = useCallback(() => {
    setState(prev => ({ ...prev, isRunning: true, isPaused: false }));
  }, []);

  const pauseSim = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);

  const resetSim = useCallback(() => {
    pendingEventsRef.current = [];
    setState(prev => createInitialState(prev.topology, prev.transferMode));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setState(prev => ({ ...prev, speed }));
  }, []);

  const updateSource = useCallback((id: string, partial: Partial<Source>) => {
    setState(prev => ({
      ...prev,
      sources: prev.sources.map(s => s.id === id ? { ...s, ...partial } : s),
    }));
  }, []);

  const updateSetpoints = useCallback((partial: Partial<Setpoints>) => {
    setState(prev => ({ ...prev, setpoints: { ...prev.setpoints, ...partial } }));
  }, []);

  const manualOpenBreakerAction = useCallback((id: string) => {
    setState(prev => manualOpenBreaker(prev, id));
  }, []);

  const manualCloseBreakerAction = useCallback((id: string) => {
    setState(prev => manualCloseBreaker(prev, id));
  }, []);

  const loadScenario = useCallback((scenario: Scenario) => {
    pendingEventsRef.current = [...scenario.events];
    setState(prev => ({
      ...createInitialState(prev.topology, prev.transferMode),
      isRunning: true,
      isPaused: false,
    }));
  }, []);

  const resetLockoutAction = useCallback(() => {
    setState(prev => resetLockout(prev));
  }, []);

  const exportLog = useCallback((): string => {
    const { events } = stateRef.current;
    const header = 'SimTime(ms),Severity,Message,Detail\n';
    const rows = events.map(e =>
      `${e.simTimeMs},${e.severity},"${e.message.replace(/"/g, '""')}","${(e.detail ?? '').replace(/"/g, '""')}"`
    );
    return header + rows.join('\n');
  }, []);

  const setTopology = useCallback((topology: Topology) => {
    pendingEventsRef.current = [];
    setState(prev => createInitialState(topology, prev.transferMode));
  }, []);

  const setTransferMode = useCallback((mode: TransferMode) => {
    setState(prev => ({ ...prev, transferMode: mode }));
  }, []);

  const stepOnce = useCallback(() => {
    setState(prev => {
      const { state: afterEvents, remaining } = applyScenarioEvents(prev, pendingEventsRef.current);
      pendingEventsRef.current = remaining;
      return stepSimulation(afterEvents, 10);
    });
  }, []);

  const updateBusLoad = useCallback((busId: string, loadKW: number) => {
    setState(prev => ({
      ...prev,
      buses: prev.buses.map(b => b.id === busId ? { ...b, loadKW } : b),
    }));
  }, []);

  return {
    state,
    dispatch: {
      startSim,
      pauseSim,
      resetSim,
      setSpeed,
      updateSource,
      updateSetpoints,
      manualOpenBreaker: manualOpenBreakerAction,
      manualCloseBreaker: manualCloseBreakerAction,
      loadScenario,
      resetLockout: resetLockoutAction,
      exportLog,
      setTopology,
      setTransferMode,
      stepOnce,
      updateBusLoad,
    },
  };
}
