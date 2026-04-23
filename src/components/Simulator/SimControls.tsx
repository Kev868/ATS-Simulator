import { useEffect, useRef, useState } from 'react';
import { COLORS } from '../../core/constants';

interface SimControlsProps {
  running: boolean;
  paused: boolean;
  speedMultiplier: number;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
}

function Btn({ label, onClick, active, color, className }: { label: string; onClick: () => void; active?: boolean; color?: string; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={className}
      style={{
        padding: '6px 14px',
        background: active ? (color ?? COLORS.selected) : '#1e293b',
        border: `1px solid ${active ? (color ?? COLORS.selected) : '#334155'}`,
        borderRadius: 4, color: COLORS.text, cursor: 'pointer',
        fontSize: 13, fontFamily: 'monospace',
      }}
    >
      {label}
    </button>
  );
}

export function SimControls({ running, paused, speedMultiplier, onStart, onStop, onPause, onReset, onSpeedChange }: SimControlsProps) {
  const [startPulse, setStartPulse] = useState(false);
  const prevRunning = useRef(running);
  useEffect(() => {
    if (running && !prevRunning.current) {
      setStartPulse(true);
      const t = setTimeout(() => setStartPulse(false), 420);
      prevRunning.current = running;
      return () => clearTimeout(t);
    }
    prevRunning.current = running;
  }, [running]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#0f172a', borderTop: '1px solid #1e293b' }}>
      {!running ? (
        <Btn
          label="▶ Start"
          onClick={onStart}
          active
          color="#16a34a"
          className={`btn-primary-green${startPulse ? ' btn-flash-pulse' : ''}`}
        />
      ) : (
        <>
          <Btn label={paused ? "▶ Resume" : "⏸ Pause"} onClick={onPause} active={paused} />
          <Btn label="■ Stop" onClick={onStop} color="#dc2626" className="btn-primary-red" />
        </>
      )}
      <Btn label="↺ Reset" onClick={onReset} />
      <div style={{ width: 1, height: 20, background: '#334155' }} />
      <span style={{ fontSize: 12, color: COLORS.textDim, fontFamily: 'monospace' }}>Speed:</span>
      {[0.25, 0.5, 1, 2, 5, 10].map((s) => (
        <Btn key={s} label={`${s}×`} onClick={() => onSpeedChange(s)} active={speedMultiplier === s} />
      ))}
    </div>
  );
}
