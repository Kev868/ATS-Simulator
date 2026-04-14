import React, { useState } from 'react';
import { SimState, TransferMode, Setpoints } from '../engine/types';

interface Props {
  state: SimState;
  dispatch: {
    setTransferMode: (mode: TransferMode) => void;
    updateSetpoints: (partial: Partial<Setpoints>) => void;
    updateBusLoad: (busId: string, loadKW: number) => void;
  };
}

const modeDescriptions: Record<TransferMode, string> = {
  OPEN_TRANSITION: 'Opens outgoing source before closing incoming. Brief interruption (~50–100ms).',
  CLOSED_TRANSITION: 'Closes incoming source first (ANSI 25 sync check required), then opens outgoing. No interruption.',
  FAST_TRANSFER: 'Opens outgoing and closes incoming nearly simultaneously (<3 cycles). Minimal interruption.',
};

function NumberInput({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
      <label style={{ color: '#94a3b8', fontSize: '0.78rem', flex: 1 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step ?? 1}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{
            width: '70px',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '4px',
            color: '#e2e8f0',
            padding: '3px 6px',
            fontSize: '0.78rem',
            textAlign: 'right',
          }}
        />
        <span style={{ color: '#64748b', fontSize: '0.72rem', minWidth: '28px' }}>{unit}</span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{
        color: '#64748b',
        fontSize: '0.7rem',
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        marginBottom: '8px',
        borderBottom: '1px solid #1e293b',
        paddingBottom: '4px',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function SchemeSettings({ state, dispatch }: Props) {
  const [activeTab, setActiveTab] = useState<'transfer' | 'setpoints'>('transfer');
  const { setpoints, transferMode, buses } = state;

  const tabStyle = (tab: typeof activeTab): React.CSSProperties => ({
    padding: '6px 16px',
    background: activeTab === tab ? '#334155' : 'transparent',
    color: activeTab === tab ? '#e2e8f0' : '#64748b',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: activeTab === tab ? 600 : 400,
  });

  const modeButtonStyle = (mode: TransferMode): React.CSSProperties => ({
    padding: '6px 10px',
    background: transferMode === mode ? '#3b82f6' : '#1e293b',
    color: transferMode === mode ? '#fff' : '#64748b',
    border: `1px solid ${transferMode === mode ? '#3b82f6' : '#334155'}`,
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: transferMode === mode ? 600 : 400,
  });

  const preferredButtonStyle = (pref: Setpoints['preferredSource']): React.CSSProperties => ({
    padding: '5px 10px',
    background: setpoints.preferredSource === pref ? '#22c55e22' : '#1e293b',
    color: setpoints.preferredSource === pref ? '#22c55e' : '#64748b',
    border: `1px solid ${setpoints.preferredSource === pref ? '#22c55e66' : '#334155'}`,
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.75rem',
  });

  return (
    <div style={{
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      padding: '14px',
      marginBottom: '10px',
    }}>
      <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '10px' }}>
        SCHEME SETTINGS
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', background: '#0f172a', padding: '3px', borderRadius: '8px' }}>
        <button style={tabStyle('transfer')} onClick={() => setActiveTab('transfer')}>Transfer</button>
        <button style={tabStyle('setpoints')} onClick={() => setActiveTab('setpoints')}>Setpoints</button>
      </div>

      {activeTab === 'transfer' && (
        <div>
          <Section title="Transfer Mode">
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {(['OPEN_TRANSITION', 'CLOSED_TRANSITION', 'FAST_TRANSFER'] as TransferMode[]).map(mode => (
                <button key={mode} style={modeButtonStyle(mode)} onClick={() => dispatch.setTransferMode(mode)}>
                  {mode === 'OPEN_TRANSITION' ? 'Open Trans.' : mode === 'CLOSED_TRANSITION' ? 'Closed Trans.' : 'Fast Transfer'}
                </button>
              ))}
            </div>
            <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0, lineHeight: 1.4 }}>
              {modeDescriptions[transferMode]}
            </p>
          </Section>

          <Section title="Preferred Source">
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['M1', 'M2', 'LAST_LIVE'] as Setpoints['preferredSource'][]).map(pref => (
                <button
                  key={pref}
                  style={preferredButtonStyle(pref)}
                  onClick={() => dispatch.updateSetpoints({ preferredSource: pref })}
                >
                  {pref === 'LAST_LIVE' ? 'Last Live' : pref}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Auto-Retransfer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => dispatch.updateSetpoints({ autoRetransfer: !setpoints.autoRetransfer })}
                style={{
                  padding: '5px 14px',
                  background: setpoints.autoRetransfer ? '#22c55e22' : '#1e293b',
                  color: setpoints.autoRetransfer ? '#22c55e' : '#64748b',
                  border: `1px solid ${setpoints.autoRetransfer ? '#22c55e66' : '#334155'}`,
                  borderRadius: '99px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                }}
              >
                {setpoints.autoRetransfer ? 'ENABLED' : 'DISABLED'}
              </button>
              <span style={{ color: '#475569', fontSize: '0.75rem' }}>
                Retransfer to preferred after {(setpoints.retransferDelay / 1000).toFixed(1)}s
              </span>
            </div>
          </Section>

          <Section title="Bus Loads">
            {buses.map(bus => (
              <div key={bus.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.78rem', minWidth: '50px' }}>{bus.label}</span>
                <input
                  type="range"
                  min={0}
                  max={5000}
                  step={50}
                  value={bus.loadKW}
                  onChange={e => dispatch.updateBusLoad(bus.id, parseInt(e.target.value))}
                  style={{ flex: 1, accentColor: '#3b82f6' }}
                />
                <span style={{ color: '#3b82f6', fontSize: '0.78rem', fontFamily: 'monospace', minWidth: '60px' }}>
                  {bus.loadKW} kW
                </span>
              </div>
            ))}
          </Section>
        </div>
      )}

      {activeTab === 'setpoints' && (
        <div style={{ maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
          <Section title="ANSI 27 — Undervoltage">
            <NumberInput label="UV Threshold" value={setpoints.uvThreshold} unit="%" min={50} max={95} onChange={v => dispatch.updateSetpoints({ uvThreshold: v })} />
            <NumberInput label="UV Pickup Time" value={setpoints.uvPickupTime} unit="ms" min={100} max={10000} step={100} onChange={v => dispatch.updateSetpoints({ uvPickupTime: v })} />
          </Section>

          <Section title="ANSI 59 — Overvoltage">
            <NumberInput label="OV Threshold" value={setpoints.ovThreshold} unit="%" min={105} max={130} onChange={v => dispatch.updateSetpoints({ ovThreshold: v })} />
            <NumberInput label="OV Pickup Time" value={setpoints.ovPickupTime} unit="ms" min={100} max={5000} step={100} onChange={v => dispatch.updateSetpoints({ ovPickupTime: v })} />
          </Section>

          <Section title="ANSI 81U — Underfrequency">
            <NumberInput label="UF Threshold" value={setpoints.ufThreshold} unit="Hz" min={55} max={59.9} step={0.1} onChange={v => dispatch.updateSetpoints({ ufThreshold: v })} />
            <NumberInput label="UF Pickup Time" value={setpoints.ufPickupTime} unit="ms" min={100} max={10000} step={100} onChange={v => dispatch.updateSetpoints({ ufPickupTime: v })} />
          </Section>

          <Section title="ANSI 81O — Overfrequency">
            <NumberInput label="OF Threshold" value={setpoints.ofThreshold} unit="Hz" min={60.1} max={65} step={0.1} onChange={v => dispatch.updateSetpoints({ ofThreshold: v })} />
            <NumberInput label="OF Pickup Time" value={setpoints.ofPickupTime} unit="ms" min={100} max={5000} step={100} onChange={v => dispatch.updateSetpoints({ ofPickupTime: v })} />
          </Section>

          <Section title="Transfer Timing">
            <NumberInput label="Transfer Delay" value={setpoints.transferDelay} unit="ms" min={0} max={5000} step={50} onChange={v => dispatch.updateSetpoints({ transferDelay: v })} />
            <NumberInput label="Retransfer Delay" value={setpoints.retransferDelay} unit="ms" min={1000} max={120000} step={1000} onChange={v => dispatch.updateSetpoints({ retransferDelay: v })} />
          </Section>

          <Section title="ANSI 25 — Sync Check">
            <NumberInput label="ΔV Limit" value={setpoints.syncCheckDV} unit="%" min={1} max={20} step={0.5} onChange={v => dispatch.updateSetpoints({ syncCheckDV: v })} />
            <NumberInput label="Δf Limit" value={setpoints.syncCheckDf} unit="Hz" min={0.05} max={2} step={0.05} onChange={v => dispatch.updateSetpoints({ syncCheckDf: v })} />
            <NumberInput label="Δφ Limit" value={setpoints.syncCheckDPhi} unit="°" min={1} max={45} onChange={v => dispatch.updateSetpoints({ syncCheckDPhi: v })} />
            <NumberInput label="Max Parallel Time" value={setpoints.maxParallelTimeMs} unit="ms" min={50} max={1000} step={10} onChange={v => dispatch.updateSetpoints({ maxParallelTimeMs: v })} />
          </Section>

          <Section title="Dead Bus/Source">
            <NumberInput label="Dead Bus Threshold" value={setpoints.deadBusThreshold} unit="%" min={5} max={40} onChange={v => dispatch.updateSetpoints({ deadBusThreshold: v })} />
            <NumberInput label="Dead Source Threshold" value={setpoints.deadSourceThreshold} unit="%" min={5} max={40} onChange={v => dispatch.updateSetpoints({ deadSourceThreshold: v })} />
          </Section>

          <Section title="ANSI 86 — Lockout">
            <NumberInput label="Max Transfers" value={setpoints.maxTransfersInWindow} unit="ops" min={1} max={10} onChange={v => dispatch.updateSetpoints({ maxTransfersInWindow: v })} />
            <NumberInput label="Transfer Window" value={setpoints.transferWindowMs} unit="ms" min={5000} max={300000} step={5000} onChange={v => dispatch.updateSetpoints({ transferWindowMs: v })} />
          </Section>
        </div>
      )}
    </div>
  );
}
