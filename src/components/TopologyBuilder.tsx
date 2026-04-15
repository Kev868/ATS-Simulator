// ─── Custom Topology Builder ──────────────────────────────────────────────────
// Grid-based, palette-driven editor for ATS one-line topologies.
// All wires are orthogonal (Manhattan routing). Components snap to a 20 px grid.
// Keyboard: Delete = remove selection, R = rotate selected, Ctrl+Z/Y = undo/redo.

import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  GraphTopology, GComponent, GWire, GCompType, GCompRole,
  GComponentProps,
} from '../engine/graphTopology';
import { useTopologyBuilder, WireStart } from '../hooks/useTopologyBuilder';
import { validateTopology, ValidationResult } from '../engine/topologyValidator';

interface Props {
  onStartSimulation: (topo: GraphTopology) => void;
  onBack: () => void;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const GRID   = 20;
const BG     = '#0a1020';
const GRID_C = '#0f1e35';
const BODY   = '#94a3b8';
const SEL    = '#3b82f6';
const C_M1   = '#22c55e';
const C_M2   = '#3b82f6';
const FONT   = "'Courier New', monospace";

// ─── Palette definition ───────────────────────────────────────────────────────

interface PaletteEntry {
  type: GCompType;
  label: string;
  ansi: string;
  group: string;
}

const PALETTE: PaletteEntry[] = [
  { type: 'SOURCE',       label: 'Utility Source',    ansi: '',    group: 'Sources' },
  { type: 'SOURCE',       label: 'Generator',         ansi: '',    group: 'Sources' },
  { type: 'BREAKER',      label: 'Circuit Breaker',   ansi: '52',  group: 'Switching' },
  { type: 'CONTACTOR',    label: 'Contactor',         ansi: '',    group: 'Switching' },
  { type: 'NPORT_SWITCH', label: 'Transfer Switch',   ansi: 'ATS', group: 'Switching' },
  { type: 'BUS',          label: 'Bus Segment',       ansi: '',    group: 'Buses' },
  { type: 'LOAD',         label: 'Load Block',        ansi: '',    group: 'Loads' },
  { type: 'GROUND',       label: 'Ground',            ansi: '',    group: 'Reference' },
];

const ROLES: { value: GCompRole; label: string }[] = [
  { value: 'NONE',             label: '— unassigned —' },
  { value: 'PREFERRED_SOURCE', label: 'Preferred Source' },
  { value: 'ALTERNATE_SOURCE', label: 'Alternate Source' },
  { value: 'TERTIARY_SOURCE',  label: 'Tertiary Source' },
  { value: 'SOURCE_BREAKER',   label: 'Source Breaker' },
  { value: 'TIE_BREAKER',      label: 'Tie Breaker' },
  { value: 'LOAD_BREAKER',     label: 'Load Breaker' },
  { value: 'MAIN_BUS',         label: 'Main Bus' },
  { value: 'SECONDARY_BUS',    label: 'Secondary Bus' },
  { value: 'TERTIARY_BUS',     label: 'Tertiary Bus' },
  { value: 'AGGREGATE_LOAD',   label: 'Aggregate Load' },
];

// ─── SVG component symbols (builder canvas) ───────────────────────────────────

function SourceSVG({ x, y, color = BODY, ghost = false }: { x: number; y: number; color?: string; ghost?: boolean }) {
  const px = x * GRID; const py = y * GRID; const r = 18;
  const sw = r * 0.65;
  return (
    <g opacity={ghost ? 0.5 : 1}>
      <circle cx={px} cy={py} r={r} fill={BG} stroke={color} strokeWidth={ghost ? 1 : 1.5} strokeDasharray={ghost ? '4,3' : undefined} />
      <path d={`M${px - sw},${py} C${px - sw * 0.5},${py - 7} ${px + sw * 0.5},${py + 7} ${px + sw},${py}`}
        fill="none" stroke={color} strokeWidth={1.5} />
    </g>
  );
}

function BreakerSVG({ x, y, isOpen = true, color = BODY, ghost = false }: { x: number; y: number; isOpen?: boolean; color?: string; ghost?: boolean }) {
  const px = x * GRID; const py = y * GRID; const H = 14;
  return (
    <g opacity={ghost ? 0.5 : 1}>
      <rect x={px - H / 2} y={py - H / 2} width={H} height={H}
        fill={isOpen ? BG : color} stroke={color} strokeWidth={ghost ? 1 : 1.5}
        strokeDasharray={ghost ? '4,3' : undefined} />
      {isOpen && <line x1={px - H / 2 + 2} y1={py - H / 2 + 2} x2={px + H / 2 - 2} y2={py + H / 2 - 2} stroke={color} strokeWidth={1.5} />}
    </g>
  );
}

function BusSVG({ x, y, color = BODY, ghost = false }: { x: number; y: number; color?: string; ghost?: boolean }) {
  const px = x * GRID; const py = y * GRID;
  return (
    <g opacity={ghost ? 0.5 : 1}>
      <line x1={px - 40} y1={py} x2={px + 40} y2={py} stroke={color} strokeWidth={ghost ? 2 : 4}
        strokeLinecap="square" strokeDasharray={ghost ? '6,4' : undefined} />
    </g>
  );
}

function LoadSVG({ x, y, color = BODY, ghost = false }: { x: number; y: number; color?: string; ghost?: boolean }) {
  const px = x * GRID; const py = y * GRID;
  return (
    <g opacity={ghost ? 0.5 : 1}>
      <rect x={px - 20} y={py - 12} width={40} height={24} fill={BG} stroke={color}
        strokeWidth={ghost ? 1 : 1.5} strokeDasharray={ghost ? '4,3' : undefined} />
      <text x={px} y={py + 4} textAnchor="middle" fill={color} fontSize={8} fontFamily={FONT}>LOAD</text>
    </g>
  );
}

function GroundSVG({ x, y, color = BODY, ghost = false }: { x: number; y: number; color?: string; ghost?: boolean }) {
  const px = x * GRID; const py = y * GRID;
  return (
    <g opacity={ghost ? 0.5 : 1}>
      <line x1={px} y1={py - 10} x2={px} y2={py + 2} stroke={color} strokeWidth={1.5} />
      <line x1={px - 12} y1={py + 2}  x2={px + 12} y2={py + 2}  stroke={color} strokeWidth={1.5} />
      <line x1={px - 8}  y1={py + 6}  x2={px + 8}  y2={py + 6}  stroke={color} strokeWidth={1.5} />
      <line x1={px - 4}  y1={py + 10} x2={px + 4}  y2={py + 10} stroke={color} strokeWidth={1.5} />
    </g>
  );
}

function SwitchSVG({ x, y, color = BODY, ghost = false }: { x: number; y: number; color?: string; ghost?: boolean }) {
  const px = x * GRID; const py = y * GRID;
  return (
    <g opacity={ghost ? 0.5 : 1}>
      <rect x={px - 20} y={py - 14} width={40} height={28} fill={BG} stroke={color}
        strokeWidth={ghost ? 1 : 1.5} strokeDasharray={ghost ? '4,3' : undefined} />
      <text x={px} y={py + 4} textAnchor="middle" fill={color} fontSize={8} fontFamily={FONT}>ATS</text>
    </g>
  );
}

function CompSVGPreview({ type, x, y, ghost = false, color = BODY }: {
  type: GCompType; x: number; y: number; ghost?: boolean; color?: string;
}) {
  switch (type) {
    case 'SOURCE':       return <SourceSVG  x={x} y={y} color={color} ghost={ghost} />;
    case 'BREAKER':
    case 'CONTACTOR':   return <BreakerSVG x={x} y={y} color={color} ghost={ghost} />;
    case 'BUS':          return <BusSVG    x={x} y={y} color={color} ghost={ghost} />;
    case 'LOAD':         return <LoadSVG   x={x} y={y} color={color} ghost={ghost} />;
    case 'GROUND':       return <GroundSVG x={x} y={y} color={color} ghost={ghost} />;
    case 'NPORT_SWITCH': return <SwitchSVG x={x} y={y} color={color} ghost={ghost} />;
    default: return null;
  }
}

/** Full component on the canvas, with ports, label, selection ring. */
function CanvasComp({ comp, selected, wireStart, onSelect, onPortClick }: {
  comp: GComponent;
  selected: boolean;
  wireStart: WireStart | null;
  onSelect: () => void;
  onPortClick: (portId: string, wx: number, wy: number) => void;
}) {
  const color = selected ? SEL : BODY;
  const px = comp.x * GRID;
  const py = comp.y * GRID;

  return (
    <g>
      {/* Selection ring */}
      {selected && (
        <circle cx={px} cy={py} r={28} fill="none" stroke={SEL} strokeWidth={1} strokeDasharray="4,3" opacity={0.6} />
      )}

      {/* Symbol */}
      <CompSVGPreview type={comp.type} x={comp.x} y={comp.y} color={color} />

      {/* Label */}
      <text x={px} y={py - 26}
        textAnchor="middle" fill={color}
        fontSize={8} fontFamily={FONT} fontWeight="700">
        {comp.tag}
      </text>
      {comp.ansiNumber && (
        <text x={px + 16} y={py - 16}
          textAnchor="start" fill={color}
          fontSize={7} fontFamily={FONT} opacity={0.7}>
          {comp.ansiNumber}
        </text>
      )}

      {/* Click target */}
      <circle cx={px} cy={py} r={26} fill="transparent" onClick={onSelect} style={{ cursor: 'pointer' }} />

      {/* Ports */}
      {comp.ports.map(port => {
        const ppx = px + port.dx * GRID;
        const ppy = py + port.dy * GRID;
        const isWiring = wireStart !== null;
        const isFrom = wireStart?.compId === comp.id && wireStart?.portId === port.id;
        const portColor = isFrom ? '#f59e0b' : port.enabled ? '#22c55e' : '#ef444488';

        return (
          <g key={port.id}
            onClick={e => {
              e.stopPropagation();
              if (port.enabled) onPortClick(port.id, comp.x + port.dx, comp.y + port.dy);
            }}
            style={{ cursor: port.enabled ? 'crosshair' : 'not-allowed' }}
          >
            <circle cx={ppx} cy={ppy} r={5} fill={portColor} stroke="#0a1020" strokeWidth={1} opacity={isWiring ? 1 : 0.7} />
            {/* Disabled port X mark */}
            {!port.enabled && (
              <g>
                <line x1={ppx - 3} y1={ppy - 3} x2={ppx + 3} y2={ppy + 3} stroke="#ef4444" strokeWidth={1.2} />
                <line x1={ppx + 3} y1={ppy - 3} x2={ppx - 3} y2={ppy + 3} stroke="#ef4444" strokeWidth={1.2} />
              </g>
            )}
            <text x={ppx + 6} y={ppy + 3} fill="#475569" fontSize={6} fontFamily={FONT}>{port.label}</text>
          </g>
        );
      })}
    </g>
  );
}

/** Renders a wire on the canvas. */
function WireComp({ wire, selected, onSelect }: {
  wire: GWire; selected: boolean; onSelect: () => void;
}) {
  const color = selected ? SEL : '#475569';
  return (
    <g onClick={onSelect} style={{ cursor: 'pointer' }}>
      {wire.segments.map((seg, i) => (
        <line key={i}
          x1={seg.x1 * GRID} y1={seg.y1 * GRID}
          x2={seg.x2 * GRID} y2={seg.y2 * GRID}
          stroke={color} strokeWidth={selected ? 2.5 : 1.5}
          strokeLinecap="round"
        />
      ))}
      {/* Wider invisible hit area */}
      {wire.segments.map((seg, i) => (
        <line key={`hit-${i}`}
          x1={seg.x1 * GRID} y1={seg.y1 * GRID}
          x2={seg.x2 * GRID} y2={seg.y2 * GRID}
          stroke="transparent" strokeWidth={10}
        />
      ))}
    </g>
  );
}

// ─── Properties panel ─────────────────────────────────────────────────────────

function PropertiesPanel({ comp, actions }: {
  comp: GComponent;
  actions: ReturnType<typeof useTopologyBuilder>['actions'];
}) {
  const inp: React.CSSProperties = {
    background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155',
    borderRadius: 4, padding: '4px 8px', fontSize: '0.8rem', fontFamily: FONT,
    width: '100%', boxSizing: 'border-box',
  };
  const label: React.CSSProperties = {
    color: '#64748b', fontSize: '0.72rem', marginBottom: 2, display: 'block',
  };
  const row: React.CSSProperties = { marginBottom: 10 };

  return (
    <div style={{ padding: '12px', overflowY: 'auto', flex: 1 }}>
      <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontFamily: FONT, letterSpacing: '0.08em', marginBottom: 12 }}>
        PROPERTIES — {comp.type}
      </div>

