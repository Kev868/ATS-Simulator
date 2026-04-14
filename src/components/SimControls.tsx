import React, { useEffect } from 'react';
import { SimState } from '../engine/types';

interface Dispatch {
  startSim: () => void;
  pauseSim: () => void;
  resetSim: () => void;
  setSpeed: (speed: number) => void;
  resetLockout: () => void;
  stepOnce: () => void;
  exportLog: () => string;
}

interface Props {
  state: SimState;
  dispatch: Dispatch;
}

// Ordered from slowest to fastest — used for [ / ] keyboard navigation
const SPEED_PRESETS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5];

function formatSimTime(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `T+${s.toFixed(3)}s`;
  const min = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3);
  return `T+${min}m${sec}s`;
}

function formatSpeed(s: number): string {
  if (s < 1) return `${s}x`;
  return `${s}x`;
}

const schemeStateColor: Record<string, string> = {
  NORMAL_M1: '#22c55e',
  NORMAL_M2: '#3b82f6',
  NORMAL_M3: '#a855f7',
  TIE_FROM_M1: '#22c55e',
  TIE_FROM_M2: '#3b82f6',
  TIE_FROM_M3: '#a855f7',
  BOTH_DEAD: '#ef4444',
  ALL_DEAD: '#ef4444',
  PARALLEL: '#f59e0b',
  LOCKOUT: '#ef4444',
  MANUAL_OVERRIDE: '#8b5cf6',
  INIT: '#64748b',
};

