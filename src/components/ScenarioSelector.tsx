import React, { useState } from 'react';
import { Scenario, ScenarioEvent, SimState } from '../engine/types';
import { PRESET_SCENARIOS } from '../engine/scenarioRunner';

interface Dispatch {
  loadScenario: (scenario: Scenario) => void;
  startSim: () => void;
}

interface Props {
  dispatch: Dispatch;
  state: SimState;
}

export default function ScenarioSelector({ dispatch, state }: Props) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [expanded, setExpanded] = useState(false);

  // Custom event form state
  const [customTime, setCustomTime] = useState(5000);
  const [customSourceId, setCustomSourceId] = useState('M1');
  const [customField, setCustomField] = useState<'voltage' | 'frequency' | 'phaseAngle' | 'available'>('voltage');
  const [customValue, setCustomValue] = useState(0);
  const [customEvents, setCustomEvents] = useState<ScenarioEvent[]>([]);

  const selected = PRESET_SCENARIOS.find(s => s.id === selectedId);

  const handleLoadAndRun = () => {
    if (!selected && customEvents.length === 0) return;

    const scenario: Scenario = selected
      ? {
          ...selected,
          events: [...selected.events, ...customEvents].sort((a, b) => a.timeMs - b.timeMs),
        }
      : {
          id: 'custom',
          name: 'Custom Scenario',
          description: 'User-defined events',
          events: [...customEvents].sort((a, b) => a.timeMs - b.timeMs),
        };

    dispatch.loadScenario(scenario);
  };

  const addCustomEvent = () => {
    const sourceId = customSourceId;
    const field = customField;
    const value = field === 'available' ? customValue > 0 : customValue;
    const timeMs = customTime;
    const desc = `Set ${sourceId}.${field} = ${value} at t=${timeMs}ms`;

    const event: ScenarioEvent = {
      timeMs,
      description: desc,
      action: (s: SimState) => ({
        sources: s.sources.map(src =>
          src.id === sourceId ? { ...src, [field]: value } : src
        ),
      }),
    };

    setCustomEvents(prev => [...prev, event].sort((a, b) => a.timeMs - b.timeMs));
  };

  const removeCustomEvent = (idx: number) => {
    setCustomEvents(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div style={{
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      padding: '14px',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          fontSize: '0.72rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          justifyContent: 'space-between',
        }}
      >
        <span>SCENARIOS</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ marginTop: '12px' }}>
          {/* Preset selector */}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>
              Preset Scenario
            </label>
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              style={{
                width: '100%',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#e2e8f0',
                padding: '6px 8px',
                fontSize: '0.8rem',
              }}
            >
              <option value="">— Select preset —</option>
              {PRESET_SCENARIOS.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Description card */}
          {selected && (
            <div style={{
              background: '#0f172a',
              border: '1px solid #1e3a5f',
              borderRadius: '6px',
              padding: '10px',
              marginBottom: '10px',
            }}>
              <div style={{ color: '#60a5fa', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                {selected.name}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', lineHeight: 1.5, marginBottom: '8px' }}>
                {selected.description}
              </div>
              <div style={{ color: '#475569', fontSize: '0.72rem' }}>
                {selected.events.map((e, i) => (
                  <div key={i}>t={e.timeMs}ms: {e.description}</div>
                ))}
              </div>
            </div>
          )}

          {/* Custom events */}
          <details style={{ marginBottom: '10px' }}>
            <summary style={{ color: '#64748b', fontSize: '0.75rem', cursor: 'pointer', marginBottom: '6px' }}>
              Add Custom Event
            </summary>
            <div style={{ padding: '8px', background: '#0f172a', borderRadius: '6px', marginTop: '6px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                <div>
                  <label style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Time (ms)</label>
                  <input
                    type="number"
                    value={customTime}
                    onChange={e => setCustomTime(parseInt(e.target.value))}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', padding: '4px 6px', fontSize: '0.78rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Source</label>
                  <select
                    value={customSourceId}
                    onChange={e => setCustomSourceId(e.target.value)}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', padding: '4px 6px', fontSize: '0.78rem', boxSizing: 'border-box' }}
                  >
                    {state.sources.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Field</label>
                  <select
                    value={customField}
                    onChange={e => setCustomField(e.target.value as typeof customField)}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', padding: '4px 6px', fontSize: '0.78rem', boxSizing: 'border-box' }}
                  >
                    <option value="voltage">Voltage %</option>
                    <option value="frequency">Frequency Hz</option>
                    <option value="phaseAngle">Phase Angle °</option>
                    <option value="available">Available (1/0)</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>Value</label>
                  <input
                    type="number"
                    value={customValue}
                    onChange={e => setCustomValue(parseFloat(e.target.value))}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', padding: '4px 6px', fontSize: '0.78rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <button
                onClick={addCustomEvent}
                style={{
                  padding: '5px 12px',
                  background: '#1d4ed8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                }}
              >
                + Add Event
              </button>

              {customEvents.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  {customEvents.map((e, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.72rem', marginBottom: '2px' }}>
                      <span>{e.description}</span>
                      <button
                        onClick={() => removeCustomEvent(i)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>

          {/* Load & Run button */}
          <button
            onClick={handleLoadAndRun}
            disabled={!selected && customEvents.length === 0}
            style={{
              width: '100%',
              padding: '8px',
              background: (selected || customEvents.length > 0) ? '#16a34a' : '#1e293b',
              color: (selected || customEvents.length > 0) ? '#fff' : '#475569',
              border: 'none',
              borderRadius: '6px',
              cursor: (selected || customEvents.length > 0) ? 'pointer' : 'not-allowed',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            Load & Run
          </button>
        </div>
      )}
    </div>
  );
}
