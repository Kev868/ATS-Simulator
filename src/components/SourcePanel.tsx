import React from 'react';
import { Source, SourceHealth } from '../engine/types';

interface Props {
  source: Source;
  health: SourceHealth;
  faults: string[];
  onUpdate: (partial: Partial<Source>) => void;
}

const healthColor: Record<SourceHealth, string> = {
  HEALTHY: '#22c55e',
  DEGRADED: '#f59e0b',
  FAILED: '#ef4444',
};

const faultColor: Record<string, string> = {
  UV: '#f59e0b',
  OV: '#ef4444',
  UF: '#3b82f6',
  OF: '#a855f7',
  DEAD: '#ef4444',
  UNAVAILABLE: '#6b7280',
};

const sourceAccent: Record<string, string> = {
  M1: '#22c55e',
  M2: '#3b82f6',
  M3: '#a855f7',
};

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  accent?: string;
}

function SliderRow({ label, value, min, max, step, unit, onChange, accent = '#3b82f6' }: SliderRowProps) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{label}</span>
        <span style={{ color: accent, fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600 }}>
          {value.toFixed(step < 1 ? 1 : 0)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: accent }}
      />
    </div>
  );
}

export default function SourcePanel({ source, health, faults, onUpdate }: Props) {
  const accent = sourceAccent[source.id] ?? '#94a3b8';

  return (
    <div style={{
      background: '#1e293b',
      border: `1px solid ${accent}33`,
      borderRadius: '8px',
      padding: '14px',
      marginBottom: '10px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: accent,
            boxShadow: `0 0 6px ${accent}`,
          }} />
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem' }}>
            {source.id}
          </span>
          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{source.label}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Health badge */}
          <span style={{
            background: healthColor[health] + '22',
            color: healthColor[health],
            border: `1px solid ${healthColor[health]}66`,
            padding: '2px 8px',
            borderRadius: '99px',
            fontSize: '0.72rem',
            fontWeight: 700,
          }}>
            {health}
          </span>

          {/* Available toggle */}
          <button
            onClick={() => onUpdate({ available: !source.available })}
            style={{
              background: source.available ? '#22c55e22' : '#ef444422',
              color: source.available ? '#22c55e' : '#ef4444',
              border: `1px solid ${source.available ? '#22c55e66' : '#ef444466'}`,
              borderRadius: '99px',
              padding: '2px 10px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {source.available ? 'AVAIL' : 'UNAVAIL'}
          </button>
        </div>
      </div>

      {/* Fault indicators */}
      {faults.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {faults.map(f => (
            <span key={f} style={{
              background: (faultColor[f] ?? '#64748b') + '22',
              color: faultColor[f] ?? '#64748b',
              border: `1px solid ${(faultColor[f] ?? '#64748b')}66`,
              padding: '1px 6px',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 700,
            }}>
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Sliders */}
      <SliderRow
        label="Voltage"
        value={source.voltage}
        min={0}
        max={130}
        step={1}
        unit="% nom"
        onChange={v => onUpdate({ voltage: v })}
        accent={accent}
      />
      <SliderRow
        label="Frequency"
        value={source.frequency}
        min={55}
        max={65}
        step={0.1}
        unit="Hz"
        onChange={v => onUpdate({ frequency: v })}
        accent={accent}
      />
      <SliderRow
        label="Phase Angle"
        value={source.phaseAngle}
        min={-180}
        max={180}
        step={1}
        unit="°"
        onChange={v => onUpdate({ phaseAngle: v })}
        accent={accent}
      />
    </div>
  );
}
