// ─── Topology Viewer ──────────────────────────────────────────────────────────
// View mode: displays a loaded or preset TopologyModel as a read-only schematic.
//
// Two action paths:
//   "Run Simulation" → detects nearest preset FSM, launches simulator
//   "Edit in Builder" → imports GraphTopology into the builder (best-effort)
//
// Warnings surfaced from the interpreter are shown in a collapsible banner.

import React, { useState } from 'react';
import { TopologyModel, detectSimPreset } from '../engine/TopologyInterpreter';
import { GraphTopology } from '../engine/graphTopology';
import { Topology } from '../engine/types';
import TopologyRenderer from './TopologyRenderer';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  model: TopologyModel;
  onRunSimulation: (preset: Topology) => void;
  onEditInBuilder: (topo: GraphTopology) => void;
  onBack: () => void;
}

// ─── Source detail row ────────────────────────────────────────────────────────

function SourceRow({ tag, role, voltage, frequency }: {
  tag: string; role: string; voltage?: number; frequency?: number;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 500 }}>{tag}</div>
      <div style={{ color: '#475569', fontSize: '0.7rem' }}>
        {voltage ?? 100}% · {frequency ?? 60} Hz
      </div>
      <div style={{ color: '#334155', fontSize: '0.68rem', marginTop: 1 }}>
        {role.replace(/_/g, ' ')}
      </div>
    </div>
  );
}

// ─── Summary stat row ─────────────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '5px 0', borderBottom: '1px solid #0f1e35',
    }}>
      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{label}</span>
      <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: '#334155', fontSize: '0.68rem', letterSpacing: '0.1em',
      textTransform: 'uppercase', marginTop: 18, marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TopologyViewer({ model, onRunSimulation, onEditInBuilder, onBack }: Props) {
  const [warningsOpen, setWarningsOpen] = useState(false);

  const { metadata, components, wires, warnings } = model;

  const sources  = components.filter(c => c.type === 'SOURCE');
  const breakers = components.filter(c => c.type === 'BREAKER' || c.type === 'CONTACTOR');
  const buses    = components.filter(c => c.type === 'BUS');
  const loads    = components.filter(c => c.type === 'LOAD');
  const energized = components.filter(c => c.energization.energized);

  const preset = detectSimPreset(model);

  // ── Shared button style ────────────────────────────────────────────────────
  const btn = (bg: string, fg: string, border: string): React.CSSProperties => ({
    background: bg, color: fg, border: `1px solid ${border}`,
    borderRadius: 5, padding: '8px 16px', cursor: 'pointer',
    fontSize: '0.82rem', fontWeight: 500, whiteSpace: 'nowrap',
  });

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#080f1e', color: '#f1f5f9',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 18px', borderBottom: '1px solid #1e3a5f',
        background: '#0a1325', flexShrink: 0, gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <button
            onClick={onBack}
            style={btn('transparent', '#64748b', '#1e3a5f')}
          >
            ← Menu
          </button>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {metadata.name}
            </div>
            {metadata.filename && (
              <div style={{ color: '#334155', fontSize: '0.72rem', marginTop: 1 }}>
                {metadata.filename}
              </div>
            )}
          </div>

          <div style={{
            background: '#0f2d50', color: '#60a5fa', fontSize: '0.68rem',
            padding: '2px 8px', borderRadius: 3, border: '1px solid #1e4a7a',
            letterSpacing: '0.08em', flexShrink: 0,
          }}>
            VIEW MODE
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => onEditInBuilder(model.raw)}
            style={btn('#1e3a5f', '#93c5fd', '#2d5a8f')}
          >
            Edit in Builder
          </button>
          <button
            onClick={() => onRunSimulation(preset)}
            style={btn('#1d4ed8', '#dbeafe', '#2563eb')}
          >
            Run Simulation →
          </button>
        </div>
      </header>

      {/* ── Warning banner ────────────────────────────────────────────────── */}
      {warnings.length > 0 && (
        <div style={{
          background: '#1a1204', borderBottom: '1px solid #6b3a00',
          padding: '7px 18px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.78rem' }}>
              ⚠ {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setWarningsOpen(o => !o)}
              style={{
                background: 'transparent', border: 'none',
                color: '#64748b', cursor: 'pointer', fontSize: '0.72rem',
                padding: '0 4px',
              }}
            >
              {warningsOpen ? 'Hide ▲' : 'Show ▼'}
            </button>
          </div>
          {warningsOpen && (
            <ul style={{
              margin: '6px 0 2px', paddingLeft: 20,
              color: '#fbbf24', fontSize: '0.76rem', lineHeight: 1.7,
            }}>
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Renderer */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <TopologyRenderer model={model} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* Side panel */}
        <div style={{
          width: 210, flexShrink: 0,
          borderLeft: '1px solid #1e3a5f', background: '#0a1325',
          padding: '16px 14px', overflowY: 'auto',
        }}>
          <SectionHead>Topology Summary</SectionHead>
          <StatRow label="Sources"   value={sources.length}  />
          <StatRow label="Breakers"  value={breakers.length} />
          <StatRow label="Buses"     value={buses.length}    />
          <StatRow label="Loads"     value={loads.length}    />
          <StatRow label="Wires"     value={wires.length}    />
          <StatRow label="Energized" value={`${energized.length}/${components.length}`} />

          <SectionHead>Simulation Preset</SectionHead>
          <div style={{
            color: '#60a5fa', fontSize: '0.82rem', fontFamily: 'monospace',
            background: '#0f1e35', padding: '6px 10px', borderRadius: 4,
          }}>
            {preset}
          </div>
          <div style={{ color: '#334155', fontSize: '0.68rem', marginTop: 4, lineHeight: 1.5 }}>
            Nearest FSM topology inferred from component roles.
            Click "Run Simulation" to launch.
          </div>

          <SectionHead>Canvas</SectionHead>
          <div style={{ color: '#475569', fontSize: '0.76rem', fontFamily: 'monospace' }}>
            {metadata.canvasW} × {metadata.canvasH} grid
          </div>
          <div style={{ color: '#334155', fontSize: '0.68rem', marginTop: 2 }}>
            {metadata.gridPx} px / unit
          </div>

          {sources.length > 0 && (
            <>
              <SectionHead>Sources</SectionHead>
              {sources.map(s => (
                <SourceRow
                  key={s.id}
                  tag={s.tag}
                  role={s.role}
                  voltage={s.props.voltage}
                  frequency={s.props.frequency}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
