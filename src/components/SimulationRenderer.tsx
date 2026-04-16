// ─── Generic Simulation Renderer ──────────────────────────────────────────────
// Renders ANY TopologyModel as an SVG one-line diagram.
// No preset-specific layout logic.  Every component is drawn at its stored
// (x, y) grid position with its stored rotation.  Wires are routed orthogonally
// between absolute port positions.  Colors come from the energization map.

import React, { useMemo } from 'react';
import { TopologyModel, Component, Wire, Port } from '../models/TopologyModel';

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG      = '#0a1020';
const GRID_C  = '#0f1e35';
const BODY    = '#94a3b8';
const BODY_F  = '#0d1b2e';
const DE      = '#334155';
const ALIVE   = '#22c55e';
const FONT    = "'Courier New', monospace";

// ─── Energization colour assignment ──────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  PREFERRED_SOURCE:  '#22c55e',
  ALTERNATE_SOURCE:  '#3b82f6',
  TERTIARY_SOURCE:   '#a855f7',
};
const EXTRA_COLORS = ['#f59e0b', '#06b6d4', '#ec4899'];

function buildSourceColorMap(components: Component[]): Map<string, string> {
  const map = new Map<string, string>();
  let extra = 0;
  const roleOrder = ['PREFERRED_SOURCE', 'ALTERNATE_SOURCE', 'TERTIARY_SOURCE'];
  for (const role of roleOrder) {
    for (const c of components) {
      if ((c.type === 'utility-source' || c.type === 'generator-source') && c.role === role && !map.has(c.id)) {
        map.set(c.id, ROLE_COLORS[role]);
      }
    }
  }
  for (const c of components) {
    if ((c.type === 'utility-source' || c.type === 'generator-source') && !map.has(c.id)) {
      map.set(c.id, EXTRA_COLORS[extra++ % EXTRA_COLORS.length]);
    }
  }
  return map;
}

// ─── Position helpers ─────────────────────────────────────────────────────────

function absPort(comp: Component, port: Port, gridPx: number): { x: number; y: number } {
  return {
    x: comp.x * gridPx + port.relativeX * gridPx,
    y: comp.y * gridPx + port.relativeY * gridPx,
  };
}

function manhattanSegments(
  x1: number, y1: number, x2: number, y2: number,
): Array<[number, number, number, number]> {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  if (dx < 0.5 && dy < 0.5) return [];
  if (dy < 0.5) return [[x1, y1, x2, y2]];
  if (dx < 0.5) return [[x1, y1, x2, y2]];
  const midX = (x1 + x2) / 2;
  return [
    [x1, y1, midX, y1],
    [midX, y1, midX, y2],
    [midX, y2, x2, y2],
  ];
}

// ─── Energization map type ────────────────────────────────────────────────────
export type EnergizationMap = Record<string, { energized: boolean; sourceId: string | null }>;

// ─── Component symbols ────────────────────────────────────────────────────────

interface SymProps {
  comp: Component;
  gridPx: number;
  color: string;
  onBreakerClick?: (id: string) => void;
}

function SourceSym({ comp, gridPx, color }: SymProps) {
  const px = comp.x * gridPx;
  const py = comp.y * gridPx;
  const r = 18;
  const sw = r * 0.65;
  return (
    <g transform={`translate(${px},${py}) rotate(${comp.rotation})`}>
      <circle cx={0} cy={0} r={r} fill={BODY_F} stroke={color} strokeWidth={1.5} />
      <path d={`M${-sw},0 C${-sw * 0.5},${-7} ${sw * 0.5},${7} ${sw},0`}
        fill="none" stroke={color} strokeWidth={1.5} />
      <text y={r + 12} textAnchor="middle" fill={color} fontSize={8} fontFamily={FONT} fontWeight="600">
        {comp.tag}
      </text>
      {comp.type === 'generator-source' && (
        <text y={-r - 4} textAnchor="middle" fill="#475569" fontSize={6} fontFamily={FONT}>GEN</text>
      )}
    </g>
  );
}

function BreakerSym({ comp, gridPx, color, onBreakerClick }: SymProps) {
  const px = comp.x * gridPx;
  const py = comp.y * gridPx;
  const H = 14;
  const st = comp.properties.breakerState as string | undefined;
  const isOpen      = st !== 'CLOSED';
  const isTransient = st === 'CLOSING' || st === 'TRIPPING';
  const stroke      = isTransient ? '#f59e0b' : color;
  return (
    <g
      transform={`translate(${px},${py}) rotate(${comp.rotation})`}
      onClick={() => onBreakerClick?.(comp.id)}
      style={{ cursor: onBreakerClick ? 'pointer' : 'default' }}
    >
      <rect x={-H / 2} y={-H / 2} width={H} height={H}
        fill={isOpen ? BODY_F : BODY} stroke={stroke} strokeWidth={1.5}
        strokeDasharray={isTransient ? '3,2' : undefined}
      >
        {isTransient && (
          <animate attributeName="opacity" values="1;0.25;1" dur="0.5s" repeatCount="indefinite" />
        )}
      </rect>
      {isOpen && (
        <line x1={-H / 2 + 2} y1={-H / 2 + 2} x2={H / 2 - 2} y2={H / 2 - 2}
          stroke={stroke} strokeWidth={1.5} />
      )}
      <text y={-H / 2 - 4} textAnchor="middle" fill="#475569" fontSize={7} fontFamily={FONT} fontWeight="600">
        {comp.tag}
      </text>
      <text y={H / 2 + 9} textAnchor="middle" fill="#475569" fontSize={7} fontFamily={FONT}>
        52
      </text>
    </g>
  );
}

