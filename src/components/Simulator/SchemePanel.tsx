import React from 'react';
import type { CircuitModel, SchemeSettings } from '../../core/types';
import { COLORS } from '../../core/constants';

interface SchemePanelProps {
  model: CircuitModel;
  onSettingsChange: (settings: SchemeSettings) => void;
}

const inputStyle: React.CSSProperties = {
  background: '#0f172a', border: '1px solid #334155', borderRadius: 4,
  padding: '4px 8px', color: COLORS.text, fontSize: 12, fontFamily: 'monospace', width: '100%',
  boxSizing: 'border-box',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
      <span style={{ fontSize: 12, color: COLORS.textDim, fontFamily: 'monospace', flexShrink: 0 }}>{label}</span>
      <div style={{ width: 110 }}>{children}</div>
    </div>
  );
}

export function SchemePanel({ model, onSettingsChange }: SchemePanelProps) {
  const s = model.schemeSettings;
  const sources = model.components.filter((c) => c.type === "utility-source" || c.type === "generator-source");

  const upd = (field: keyof SchemeSettings, value: unknown) => {
    onSettingsChange({ ...s, [field]: value });
  };

  return (
    <div style={{ padding: 12, overflowY: 'auto' }}>
      <div style={{ fontSize: 11, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
        Scheme Settings
      </div>

      <Row label="Transfer Mode">
        <select style={inputStyle} value={s.transferMode} onChange={(e) => upd('transferMode', e.target.value)}>
          <option value="open-transition">Open Transition</option>
          <option value="closed-transition">Closed Transition</option>
          <option value="fast-transfer">Fast Transfer</option>
        </select>
      </Row>

      <Row label="Preferred Source">
        <select style={inputStyle} value={s.preferredSourceId ?? ''} onChange={(e) => upd('preferredSourceId', e.target.value || null)}>
          <option value="">None</option>
          {sources.map((src) => (
            <option key={src.id} value={src.id}>{src.tag}</option>
          ))}
        </select>
      </Row>

      <Row label="Auto Retransfer">
        <input type="checkbox" checked={s.autoRetransfer} onChange={(e) => upd('autoRetransfer', e.target.checked)} />
      </Row>

      <div style={{ borderTop: '1px solid #1e293b', paddingTop: 8, marginTop: 8, marginBottom: 8, fontSize: 11, color: COLORS.textDim, textTransform: 'uppercase' }}>
        Pickup Setpoints
      </div>

      <Row label="UV Pickup (%)">
        <input style={inputStyle} type="number" value={s.undervoltagePickup} onChange={(e) => upd('undervoltagePickup', parseFloat(e.target.value))} />
      </Row>
      <Row label="OV Pickup (%)">
        <input style={inputStyle} type="number" value={s.overvoltagePickup} onChange={(e) => upd('overvoltagePickup', parseFloat(e.target.value))} />
      </Row>
      <Row label="UF Pickup (Hz)">
        <input style={inputStyle} type="number" value={s.underfrequencyPickup} onChange={(e) => upd('underfrequencyPickup', parseFloat(e.target.value))} />
      </Row>
      <Row label="OF Pickup (Hz)">
        <input style={inputStyle} type="number" value={s.overfrequencyPickup} onChange={(e) => upd('overfrequencyPickup', parseFloat(e.target.value))} />
      </Row>

      <div style={{ borderTop: '1px solid #1e293b', paddingTop: 8, marginTop: 8, marginBottom: 8, fontSize: 11, color: COLORS.textDim, textTransform: 'uppercase' }}>
        Timers (ms)
      </div>

      <Row label="Pickup Delay">
        <input style={inputStyle} type="number" value={s.pickupDelay} onChange={(e) => upd('pickupDelay', parseInt(e.target.value))} />
      </Row>
      <Row label="Transfer Delay">
        <input style={inputStyle} type="number" value={s.transferDelay} onChange={(e) => upd('transferDelay', parseInt(e.target.value))} />
      </Row>
      <Row label="Retransfer Delay">
        <input style={inputStyle} type="number" value={s.retransferDelay} onChange={(e) => upd('retransferDelay', parseInt(e.target.value))} />
      </Row>

      {s.transferMode === "closed-transition" && (
        <>
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 8, marginTop: 8, marginBottom: 8, fontSize: 11, color: COLORS.textDim, textTransform: 'uppercase' }}>
            Sync Check
          </div>
          <Row label="ΔV (%)">
            <input style={inputStyle} type="number" step={0.1} value={s.syncCheckDeltaV} onChange={(e) => upd('syncCheckDeltaV', parseFloat(e.target.value))} />
          </Row>
          <Row label="Δf (Hz)">
            <input style={inputStyle} type="number" step={0.1} value={s.syncCheckDeltaF} onChange={(e) => upd('syncCheckDeltaF', parseFloat(e.target.value))} />
          </Row>
          <Row label="Δφ (°)">
            <input style={inputStyle} type="number" step={1} value={s.syncCheckDeltaPhi} onChange={(e) => upd('syncCheckDeltaPhi', parseFloat(e.target.value))} />
          </Row>
          <Row label="Max Parallel (ms)">
            <input style={inputStyle} type="number" value={s.maxParallelTime} onChange={(e) => upd('maxParallelTime', parseInt(e.target.value))} />
          </Row>
        </>
      )}
    </div>
  );
}