export default function SimControls({ state, dispatch }: Props) {
  const { isRunning, isPaused, speed, schemeState, simTimeMs, transferCount, lockoutActive } = state;
  const isSlowMotion = speed <= 0.25;

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't fire when user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!isRunning) {
          dispatch.startSim();
        } else {
          dispatch.pauseSim();
        }
      } else if (e.key === '[') {
        const idx = SPEED_PRESETS.indexOf(speed);
        if (idx > 0) dispatch.setSpeed(SPEED_PRESETS[idx - 1]);
      } else if (e.key === ']') {
        const idx = SPEED_PRESETS.indexOf(speed);
        if (idx < SPEED_PRESETS.length - 1) dispatch.setSpeed(SPEED_PRESETS[idx + 1]);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isRunning, isPaused, speed, dispatch]);

  // ── Styles ─────────────────────────────────────────────────────────────────
  const btnBase: React.CSSProperties = {
    padding: '7px 14px',
    borderRadius: '6px',
    border: '1px solid #334155',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 600,
    fontFamily: 'inherit',
  };

  const primaryBtn: React.CSSProperties = {
    ...btnBase,
    background: '#3b82f6',
    color: '#fff',
    border: '1px solid #2563eb',
  };

  const dangerBtn: React.CSSProperties = {
    ...btnBase,
    background: '#7f1d1d',
    color: '#f87171',
    border: '1px solid #991b1b',
  };

  const neutralBtn: React.CSSProperties = {
    ...btnBase,
    background: '#1e293b',
    color: '#94a3b8',
  };

  const speedBtn = (s: number): React.CSSProperties => ({
    ...btnBase,
    background: speed === s ? '#334155' : '#0f172a',
    color: speed === s ? '#e2e8f0' : '#64748b',
    border: speed === s ? '1px solid #475569' : '1px solid #1e293b',
    padding: '5px 9px',
    fontSize: '0.73rem',
    minWidth: '38px',
  });

  const handleExport = () => {
    const csv = dispatch.exportLog();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ats-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      background: '#0f172a',
      borderBottom: '1px solid #1e293b',
      padding: '8px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flexWrap: 'wrap',
    }}>

      {/* ── Playback ─────────────────────────────────────────────────────── */}
      {!isRunning ? (
        <button style={primaryBtn} onClick={dispatch.startSim} title="Start simulation (Space)">
          ▶ Start
        </button>
      ) : (
        <button
          style={{ ...primaryBtn, background: isPaused ? '#16a34a' : '#1d4ed8' }}
          onClick={dispatch.pauseSim}
          title={isPaused ? 'Resume (Space)' : 'Pause (Space)'}
        >
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>
      )}

      <button style={neutralBtn} onClick={dispatch.stepOnce} title="Advance exactly 10 ms simulated time">
        ⏭ Step
      </button>

      <button style={{ ...neutralBtn, color: '#f87171' }} onClick={dispatch.resetSim}>
        ↺ Reset
      </button>

      <div style={{ width: 1, height: 28, background: '#334155', flexShrink: 0 }} />

      {/* ── Speed control ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ color: '#64748b', fontSize: '0.73rem', marginRight: '2px', whiteSpace: 'nowrap' }}>
          Speed <span style={{ color: '#475569', fontSize: '0.65rem' }}>[/]</span>:
        </span>
        {SPEED_PRESETS.map(s => (
          <button key={s} style={speedBtn(s)} onClick={() => dispatch.setSpeed(s)}>
            {formatSpeed(s)}
          </button>
        ))}
      </div>

      {/* ── Speed indicator + SLOW MOTION badge ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{
          background: '#1e293b',
          border: '1px solid #334155',
          color: isSlowMotion ? '#f59e0b' : '#e2e8f0',
          padding: '3px 9px',
          borderRadius: '99px',
          fontSize: '0.75rem',
          fontWeight: 700,
          fontFamily: 'monospace',
          minWidth: '42px',
          textAlign: 'center',
        }}>
          {formatSpeed(speed)}
        </span>

        {isSlowMotion && (
          <span style={{
            background: '#78350f22',
            border: '1px solid #f59e0b66',
            color: '#f59e0b',
            padding: '3px 8px',
            borderRadius: '99px',
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            animation: 'pulse 2s ease-in-out infinite',
          }}>
            SLOW MOTION
          </span>
        )}
      </div>

      <div style={{ width: 1, height: 28, background: '#334155', flexShrink: 0 }} />

      {/* ── Sim time ─────────────────────────────────────────────────────── */}
      <span style={{
        color: isSlowMotion ? '#fbbf24' : '#22c55e',
        fontFamily: 'monospace',
        fontSize: '0.95rem',
        fontWeight: 700,
        minWidth: '120px',
        letterSpacing: '0.01em',
      }}>
        {formatSimTime(simTimeMs)}
      </span>

      {/* ── Scheme state badge ───────────────────────────────────────────── */}
      <span style={{
        background: (schemeStateColor[schemeState] ?? '#475569') + '22',
        color: schemeStateColor[schemeState] ?? '#94a3b8',
        border: `1px solid ${(schemeStateColor[schemeState] ?? '#475569')}66`,
        padding: '3px 10px',
        borderRadius: '99px',
        fontSize: '0.75rem',
        fontWeight: 700,
        fontFamily: 'monospace',
      }}>
        {schemeState}
      </span>

      {/* ── Transfer count ───────────────────────────────────────────────── */}
      <span style={{ color: '#64748b', fontSize: '0.78rem' }}>
        Transfers: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{transferCount}</span>
      </span>

      {/* ── Lockout ──────────────────────────────────────────────────────── */}
      {lockoutActive && (
        <>
          <span style={{
            background: '#7f1d1d',
            color: '#f87171',
            padding: '3px 10px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 700,
            animation: 'pulse 1s infinite',
          }}>
            LOCKOUT (86)
          </span>
          <button style={dangerBtn} onClick={dispatch.resetLockout}>
            Reset Lockout
          </button>
        </>
      )}

      {/* ── Keyboard hint ───────────────────────────────────────────────── */}
      <span style={{ color: '#334155', fontSize: '0.68rem', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
        Space = pause · [ ] = speed
      </span>

      {/* ── Export ───────────────────────────────────────────────────────── */}
      <button
        style={neutralBtn}
        onClick={handleExport}
        title="Export event log as CSV"
      >
        Export Log
      </button>
    </div>
  );
}