function SwitchSym({ comp, gridPx, color, onBreakerClick }: SymProps) {
  const px = comp.x * gridPx;
  const py = comp.y * gridPx;
  const W = 24; const H = 16;
  const st = comp.properties.breakerState as string | undefined;
  const isOpen = st !== 'CLOSED';
  return (
    <g
      transform={`translate(${px},${py}) rotate(${comp.rotation})`}
      onClick={() => onBreakerClick?.(comp.id)}
      style={{ cursor: onBreakerClick ? 'pointer' : 'default' }}
    >
      <rect x={-W / 2} y={-H / 2} width={W} height={H}
        fill={isOpen ? BODY_F : BODY} stroke={color} strokeWidth={1.5} rx={2} />
      {isOpen && (
        <line x1={-W / 2 + 3} y1={-H / 2 + 3} x2={W / 2 - 3} y2={H / 2 - 3}
          stroke={color} strokeWidth={1} />
      )}
      <text y={-H / 2 - 4} textAnchor="middle" fill="#475569" fontSize={7} fontFamily={FONT}>
        {comp.tag}
      </text>
    </g>
  );
}

function BusSym({ comp, gridPx, color }: SymProps) {
  const px = comp.x * gridPx;
  const py = comp.y * gridPx;
  const enabledPorts = comp.ports.filter(p => p.enabled);
  const xOff = enabledPorts.map(p => p.relativeX * gridPx);
  const yOff = enabledPorts.map(p => p.relativeY * gridPx);
  const xMin = xOff.length ? Math.min(...xOff) : -gridPx * 2;
  const xMax = xOff.length ? Math.max(...xOff) :  gridPx * 2;
  const yMin = yOff.length ? Math.min(...yOff) : -gridPx * 2;
  const yMax = yOff.length ? Math.max(...yOff) :  gridPx * 2;
  const horiz = (xMax - xMin) >= (yMax - yMin);

  return (
    <g transform={`translate(${px},${py})`}>
      {horiz
        ? <line x1={xMin} y1={0} x2={xMax} y2={0} stroke={color} strokeWidth={4} strokeLinecap="square" />
        : <line x1={0} y1={yMin} x2={0} y2={yMax} stroke={color} strokeWidth={4} strokeLinecap="square" />
      }
      <text
        x={horiz ? (xMin + xMax) / 2 : 10}
        y={horiz ? -8 : (yMin + yMax) / 2}
        textAnchor={horiz ? 'middle' : 'start'}
        fill={color} fontSize={8} fontFamily={FONT} fontWeight="700"
      >
        {comp.tag}
      </text>
    </g>
  );
}

function LoadSym({ comp, gridPx, color }: SymProps) {
  const px = comp.x * gridPx;
  const py = comp.y * gridPx;
  const kw = (comp.properties.loadKW as number) ?? 0;
  return (
    <g transform={`translate(${px},${py}) rotate(${comp.rotation})`}>
      <rect x={-20} y={-12} width={40} height={24} fill={BODY_F} stroke={color} strokeWidth={1.5} />
      <text y={-1} textAnchor="middle" fill={color} fontSize={7} fontFamily={FONT}>{kw}kW</text>
      <text y={26} textAnchor="middle" fill="#475569" fontSize={7} fontFamily={FONT}>{comp.tag}</text>
      {/* IEEE ground */}
      <line x1={0} y1={12} x2={0} y2={20} stroke={color} strokeWidth={1.5} />
      <line x1={-10} y1={20} x2={10} y2={20} stroke={color} strokeWidth={1.5} />
      <line x1={-6}  y1={24} x2={6}  y2={24} stroke={color} strokeWidth={1.5} />
      <line x1={-3}  y1={28} x2={3}  y2={28} stroke={color} strokeWidth={1.5} />
    </g>
  );
}