      {/* Tag */}
      <div style={row}>
        <label style={label}>Tag / Device Number</label>
        <input style={inp} value={comp.tag}
          onChange={e => actions.updateTag(comp.id, e.target.value)} />
      </div>

      {/* Role */}
      <div style={row}>
        <label style={label}>Role (scheme logic)</label>
        <select style={{ ...inp, cursor: 'pointer' }} value={comp.role}
          onChange={e => actions.updateRole(comp.id, e.target.value as GCompRole)}>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Source-specific */}
      {comp.type === 'SOURCE' && (
        <>
          <div style={row}>
            <label style={label}>Voltage (% of nominal)</label>
            <input style={inp} type="number" min={0} max={130}
              value={comp.props.voltage ?? 100}
              onChange={e => actions.updateProps(comp.id, { voltage: +e.target.value })} />
          </div>
          <div style={row}>
            <label style={label}>Frequency (Hz)</label>
            <input style={inp} type="number" min={0} max={70}
              value={comp.props.frequency ?? 60}
              onChange={e => actions.updateProps(comp.id, { frequency: +e.target.value })} />
          </div>
          <div style={row}>
            <label style={label}>Phase Angle (°)</label>
            <input style={inp} type="number" min={-180} max={180}
              value={comp.props.phaseAngle ?? 0}
              onChange={e => actions.updateProps(comp.id, { phaseAngle: +e.target.value })} />
          </div>
          <div style={row}>
            <label style={label}>
              <input type="checkbox" checked={comp.props.available ?? true}
                onChange={e => actions.updateProps(comp.id, { available: e.target.checked })}
                style={{ marginRight: 6 }} />
              Available
            </label>
          </div>
        </>
      )}

      {/* Breaker-specific */}
      {(comp.type === 'BREAKER' || comp.type === 'CONTACTOR') && (
        <>
          <div style={row}>
            <label style={label}>Operation Time (ms)</label>
            <input style={inp} type="number" min={1} max={2000}
              value={comp.props.operationTimeMs ?? 50}
              onChange={e => actions.updateProps(comp.id, { operationTimeMs: +e.target.value })} />
          </div>
          <div style={row}>
            <label style={label}>Initial State</label>
            <select style={{ ...inp, cursor: 'pointer' }}
              value={comp.props.breakerState ?? 'OPEN'}
              onChange={e => actions.updateProps(comp.id, { breakerState: e.target.value as GComponentProps['breakerState'] })}>
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>
        </>
      )}

      {/* Load-specific */}
      {comp.type === 'LOAD' && (
        <div style={row}>
          <label style={label}>Load (kW)</label>
          <input style={inp} type="number" min={0}
            value={comp.props.loadKW ?? 500}
            onChange={e => actions.updateProps(comp.id, { loadKW: +e.target.value })} />
        </div>
      )}

      {/* N-port switch */}
      {comp.type === 'NPORT_SWITCH' && (
        <div style={row}>
          <label style={label}>Port Count</label>
          <select style={{ ...inp, cursor: 'pointer' }}
            value={comp.props.portCount ?? 2}
            onChange={e => actions.updateProps(comp.id, { portCount: +e.target.value })}>
            {[2, 3, 4].map(n => <option key={n} value={n}>{n} ports</option>)}
          </select>
        </div>
      )}

      {/* Port enable/disable */}
      <div style={row}>
        <label style={label}>Port Enable / Disable</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {comp.ports.map(port => (
            <label key={port.id} style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={port.enabled}
                onChange={() => actions.togglePort(comp.id, port.id)} />
              Port <code style={{ color: '#22c55e', fontSize: '0.75rem' }}>{port.label}</code>
              {!port.enabled && <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>disabled</span>}
            </label>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={() => actions.rotateComp(comp.id)} style={{
          background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
          borderRadius: 4, padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer',
        }}>↻ Rotate</button>
        <button onClick={actions.deleteSelected} style={{
          background: '#7f1d1d', color: '#f87171', border: '1px solid #991b1b',
          borderRadius: 4, padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer',
        }}>✕ Delete</button>
      </div>
    </div>
  );
}

// ─── Validation overlay ───────────────────────────────────────────────────────

function ValidationOverlay({ result, onClose }: {
  result: ValidationResult; onClose: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#1e293b', border: `2px solid ${result.ok ? '#22c55e' : '#ef4444'}`,
        borderRadius: 8, padding: 24, maxWidth: 520, width: '90%',
      }}>
        <div style={{ color: result.ok ? '#22c55e' : '#f87171', fontWeight: 700, fontSize: '1rem', marginBottom: 12 }}>
          {result.ok ? '✓ Topology Valid' : '✗ Validation Failed'}
        </div>
        {result.errors.length > 0 && (
          <>
            <div style={{ color: '#f87171', fontSize: '0.78rem', marginBottom: 6, fontWeight: 600 }}>Errors:</div>
            <ul style={{ color: '#fca5a5', fontSize: '0.78rem', paddingLeft: 16, marginBottom: 12 }}>
              {result.errors.map((e, i) => <li key={i} style={{ marginBottom: 4 }}>{e}</li>)}
            </ul>
          </>
        )}
        {result.warnings.length > 0 && (
          <>
            <div style={{ color: '#f59e0b', fontSize: '0.78rem', marginBottom: 6, fontWeight: 600 }}>Warnings:</div>
            <ul style={{ color: '#fcd34d', fontSize: '0.78rem', paddingLeft: 16, marginBottom: 12 }}>
              {result.warnings.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
            </ul>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: '#334155', color: '#e2e8f0', border: '1px solid #475569',
            borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: '0.82rem',
          }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main TopologyBuilder component ───────────────────────────────────────────

export default function TopologyBuilder({ onStartSimulation, onBack }: Props) {
  const { state, selectedComp, selectedWire, actions } = useTopologyBuilder();
  const svgRef = useRef<SVGSVGElement>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [mouseWire, setMouseWire] = useState<{ x: number; y: number } | null>(null);

  const { topo, selectedId, placingType, wireStart, ghostPos } = state;
  const canvasPxW = topo.canvasW * GRID;
  const canvasPxH = topo.canvasH * GRID;

  // Snap a canvas pixel coordinate to grid units
  const snapToGrid = useCallback((px: number, py: number): { x: number; y: number } => {
    return {
      x: Math.round(px / GRID),
      y: Math.round(py / GRID),
    };
  }, []);

  // SVG coordinates from a mouse event (accounting for SVG transform)
  const svgPoint = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // ── Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        if (selectedWire) { actions.deleteWire(selectedWire.id); }
        else { actions.deleteSelected(); }
      }
      if (e.key === 'r' || e.key === 'R') {
        if (selectedComp) actions.rotateComp(selectedComp.id);
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); actions.undo(); }
      if (e.key === 'y' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); actions.redo(); }
      if (e.key === 'Escape') { actions.cancelWire(); actions.startPlacing(null as unknown as GCompType); actions.select(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, selectedComp, selectedWire, actions]);

  // ── Canvas mouse handlers
  const onCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    const pt = svgPoint(e);
    const grid = snapToGrid(pt.x, pt.y);
    actions.setGhost(grid);
    if (wireStart) setMouseWire({ x: pt.x, y: pt.y });
  }, [svgPoint, snapToGrid, actions, wireStart]);

  const onCanvasClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as SVGElement).closest('.comp-clickable')) return;
    const pt = svgPoint(e);
    const grid = snapToGrid(pt.x, pt.y);

    if (placingType) {
      actions.placeComponent(grid.x, grid.y, placingType);
      return;
    }
    if (wireStart) {
      actions.cancelWire();
      return;
    }
    actions.select(null);
  }, [svgPoint, snapToGrid, placingType, wireStart, actions]);

  // ── Port click handler
  const handlePortClick = useCallback((comp: GComponent, portId: string) => {
    const port = comp.ports.find(p => p.id === portId);
    if (!port || !port.enabled) return;
    const wx = comp.x + port.dx;
    const wy = comp.y + port.dy;

    if (!wireStart) {
      actions.startWire({ compId: comp.id, portId, wx, wy });
    } else {
      actions.finishWire(comp.id, portId, wx, wy);
      setMouseWire(null);
    }
  }, [wireStart, actions]);

  // ── Save / load / export
  const handleSave = () => {
    const json = actions.saveJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `topology-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const json = ev.target?.result as string;
        if (!actions.loadJSON(json)) alert('Invalid topology file.');
      };
      reader.readAsText(file);
    };
    inp.click();
  };

  const handleExportSVG = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `topology-${Date.now()}.svg`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleValidateAndSim = () => {
    const result = validateTopology(topo);
    if (!result.ok) {
      setValidationResult(result);
      return;
    }
    if (result.warnings.length > 0) {
      setValidationResult({ ...result, ok: true }); // show warnings but allow proceed
    } else {
      onStartSimulation(topo);
    }
  };

  // Button styles
  const btnBase: React.CSSProperties = {
    background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
    borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit',
  };
  const activeBtn: React.CSSProperties = { ...btnBase, background: '#334155', color: '#e2e8f0' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div style={{ background: '#0a1020', borderBottom: '1px solid #1e293b', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button style={btnBase} onClick={onBack}>← Back</button>
        <span style={{ color: '#475569', fontSize: '0.78rem', fontFamily: "'Courier New', monospace" }}>
          TOPOLOGY BUILDER — {topo.name}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button style={btnBase} onClick={actions.undo} title="Ctrl+Z">↶ Undo</button>
          <button style={btnBase} onClick={actions.redo} title="Ctrl+Y">↷ Redo</button>
          <button style={btnBase} onClick={handleSave}>⬇ Save JSON</button>
          <button style={btnBase} onClick={handleLoad}>⬆ Load JSON</button>
          <button style={btnBase} onClick={handleExportSVG}>⎘ Export SVG</button>
          <button
            onClick={handleValidateAndSim}
            style={{ ...btnBase, background: '#16a34a', color: '#dcfce7', border: '1px solid #15803d' }}
          >
            ▶ Validate & Simulate
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* ── Palette sidebar ─────────────────────────────────────────── */}
        <div style={{ width: 200, background: '#0d1b2e', borderRight: '1px solid #1e293b', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', color: '#475569', fontSize: '0.7rem', letterSpacing: '0.1em', fontFamily: "'Courier New', monospace", borderBottom: '1px solid #1e293b' }}>
            COMPONENT PALETTE
          </div>
          {(() => {
            const groups = [...new Set(PALETTE.map(e => e.group))];
            return groups.map(group => (
              <div key={group}>
                <div style={{ padding: '6px 12px', color: '#334155', fontSize: '0.68rem', letterSpacing: '0.08em', fontFamily: "'Courier New', monospace" }}>
                  {group.toUpperCase()}
                </div>
                {PALETTE.filter(e => e.group === group).map((entry, i) => (
                  <div
                    key={i}
                    onClick={() => actions.startPlacing(entry.type)}
                    style={{
                      padding: '7px 12px 7px 20px',
                      cursor: 'pointer',
                      background: placingType === entry.type ? '#1e293b' : 'transparent',
                      borderLeft: placingType === entry.type ? `2px solid ${SEL}` : '2px solid transparent',
                      color: placingType === entry.type ? '#e2e8f0' : '#64748b',
                      fontSize: '0.78rem',
                      transition: 'background 0.1s',
                    }}
                  >
                    {entry.label}
                    {entry.ansi && <span style={{ color: '#334155', fontSize: '0.68rem', marginLeft: 6 }}>({entry.ansi})</span>}
                  </div>
                ))}
              </div>
            ));
          })()}

          {/* Mode indicator */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #1e293b', marginTop: 8 }}>
            <div style={{ color: '#475569', fontSize: '0.68rem', marginBottom: 4 }}>MODE</div>
            <div style={{ color: placingType ? '#f59e0b' : wireStart ? '#22c55e' : '#64748b', fontSize: '0.78rem', fontFamily: "'Courier New', monospace" }}>
              {placingType ? `PLACING ${placingType}` : wireStart ? 'WIRING — click port' : 'SELECT'}
            </div>
          </div>

          {/* Keyboard hints */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #1e293b', fontSize: '0.68rem', color: '#334155', lineHeight: 1.8 }}>
            <div>Del — delete</div>
            <div>R — rotate</div>
            <div>Ctrl+Z/Y — undo/redo</div>
            <div>Esc — cancel</div>
          </div>
        </div>

        {/* ── Canvas ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', background: BG, position: 'relative' }}>
          <svg
            ref={svgRef}
            width={canvasPxW}
            height={canvasPxH}
            onClick={onCanvasClick}
            onMouseMove={onCanvasMouseMove}
            onMouseLeave={() => { actions.setGhost(null); setMouseWire(null); }}
            style={{ display: 'block', cursor: placingType ? 'crosshair' : wireStart ? 'crosshair' : 'default' }}
          >
            {/* Grid dots */}
            {Array.from({ length: Math.ceil(canvasPxH / GRID) + 1 }, (_, row) =>
              Array.from({ length: Math.ceil(canvasPxW / GRID) + 1 }, (_, col) => (
                <circle key={`${row}-${col}`}
                  cx={col * GRID} cy={row * GRID} r={1}
                  fill={GRID_C} />
              ))
            )}

            {/* Wires */}
            {topo.wires.map(w => (
              <WireComp key={w.id} wire={w}
                selected={selectedId === w.id}
                onSelect={() => actions.select(w.id)} />
            ))}

            {/* Components */}
            {topo.components.map(comp => (
              <g key={comp.id} className="comp-clickable">
                <CanvasComp
                  comp={comp}
                  selected={selectedId === comp.id}
                  wireStart={wireStart}
                  onSelect={() => actions.select(comp.id)}
                  onPortClick={(portId, wx, wy) => handlePortClick(comp, portId)}
                />
              </g>
            ))}

            {/* Ghost (placement preview) */}
            {placingType && ghostPos && (
              <CompSVGPreview type={placingType} x={ghostPos.x} y={ghostPos.y} ghost />
            )}

            {/* Wire-in-progress rubber band */}
            {wireStart && mouseWire && (() => {
              const fromComp = topo.components.find(c => c.id === wireStart.compId);
              const fromPort = fromComp?.ports.find(p => p.id === wireStart.portId);
              if (!fromPort || !fromComp) return null;
              const fx = (fromComp.x + fromPort.dx) * GRID;
              const fy = (fromComp.y + fromPort.dy) * GRID;
              return (
                <g>
                  <line x1={fx} y1={fy} x2={fx} y2={mouseWire.y} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5,4" opacity={0.7} />
                  <line x1={fx} y1={mouseWire.y} x2={mouseWire.x} y2={mouseWire.y} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5,4" opacity={0.7} />
                </g>
              );
            })()}
          </svg>
        </div>

        {/* ── Properties panel ─────────────────────────────────────────── */}
        <div style={{ width: 240, background: '#0d1b2e', borderLeft: '1px solid #1e293b', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', color: '#475569', fontSize: '0.7rem', letterSpacing: '0.1em', fontFamily: "'Courier New', monospace", borderBottom: '1px solid #1e293b' }}>
            PROPERTIES
          </div>
          {selectedComp ? (
            <PropertiesPanel comp={selectedComp} actions={actions} />
          ) : selectedWire ? (
            <div style={{ padding: 12 }}>
              <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: 8 }}>Wire selected</div>
              <div style={{ color: '#475569', fontSize: '0.72rem', marginBottom: 12 }}>
                {selectedWire.fromCompId} → {selectedWire.toCompId}<br />
                {selectedWire.segments.length} segment(s)
              </div>
              <button onClick={() => actions.deleteWire(selectedWire.id)} style={{
                background: '#7f1d1d', color: '#f87171', border: '1px solid #991b1b',
                borderRadius: 4, padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem',
              }}>✕ Delete Wire</button>
            </div>
          ) : (
            <div style={{ padding: 12, color: '#334155', fontSize: '0.78rem' }}>
              Click a component or wire to view properties.
            </div>
          )}

          {/* Component count summary */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #1e293b', marginTop: 'auto' }}>
            <div style={{ color: '#334155', fontSize: '0.7rem', lineHeight: 1.8 }}>
              <div>{topo.components.length} components</div>
              <div>{topo.wires.length} wires</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Validation modal ─────────────────────────────────────────────── */}
      {validationResult && (
        <ValidationOverlay
          result={validationResult}
          onClose={() => {
            if (validationResult.ok) {
              setValidationResult(null);
              onStartSimulation(topo);
            } else {
              setValidationResult(null);
            }
          }}
        />
      )}
    </div>
  );
}
