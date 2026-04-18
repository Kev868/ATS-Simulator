import { useState, useEffect, useRef, useCallback } from 'react';
import type { CircuitModel, SchemeSettings } from '../../core/types';
import { SimulatorCanvas } from './SimulatorCanvas';
import { SourcePanel } from './SourcePanel';
import { SchemePanel } from './SchemePanel';
import { SimControls } from './SimControls';
import { EventLog } from './EventLog';
import { cloneCircuit } from '../../core/serialization';
import { applyEnergization } from '../../core/EnergizationSolver';
import {
  createSimulationState,
  createTransferControllerState,
  tickSimulation,
  type TransferControllerState,
} from '../../core/SimulationEngine';
import { SIM_TICK_MS, COLORS } from '../../core/constants';

interface SimulatorViewProps {
  initialModel: CircuitModel;
  onBack: () => void;
  onEditCircuit: () => void;
}

export function SimulatorView({ initialModel, onBack, onEditCircuit }: SimulatorViewProps) {
  const [model, setModel] = useState<CircuitModel>(() => {
    const m = cloneCircuit(initialModel);
    applyEnergization(m);
    return m;
  });
  const [simState, setSimState] = useState(createSimulationState);
  const ctrlStateRef = useRef<TransferControllerState>(createTransferControllerState());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modelRef = useRef(model);
  const simStateRef = useRef(simState);

  useEffect(() => { modelRef.current = model; }, [model]);
  useEffect(() => { simStateRef.current = simState; }, [simState]);

  const tick = useCallback(() => {
    const currentModel = cloneCircuit(modelRef.current);
    const currentSimState = { ...simStateRef.current };
    const deltaMs = SIM_TICK_MS * currentSimState.speedMultiplier;
    tickSimulation(currentModel, currentSimState, ctrlStateRef.current, deltaMs);
    modelRef.current = currentModel;
    simStateRef.current = currentSimState;
    setModel(currentModel);
    setSimState({ ...currentSimState });
  }, []);

  const handleStart = useCallback(() => {
    if (intervalRef.current) return;
    setSimState((s) => ({ ...s, running: true, paused: false }));
    intervalRef.current = setInterval(tick, SIM_TICK_MS);
  }, [tick]);

  const handleStop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSimState((s) => ({ ...s, running: false, paused: false }));
  }, []);

  const handlePause = useCallback(() => {
    if (!simState.running) return;
    if (simState.paused) {
      intervalRef.current = setInterval(tick, SIM_TICK_MS);
      setSimState((s) => ({ ...s, paused: false }));
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setSimState((s) => ({ ...s, paused: true }));
    }
  }, [simState.running, simState.paused, tick]);

  const handleReset = useCallback(() => {
    handleStop();
    const fresh = cloneCircuit(initialModel);
    applyEnergization(fresh);
    modelRef.current = fresh;
    const newSimState = createSimulationState();
    simStateRef.current = newSimState;
    ctrlStateRef.current = createTransferControllerState();
    setModel(fresh);
    setSimState(newSimState);
  }, [initialModel, handleStop]);

  const handleSpeedChange = useCallback((speed: number) => {
    setSimState((s) => ({ ...s, speedMultiplier: speed }));
    simStateRef.current = { ...simStateRef.current, speedMultiplier: speed };
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const sources = model.components.filter((c) => c.type === "utility-source" || c.type === "generator-source");

  const handleVoltageChange = useCallback((sourceId: string, pct: number) => {
    setModel((m) => {
      const next = cloneCircuit(m);
      const src = next.components.find((c) => c.id === sourceId);
      if (src) src.state.voltagePercent = pct;
      applyEnergization(next);
      modelRef.current = next;
      return next;
    });
  }, []);

  const handleFreqChange = useCallback((sourceId: string, hz: number) => {
    setModel((m) => {
      const next = cloneCircuit(m);
      const src = next.components.find((c) => c.id === sourceId);
      if (src) src.state.frequencyHz = hz;
      applyEnergization(next);
      modelRef.current = next;
      return next;
    });
  }, []);

  const handleFailToggle = useCallback((sourceId: string) => {
    setModel((m) => {
      const next = cloneCircuit(m);
      const src = next.components.find((c) => c.id === sourceId);
      if (src) {
        src.state.failed = !src.state.failed;
        if (!src.state.failed) {
          src.state.voltagePercent = 100;
          src.state.frequencyHz = src.properties.nominalFrequency ?? 60;
        }
      }
      applyEnergization(next);
      modelRef.current = next;
      return next;
    });
  }, []);

  const handleSchemeSettingsChange = useCallback((settings: SchemeSettings) => {
    setModel((m) => {
      const next = { ...m, schemeSettings: settings };
      modelRef.current = next;
      return next;
    });
  }, []);

  const fsmState = ctrlStateRef.current.fsm;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f172a' }}>
      {/* Toolbar */}
      <div style={{ height: 48, background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ padding: '6px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: COLORS.text, cursor: 'pointer', fontSize: 13, fontFamily: 'monospace' }}>
          ← Back
        </button>
        <button onClick={onEditCircuit} style={{ padding: '6px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: COLORS.text, cursor: 'pointer', fontSize: 13, fontFamily: 'monospace' }}>
          Edit Circuit
        </button>
        <span style={{ fontSize: 14, color: COLORS.text, fontFamily: 'monospace' }}>{model.name}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: COLORS.textDim, fontFamily: 'monospace' }}>
          t = {simState.simulatedTimeMs.toFixed(0)}ms
        </span>
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: fsmState === 'LOCKED_OUT' ? COLORS.tripped : fsmState === 'NORMAL' ? COLORS.energized : COLORS.failed }}>
          FSM: {fsmState}
        </span>
        <span style={{ fontSize: 12, color: COLORS.textDim, fontFamily: 'monospace' }}>
          Transfers: {simState.transferCount}
        </span>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: source panels + scheme */}
        <div style={{ width: 220, background: '#0a0f1a', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sources.map((src) => (
              <SourcePanel
                key={src.id}
                source={src}
                onVoltageChange={(pct) => handleVoltageChange(src.id, pct)}
                onFrequencyChange={(hz) => handleFreqChange(src.id, hz)}
                onFailToggle={() => handleFailToggle(src.id)}
              />
            ))}
          </div>
          <div style={{ borderTop: '1px solid #1e293b', overflowY: 'auto', maxHeight: '45%' }}>
            <SchemePanel model={model} onSettingsChange={handleSchemeSettingsChange} />
          </div>
        </div>

        {/* Center: circuit canvas */}
        <SimulatorCanvas model={model} />

        {/* Right: event log */}
        <div style={{ width: 380, borderLeft: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
          <EventLog events={simState.events} />
        </div>
      </div>

      {/* Bottom: sim controls */}
      <SimControls
        running={simState.running}
        paused={simState.paused}
        speedMultiplier={simState.speedMultiplier}
        onStart={handleStart}
        onStop={handleStop}
        onPause={handlePause}
        onReset={handleReset}
        onSpeedChange={handleSpeedChange}
      />
    </div>
  );
}