function GroundSym({ comp, gridPx, color }: SymProps) {
  const px = comp.x * gridPx;
  const py = comp.y * gridPx;
  return (
    <g transform={`translate(${px},${py}) rotate(${comp.rotation})`}>
      <line x1={0} y1={-10} x2={0} y2={2} stroke={color} strokeWidth={1.5} />
      <line x1={-12} y1={2}  x2={12} y2={2}  stroke={color} strokeWidth={1.5} />
      <line x1={-8}  y1={6}  x2={8}  y2={6}  stroke={color} strokeWidth={1.5} />
      <line x1={-4}  y1={10} x2={4}  y2={10} stroke={color} strokeWidth={1.5} />
      <text y={-14} textAnchor="middle" fill="#475569" fontSize={7} fontFamily={FONT}>{comp.tag}</text>
    </g>
  );
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

function ComponentSym(props: SymProps) {
  switch (props.comp.type) {
    case 'utility-source':
    case 'generator-source':
      return <SourceSym {...props} />;
    case 'breaker':
      return <BreakerSym {...props} />;
    case 'switch':
      return <SwitchSym {...props} />;
    case 'bus':
      return <BusSym {...props} />;
    case 'load':
      return <LoadSym {...props} />;
    case 'ground':
      return <GroundSym {...props} />;
    default:
      console.warn(`[SimulationRenderer] Unknown component type "${props.comp.type}" for "${props.comp.tag}" — rendering as passive rectangle`);
      const px = props.comp.x * props.gridPx;
      const py = props.comp.y * props.gridPx;
      return (
        <g>
          <rect x={px - 10} y={py - 10} width={20} height={20} fill={BODY_F} stroke={BODY} strokeWidth={1} strokeDasharray="4,2" />
          <text x={px} y={py + 3} textAnchor="middle" fill={BODY} fontSize={6} fontFamily={FONT}>?</text>
        </g>
      );
  }
}

// ─── Wire renderer ────────────────────────────────────────────────────────────

function WireRender({
  wire, compMap, gridPx, color,
}: {
  wire: Wire;
  compMap: Map<string, Component>;
  gridPx: number;
  color: string;
}) {
  const fromComp = compMap.get(wire.fromComponentId);
  const toComp   = compMap.get(wire.toComponentId);
  if (!fromComp || !toComp) return null;
  const fromPort = fromComp.ports.find(p => p.id === wire.fromPortId);
  const toPort   = toComp.ports.find(p => p.id === wire.toPortId);
  if (!fromPort || !toPort) return null;

  const from = absPort(fromComp, fromPort, gridPx);
  const to   = absPort(toComp,   toPort,   gridPx);
  const segs = manhattanSegments(from.x, from.y, to.x, to.y);

  if (segs.length === 0) {
    return <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={2} />;
  }
  return (
    <>
      {segs.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} strokeLinecap="square" />
      ))}
    </>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

interface Props {
  model: TopologyModel;
  energization: EnergizationMap;
  onBreakerClick?: (componentId: string) => void;
}

export default function SimulationRenderer({ model, energization, onBreakerClick }: Props) {
  const gridPx  = (model.schemeSettings.gridPx as number) ?? 20;
  const canvasW = (model.schemeSettings.canvasW as number) ?? 60;
  const canvasH = (model.schemeSettings.canvasH as number) ?? 40;
  const W = canvasW * gridPx;
  const H = canvasH * gridPx;

  const compMap = useMemo(
    () => new Map(model.components.map(c => [c.id, c])),
    [model.components],
  );
  const sourceColorMap = useMemo(
    () => buildSourceColorMap(model.components),
    [model.components],
  );

  function compColor(comp: Component): string {
    const e = energization[comp.id];
    if (!e?.energized) return DE;
    if (e.sourceId && sourceColorMap.has(e.sourceId)) return sourceColorMap.get(e.sourceId)!;
    return ALIVE;
  }

  function wireColor(wire: Wire): string {
    const fromE = energization[wire.fromComponentId];
    const toE   = energization[wire.toComponentId];
    if (fromE?.energized && toE?.energized && fromE.sourceId === toE.sourceId && fromE.sourceId) {
      return sourceColorMap.get(fromE.sourceId) ?? ALIVE;
    }
    return DE;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', width: '100%', height: '100%', background: BG }}
    >
      {/* Grid pattern */}
      <defs>
        <pattern id="sim-grid" x={0} y={0} width={gridPx} height={gridPx} patternUnits="userSpaceOnUse">
          <circle cx={0} cy={0} r={0.8} fill={GRID_C} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#sim-grid)`} />

      {/* Wires */}
      <g id="sim-wires">
        {model.wires.map(w => (
          <WireRender key={w.id} wire={w} compMap={compMap} gridPx={gridPx} color={wireColor(w)} />
        ))}
      </g>

      {/* Components */}
      <g id="sim-components">
        {model.components.map(c => (
          <ComponentSym
            key={c.id}
            comp={c}
            gridPx={gridPx}
            color={compColor(c)}
            onBreakerClick={onBreakerClick}
          />
        ))}
      </g>
    </svg>
  );
}
