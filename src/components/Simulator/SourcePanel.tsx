
import type { CircuitComponent } from '../../core/types';
import { COLORS } from '../../core/constants';

interface SourcePanelProps {
  source: CircuitComponent;
  onVoltageChange: (percent: number) => void;
  onFrequencyChange: (hz: number) => void;
  onFailToggle: () => void;
}

export function SourcePanel({ source, onVoltageChange, onFrequencyChange, onFailToggle }: SourcePanelProps) {
  const nomFreq = source.properties.nominalFrequency ?? 60;
  const color = source.state.failed ? COLORS.failed : source.state.energized ? COLORS.energized : COLORS.deenergized;

  return (
    <div style={{
      background: '#0f172a', border: `1px solid ${color}33`, borderRadius: 6,
      padding: 12, minWidth: 180,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, color, fontFamily: 'monospace', fontWeight: 600 }}>{source.tag}</span>
        <span style={{ fontSize: 11, color: COLORS.textDim, fontFamily: 'monospace', textTransform: 'uppercase' }}>
          {source.type === "utility-source" ? "Utility" : "Generator"}
        </span>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <label style={{ fontSize: 11, color: COLORS.textDim, fontFamily: 'monospace' }}>Voltage</label>
          <span style={{ fontSize: 12, color: COLORS.text, fontFamily: 'monospace' }}>{source.state.voltagePercent.toFixed(0)}%</span>
        </div>
        <input
          type="range" min={0} max={120} step={1}
          value={source.state.voltagePercent}
          onChange={(e) => onVoltageChange(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: color }}
          disabled={source.state.failed}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <label style={{ fontSize: 11, color: COLORS.textDim, fontFamily: 'monospace' }}>Frequency</label>
          <span style={{ fontSize: 12, color: COLORS.text, fontFamily: 'monospace' }}>{source.state.frequencyHz.toFixed(1)} Hz</span>
        </div>
        <input
          type="range" min={45} max={70} step={0.1}
          value={source.state.frequencyHz}
          onChange={(e) => onFrequencyChange(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: color }}
          disabled={source.state.failed}
        />
        <div style={{ fontSize: 10, color: COLORS.textDim, fontFamily: 'monospace', marginTop: 2 }}>
          Nominal: {nomFreq} Hz
        </div>
      </div>

      <button
        onClick={onFailToggle}
        style={{
          width: '100%', padding: '6px 0',
          background: source.state.failed ? '#7f1d1d' : '#1e293b',
          border: `1px solid ${source.state.failed ? COLORS.tripped : '#334155'}`,
          borderRadius: 4, color: source.state.failed ? COLORS.tripped : COLORS.text,
          cursor: 'pointer', fontSize: 12, fontFamily: 'monospace',
        }}
      >
        {source.state.failed ? '⚠ FAILED — Click to Restore' : 'Simulate Failure'}
      </button>

      <div style={{ marginTop: 8, fontSize: 11, color: COLORS.textDim, fontFamily: 'monospace' }}>
        Status: <span style={{ color }}>{source.state.failed ? 'FAILED' : source.state.energized ? 'LIVE' : 'STANDBY'}</span>
      </div>
    </div>
  );
}
