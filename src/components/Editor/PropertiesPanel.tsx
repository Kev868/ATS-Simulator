import React from 'react';
import type { CircuitComponent, CircuitModel } from '../../core/types';
import { COLORS } from '../../core/constants';

interface PropertiesPanelProps {
  component: CircuitComponent | null;
  model: CircuitModel;
  onUpdate: (id: string, updates: Partial<CircuitComponent>) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, color: COLORS.textDim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 4,
  padding: '6px 8px',
  color: COLORS.text,
  fontSize: 13,
  fontFamily: 'monospace',
  boxSizing: 'border-box',
};

export function PropertiesPanel({ component, model: _model, onUpdate }: PropertiesPanelProps) {
  if (!component) {
    return (
      <div className="panel-slide-right" style={{ width: 220, background: '#0f172a', borderLeft: '1px solid #1e293b', padding: 16, color: COLORS.textDim, fontSize: 13 }}>
        Select a component to edit its properties.
      </div>
    );
  }

  const update = (field: keyof CircuitComponent, value: unknown) => {
    onUpdate(component.id, { [field]: value } as Partial<CircuitComponent>);
  };
  const updateProp = (field: string, value: unknown) => {
    onUpdate(component.id, { properties: { ...component.properties, [field]: value } } as Partial<CircuitComponent>);
  };

  return (
    <div className="panel-slide-right" style={{ width: 220, background: '#0f172a', borderLeft: '1px solid #1e293b', padding: 16, overflowY: 'auto' }}>
      <div style={{ fontSize: 11, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Properties</div>
      <div key={component.id} className="panel-content-fade">

      <Field label="Tag">
        <input
          style={inputStyle}
          value={component.tag}
          onChange={(e) => update('tag', e.target.value)}
        />
      </Field>

      <Field label="Type">
        <div style={{ ...inputStyle, opacity: 0.5 }}>{component.type}</div>
      </Field>

      <Field label="Position">
        <div style={{ display: 'flex', gap: 6 }}>
          <input style={{ ...inputStyle, width: '50%' }} type="number" value={component.x} onChange={(e) => update('x', parseInt(e.target.value) || 0)} />
          <input style={{ ...inputStyle, width: '50%' }} type="number" value={component.y} onChange={(e) => update('y', parseInt(e.target.value) || 0)} />
        </div>
      </Field>

      <Field label="Rotation">
        <select
          style={inputStyle}
          value={component.rotation}
          onChange={(e) => update('rotation', parseInt(e.target.value) as 0 | 90 | 180 | 270)}
        >
          <option value={0}>0°</option>
          <option value={90}>90°</option>
          <option value={180}>180°</option>
          <option value={270}>270°</option>
        </select>
      </Field>

      {(component.type === "utility-source" || component.type === "generator-source") && (
        <>
          <Field label="Nominal Voltage (V)">
            <input style={inputStyle} type="number" value={component.properties.nominalVoltage ?? 480}
              onChange={(e) => updateProp('nominalVoltage', parseFloat(e.target.value))} />
          </Field>
          <Field label="Nominal Frequency (Hz)">
            <input style={inputStyle} type="number" value={component.properties.nominalFrequency ?? 60}
              onChange={(e) => updateProp('nominalFrequency', parseFloat(e.target.value))} />
          </Field>
        </>
      )}

      {component.type === "generator-source" && (
        <>
          <Field label="Startup Time (ms)">
            <input style={inputStyle} type="number" value={component.properties.startupTime ?? 10000}
              onChange={(e) => updateProp('startupTime', parseFloat(e.target.value))} />
          </Field>
        </>
      )}

      {component.type === "load" && (
        <Field label="Load (kW)">
          <input style={inputStyle} type="number" value={component.properties.loadKW ?? 500}
            onChange={(e) => updateProp('loadKW', parseFloat(e.target.value))} />
        </Field>
      )}

      {component.type === "bus-segment" && (
        <Field label="Bus Length (grid units)">
          <input style={inputStyle} type="number" value={component.properties.busLength ?? 6} min={2} max={20}
            onChange={(e) => updateProp('busLength', parseInt(e.target.value))} />
        </Field>
      )}

      {component.type === "circuit-breaker" && (
        <>
          <Field label="Rated Current (A)">
            <input style={inputStyle} type="number" value={component.properties.ratedCurrent ?? 400}
              onChange={(e) => updateProp('ratedCurrent', parseFloat(e.target.value))} />
          </Field>
          <Field label="State">
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ color: COLORS.text, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={component.state.closed} onChange={(e) =>
                  onUpdate(component.id, { state: { ...component.state, closed: e.target.checked } })
                } />
                Closed
              </label>
            </div>
          </Field>
        </>
      )}

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #1e293b' }}>
        <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 8, textTransform: 'uppercase' }}>Ports</div>
        {component.ports.map((port) => (
          <div key={port.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: COLORS.text, fontFamily: 'monospace' }}>{port.id}</span>
            <label style={{ fontSize: 12, color: COLORS.textDim, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={port.enabled}
                onChange={(e) => {
                  const newPorts = component.ports.map((p) =>
                    p.id === port.id ? { ...p, enabled: e.target.checked } : p,
                  );
                  onUpdate(component.id, { ports: newPorts });
                }}
              />
              Enabled
            </label>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
