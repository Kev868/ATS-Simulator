import { useState, useMemo, useCallback } from 'react';
import { Topology } from './engine/types';
import { GraphTopology } from './engine/graphTopology';
import { TopologyModel as InterpreterModel } from './engine/TopologyInterpreter';
import { TopologyModel, Component } from './models/TopologyModel';
import { graphTopologyToModel } from './models/convertGraphTopology';
import { useSimulation } from './hooks/useSimulation';
import { computeModelEnergization } from './engine/computeEnergization';
import { getPresetModel } from './presets';
import TopologyMenu from './components/TopologyMenu';
import TopologyBuilder from './components/TopologyBuilder';
import TopologyViewer from './components/TopologyViewer';
import SimulationRenderer from './components/SimulationRenderer';
import SourcePanel from './components/SourcePanel';
import SchemeSettings from './components/SchemeSettings';
import EventLog from './components/EventLog';
import SimControls from './components/SimControls';
import ScenarioSelector from './components/ScenarioSelector';
import './App.css';

type AppView = 'MENU' | 'BUILD' | 'VIEW' | 'SIM';

export default function App() {
  const [view,              setView]              = useState<AppView>('MENU');
  const [topology,          setTopology]          = useState<Topology | null>(null);
  const [loadedModel,       setLoadedModel]       = useState<InterpreterModel | null>(null);
  const [customModel,       setCustomModel]       = useState<TopologyModel | null>(null);
  const [initialBuilderTopo, setInitialBuilderTopo] = useState<GraphTopology | null>(null);
  // Incrementing builderKey forces TopologyBuilder to fully remount so its
  // lazy useReducer initializer runs with the correct initialTopo.
  const [builderKey, setBuilderKey] = useState(0);
  const sim = useSimulation();

  // ── Preset topology selected from menu ────────────────────────────────────
  const handleSelectTopology = (t: Topology) => {
    setTopology(t);
    sim.dispatch.setTopology(t);
    setView('SIM');
  };

  // ── File loaded from menu → go to View mode ───────────────────────────────
  const handleLoadFromMenu = (model: InterpreterModel) => {
    setLoadedModel(model);
    setView('VIEW');
  };

  // ── Run simulation from View mode ─────────────────────────────────────────
  const handleRunSimFromViewer = (preset: Topology) => {
    setTopology(preset);
    sim.dispatch.setTopology(preset);
    setView('SIM');
  };

  // ── Edit in Builder from View mode ────────────────────────────────────────
  const handleEditFromViewer = (topo: GraphTopology) => {
    setInitialBuilderTopo(topo);
    setBuilderKey(k => k + 1);
    setView('BUILD');
  };

  // ── Custom topology from builder → launch simulation ──────────────────────
  const handleCustomSim = (topo: GraphTopology) => {
    const model = graphTopologyToModel(topo, 'custom');
    console.log('TopologyModel passed to simulation:', JSON.stringify(model, null, 2));
    setCustomModel(model);
    setView('SIM');
  };

  // ── Reset → main menu ─────────────────────────────────────────────────────
  const handleReset = () => {
    sim.dispatch.resetSim();
    setTopology(null);
    setLoadedModel(null);
    setCustomModel(null);
    setInitialBuilderTopo(null);
    setView('MENU');
  };

  const handleExportLog = () => {
    const csv  = sim.dispatch.exportLog();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `ats-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render: main menu ─────────────────────────────────────────────────────
  if (view === 'MENU') {
    return (
      <TopologyMenu
        onSelect={handleSelectTopology}
        onCustom={() => { setInitialBuilderTopo(null); setView('BUILD'); }}
        onLoadFile={handleLoadFromMenu}
      />
    );
  }

  // ── Render: custom topology builder ──────────────────────────────────────
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

  // ── Render: topology viewer (loaded or imported) ──────────────────────────
  if (view === 'VIEW' && loadedModel) {
    return (
      <TopologyViewer
        model={loadedModel}
        onRunSimulation={handleRunSimFromViewer}
        onEditInBuilder={handleEditFromViewer}
        onBack={handleReset}
      />
    );
  }

  // ── Resolve the active TopologyModel ───────────────────────────────────────
  // Presets: derive from getPresetModel + overlay sim engine state.
  // Custom:  use customModel directly with local breaker state.
  const isCustom = !!customModel;
  const { state, dispatch } = sim;

  // For presets, build a TopologyModel with the engine's live breaker/source state overlaid
  const presetModel = useMemo(() => {
    if (!topology) return null;
    return getPresetModel(topology);
  }, [topology]);

  const liveModel: TopologyModel | null = useMemo(() => {
    if (isCustom && customModel) return customModel;
    if (!presetModel) return null;

    // Overlay sim engine's breaker states onto the preset model's components
    const updatedComponents: Component[] = presetModel.components.map(comp => {
      if (comp.type === 'breaker' || comp.type === 'switch') {
        const engineBreaker = state.breakers.find(b => b.id === comp.id);
        if (engineBreaker) {
          return {
            ...comp,
            properties: { ...comp.properties, breakerState: engineBreaker.state },
          };
        }
      }
      if (comp.type === 'utility-source' || comp.type === 'generator-source') {
        const engineSource = state.sources.find(s => s.id === comp.id);
        if (engineSource) {
          return {
            ...comp,
            properties: {
              ...comp.properties,
              voltage: engineSource.voltage,
              available: engineSource.available,
            },
          };
        }
      }
      return comp;
    });

    return { ...presetModel, components: updatedComponents };
  }, [isCustom, customModel, presetModel, state.breakers, state.sources]);

  // Compute energization from the live model
  const energization = useMemo(() => {
    if (!liveModel) return {};
    return computeModelEnergization(liveModel.components, liveModel.wires);
  }, [liveModel]);

  // ── Breaker click handler ─────────────────────────────────────────────────
  const handleBreakerClick = useCallback((componentId: string) => {
    if (isCustom && customModel) {
      // Custom: toggle breaker state directly in the model
      setCustomModel(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          components: prev.components.map(c => {
            if (c.id !== componentId) return c;
            const st = (c.properties.breakerState as string) ?? 'OPEN';
            const next = (st === 'CLOSED') ? 'OPEN' : 'CLOSED';
            return { ...c, properties: { ...c.properties, breakerState: next } };
          }),
        };
      });
    } else {
      // Preset: delegate to the sim engine
      const breaker = state.breakers.find(b => b.id === componentId);
      if (!breaker) return;
      if (breaker.state === 'CLOSED' || breaker.state === 'CLOSING') {
        dispatch.manualOpenBreaker(componentId);
      } else {
        dispatch.manualCloseBreaker(componentId);
      }
    }
  }, [isCustom, customModel, state.breakers, dispatch]);

  // ── Render: simulator ─────────────────────────────────────────────────────
  const displayName = isCustom ? (customModel?.name ?? 'Custom') : (topology ?? '');

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-left">
          <span className="header-title">ATS Simulator</span>
          <span className="header-topology">{displayName}</span>
        </div>
        <button className="change-topology-btn" onClick={handleReset}>
          Main Menu
        </button>
      </header>

      {!isCustom && <SimControls state={state} dispatch={dispatch} />}

      <div className="main-area">
        {/* Left Panel — only for presets with engine */}
        {!isCustom && (
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
        )}

        {/* Center Panel — SimulationRenderer for ALL topologies */}
        <div className="center-panel">
          {liveModel && (
            <SimulationRenderer
              model={liveModel}
              energization={energization}
              onBreakerClick={handleBreakerClick}
            />
          )}

          {/* Active Timers — only for presets */}
          {!isCustom && state.activeTimers.length > 0 && (
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
          {!isCustom && (
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
          )}
        </div>

        {/* Right Panel — only for presets */}
        {!isCustom && (
          <div className="right-panel">
            <EventLog events={state.events} onExport={handleExportLog} />
          </div>
        )}
      </div>
    </div>
  );
}
