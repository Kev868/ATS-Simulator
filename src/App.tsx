import React, { useState } from 'react';
import { Topology } from './engine/types';
import { GraphTopology } from './engine/graphTopology';
import { useSimulation } from './hooks/useSimulation';
import TopologyMenu from './components/TopologyMenu';
import TopologyBuilder from './components/TopologyBuilder';
import OneLine from './components/OneLine';
import SourcePanel from './components/SourcePanel';
import SchemeSettings from './components/SchemeSettings';
import EventLog from './components/EventLog';
import SimControls from './components/SimControls';
import ScenarioSelector from './components/ScenarioSelector';
import './App.css';

type AppView = 'MENU' | 'BUILD' | 'SIM';

export default function App() {
  const [view, setView] = useState<AppView>('MENU');
  const [topology, setTopology] = useState<Topology | null>(null);
  const [initialBuilderTopo, setInitialBuilderTopo] = useState<GraphTopology | null>(null);
  // Changing builderKey forces TopologyBuilder to fully remount, guaranteeing
  // the lazy useReducer initializer runs with the correct initialTopo.
  const [builderKey, setBuilderKey] = useState(0);
  const sim = useSimulation();

  // ── Topology selection (preset) ────────────────────────────────────────────
  const handleSelectTopology = (t: Topology) => {
    setTopology(t);
    sim.dispatch.setTopology(t);
    setView('SIM');
  };

  // ── Load a saved topology file from the menu → open builder ───────────────
  const handleLoadFromMenu = (topo: GraphTopology) => {
    setInitialBuilderTopo(topo);
    setBuilderKey(k => k + 1); // Force fresh mount so lazy initializer sees new topo
    setView('BUILD');
  };

  // ── Custom topology from builder ───────────────────────────────────────────
  const handleCustomSim = (_topo: GraphTopology) => {
    // Fallback: treat as MTM preset so all existing FSM code works.
    setTopology('MTM');
    sim.dispatch.setTopology('MTM');
    setView('SIM');
  };

  // ── Reset → main menu ──────────────────────────────────────────────────────
  const handleReset = () => {
    sim.dispatch.resetSim();
    setTopology(null);
    setInitialBuilderTopo(null);
    setView('MENU');
  };

  const handleExportLog = () => {
    const csv = sim.dispatch.exportLog();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ats-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render: main menu ──────────────────────────────────────────────────────
  if (view === 'MENU') {
    return (
      <TopologyMenu
        onSelect={handleSelectTopology}
        onCustom={() => { setInitialBuilderTopo(null); setView('BUILD'); }}
        onLoadFile={handleLoadFromMenu}
      />
    );
  }

  // ── Render: custom topology builder ───────────────────────────────────────
  if (view === 'BUILD') {
    return (
      <TopologyBuilder
        key={`builder-${builderKey}`}
        onStartSimulation={handleCustomSim}
        onBack={() => setView('MENU')}
        initialTopo={initialBuilderTopo}
      />
    );
  }

  // ── Render: simulator ──────────────────────────────────────────────────────
  const { state, dispatch } = sim;

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-left">
          <span className="header-title">ATS Simulator</span>
          <span className="header-topology">{topology}</span>
        </div>
        <button className="change-topology-btn" onClick={handleReset}>
          Main Menu
        </button>
      </header>

      <SimControls state={state} dispatch={dispatch} />

      <div className="main-area">
        {/* Left Panel */}
        <div className="left-panel">
          <div style={{ overflowY: 'auto', flex: 1, padding: '10px' }}>
            {state.sources.map(src => (
              <SourcePanel
                key={src.id}
                source={src}
                health={state.sourceHealth[src.id] ?? 'HEALTHY'}
                faults={state.sourceFaults[src.id] ?? []}
                onUpdate={partial => dispatch.updateSource(src.id, partial)}
              />
            ))}
            <SchemeSettings state={state} dispatch={dispatch} />
            <ScenarioSelector dispatch={dispatch} state={state} />
          </div>
        </div>

        {/* Center Panel */}
        <div className="center-panel">
          <OneLine
            state={state}
            onBreakerClick={(id) => {
              const breaker = state.breakers.find(b => b.id === id);
              if (!breaker) return;
              if (breaker.state === 'CLOSED' || breaker.state === 'CLOSING') {
                dispatch.manualOpenBreaker(id);
              } else {
                dispatch.manualCloseBreaker(id);
              }
            }}
          />

          {/* Active Timers */}
          {state.activeTimers.length > 0 && (
            <div style={{ padding: '0 16px 12px' }}>
              <div style={{ color: '#64748b', fontSize: '0.7rem', marginBottom: '6px', letterSpacing: '0.05em', fontWeight: 600 }}>
                ACTIVE TIMERS
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {state.activeTimers
                  .filter(t => t.active && !t.complete)
                  .map(timer => {
                    const progress = Math.min(timer.elapsedMs / timer.durationMs, 1);
                    return (
                      <div key={timer.id} style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        minWidth: '140px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{timer.label}</span>
                          <span style={{ color: '#f59e0b', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                            {(timer.elapsedMs / 1000).toFixed(2)}s / {(timer.durationMs / 1000).toFixed(2)}s
                          </span>
                        </div>
                        <div style={{ height: '4px', background: '#0f172a', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${progress * 100}%`,
                            background: '#f59e0b',
                            borderRadius: '2px',
                            transition: 'width 0.1s linear',
                          }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Bus Status Cards */}
          <div style={{ padding: '0 16px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {state.buses.map(bus => {
              const sourceColor: Record<string, string> = {
                M1: '#22c55e', M2: '#3b82f6', M3: '#a855f7',
              };
              const color = bus.energized ? (sourceColor[bus.sourceId ?? ''] ?? '#22c55e') : '#475569';
              return (
                <div key={bus.id} style={{
                  background: '#1e293b',
                  border: `1px solid ${color}44`,
                  borderRadius: '8px',
                  padding: '10px 14px',
                  minWidth: '130px',
                }}>
                  <div style={{ color: '#64748b', fontSize: '0.72rem', marginBottom: '4px' }}>{bus.label}</div>
                  <div style={{ color: color, fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace' }}>
                    {bus.energized ? `${bus.voltage.toFixed(1)}%` : 'DEAD'}
                  </div>
                  <div style={{ color: '#475569', fontSize: '0.72rem', marginTop: '2px' }}>
                    {bus.energized ? `from ${bus.sourceId}` : 'No source'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '2px' }}>
                    Load: {bus.loadKW} kW
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel */}
        <div className="right-panel">
          <EventLog events={state.events} onExport={handleExportLog} />
        </div>
      </div>
    </div>
  );
}
