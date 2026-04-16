// ─── Topology Renderer ────────────────────────────────────────────────────────
// Read-only SVG rendering of a TopologyModel.
//
// Zero dependency on builder state, selection state, undo history, or drag logic.
// All coordinates come from resolved absolute pixel positions in the model.
// Wire routes are recomputed from port positions — stored paths are not used.
//
// Visual conventions: IEEE/ANSI 315 symbols, monochrome + energization colour only.

import React, { useMemo } from 'react';
import {
  TopologyModel,
  ResolvedComponent,
  ResolvedWire,
} from '../engine/TopologyInterpreter';

// ─── Design tokens (match builder) ───────────────────────────────────────────
const BG     = '#0a1020';
const GRID_C = '#0f1e35';
const DE     = '#334155';   // de-energized
const FONT   = "'Courier New', monospace";

// ─── Source → colour mapping ──────────────────────────────────────────────────
// PREFERRED → green, ALTERNATE → blue, TERTIARY → purple, extras → amber/cyan
const ROLE_PALETTE: Record<string, string> = {
  PREFERRED_SOURCE: '#22c55e',
  ALTERNATE_SOURCE: '#3b82f6',
  TERTIARY_SOURCE:  '#a855f7',
};
const OVERFLOW_PALETTE = ['#f59e0b', '#06b6d4', '#ec4899'];

function buildSourceColorMap(components: ResolvedComponent[]): Map<string, string> {
  const map  = new Map<string, string>();
  let extra  = 0;
  // Assign in role-priority order so the same source always gets the same colour
  const roleOrder = ['PREFERRED_SOURCE', 'ALTERNATE_SOURCE', 'TERTIARY_SOURCE'];
  for (const role of roleOrder) {
    for (const c of components) {
      if (c.type === 'SOURCE' && c.role === role && !map.has(c.id)) {
        map.set(c.id, ROLE_PALETTE[role]);
      }
    }
  }
  // Any remaining sources get overflow colours
  for (const c of components) {
    if (c.type === 'SOURCE' && !map.has(c.id)) {
      map.set(c.id, OVERFLOW_PALETTE[extra++ % OVERFLOW_PALETTE.length]);
    }
  }
  return map;
}

function energColor(
  sourceId: string | null,
  energized: boolean,
  colorMap: Map<string, string>,
): string {
  if (!energized || !sourceId) return DE;
  return colorMap.get(sourceId) ?? '#94a3b8';
}

// ─── Component symbols ────────────────────────────────────────────────────────
// Each symbol is centred at (0,0) inside a <g transform="translate(px,py) rotate(rot)">.

interface SymProps { comp: ResolvedComponent; color: string; gridPx: number }

function SourceSym({ comp, color }: SymProps) {
  const r  = 18;
  const sw = r * 0.65;
  return (
    <g transform={`translate(${comp.px},${comp.py}) rotate(${comp.rotation})`}>
      <circle cx={0} cy={0} r={r} fill={BG} stroke={color} strokeWidth={1.5} />
      <path
        d={`M${-sw},0 C${-sw * 0.5},${-7} ${sw * 0.5},${7} ${sw},0`}
        fill="none" stroke={color} strokeWidth={1.5}
      />
      {comp.tag && (
        <text y={r + 10} textAnchor="middle" fill="#475569" fontSize={8} fontFamily={FONT}>
          {comp.tag}
        </text>
      )}
    </g>
  );
}

function BreakerSym({ comp, color }: SymProps) {
  const H = 14;
  const state       = comp.props.breakerState ?? 'OPEN';
  const isOpen      = state !== 'CLOSED';
  const isTransient = state === 'CLOSING' || state === 'TRIPPING';
  const stroke      = isTransient ? '#f59e0b' : color;
  return (
    <g transform={`translate(${comp.px},${comp.py}) rotate(${comp.rotation})`}>
      <rect
        x={-H / 2} y={-H / 2} width={H} height={H}
        fill={isOpen ? BG : color}
        stroke={stroke} strokeWidth={1.5}
        strokeDasharray={isTransient ? '3,2' : undefined}
      />
      {isOpen && (
        <line
          x1={-H / 2 + 2} y1={-H / 2 + 2}
          x2={ H / 2 - 2} y2={ H / 2 - 2}
          stroke={stroke} strokeWidth={1.5}
        />
      )}
      {comp.ansiNumber && (
        <text y={H / 2 + 9} textAnchor="middle" fill="#475569" fontSize={7} fontFamily={FONT}>
          {comp.ansiNumber}
        </text>
      )}
      {comp.tag && (
        <text y={-H / 2 - 4} textAnchor="middle" fill="#475569" fontSize={7} fontFamily={FONT}>
          {comp.tag}
        </text>
      )}
    </g>
  );
}

function BusSym({ comp, color, gridPx }: SymProps) {
  // Determine bus extent from enabled port offsets
  const enabled = comp.ports.filter(p => p.enabled);
  const xOff = enabled.map(p => p.dx * gridPx);
  const yOff = enabled.map(p => p.dy * gridPx);
  const xMin = xOff.length ? Math.min(...xOff) : -gridPx * 2;
  const xMax = xOff.length ? Math.max(...xOff) :  gridPx * 2;
  const yMin = yOff.length ? Math.min(...yOff) : -gridPx * 2;
  const yMax = yOff.length ? Math.max(...yOff) :  gridPx * 2;

  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;
  const horiz = xSpan >= ySpan;

  return (
    <g transform={`translate(${comp.px},${comp.py})`}>
      {horiz
        ? <line x1={xMin} y1={0} x2={xMax} y2={0} stroke={color} strokeWidth={4} strokeLinecap="square" />
        : <line x1={0} y1={yMin} x2={0} y2={yMax} stroke={color} strokeWidth={4} strokeLinecap="square" />
      }
      {comp.tag && (
        <text
          x={horiz ? (xMin + xMax) / 2 : 8}
          y={horiz ? -8 : (yMin + yMax) / 2}
          textAnchor={horiz ? 'middle' : 'start'}
          fill="#475569" fontSize={8} fontFamily={FONT}
        >
          {comp.tag}
        </text>
      )}
    </g>
  );
}

function LoadSym({ comp, color }: SymProps) {
  return (
    <g transform={`translate(${comp.px},${comp.py}) rotate(${comp.rotation})`}>
      <rect x={-20} y={-12} width={40} height={24} fill={BG} stroke={color} strokeWidth={1.5} />
      <text y={4} textAnchor="middle" fill={color} fontSize={8} fontFamily={FONT}>LOAD</text>
      {comp.tag && comp.tag !== comp.id && (
        <text y={26} textAnchor="middle" fill="#475569" fontSize={7} fontFamily={FONT}>
          {comp.tag}
        </text>
      )}
    </g>
  );
}

function ContactorSym({ comp, color }: SymProps) {
  const H   = 12;
  const isOpen = comp.props.breakerState !== 'CLOSED';
  return (
    <g transform={`translate(${comp.px},${comp.py}) rotate(${comp.rotation})`}>
      <circle cx={0} cy={0} r={H / 2} fill={isOpen ? BG : color} stroke={color} strokeWidth={1.5} />
      {isOpen && (
        <line x1={-H / 2 + 2} y1={0} x2={H / 2 - 2} y2={0}
          stroke={color} strokeWidth={1} strokeDasharray="2,2" />
      )}
    </g>
  );
}

function NportSwitchSym({ comp, color }: SymProps) {
  const W = 28; const H = 20;
  return (
    <g transform={`translate(${comp.px},${comp.py}) rotate(${comp.rotation})`}>
      <rect x={-W / 2} y={-H / 2} width={W} height={H}
        fill={BG} stroke={color} strokeWidth={1.5} rx={2} />
      <text y={4} textAnchor="middle" fill={color} fontSize={7} fontFamily={FONT}>ATS</text>
    </g>
  );
}

function GroundSym({ comp, color }: SymProps) {
  return (
    <g transform={`translate(${comp.px},${comp.py}) rotate(${comp.rotation})`}>
      <line x1={0} y1={-10} x2={0}   y2={2}  stroke={color} strokeWidth={1.5} />
      <line x1={-12} y1={2}  x2={12}  y2={2}  stroke={color} strokeWidth={1.5} />
      <line x1={-8}  y1={6}  x2={8}   y2={6}  stroke={color} strokeWidth={1.5} />
      <line x1={-4}  y1={10} x2={4}   y2={10} stroke={color} strokeWidth={1.5} />
    </g>
  );
}

// ─── Dispatch symbol by component type ───────────────────────────────────────

function ComponentSym({
  comp,
  colorMap,
  gridPx,
}: {
  comp: ResolvedComponent;
  colorMap: Map<string, string>;
  gridPx: number;
}) {
  const color = energColor(comp.energization.sourceId, comp.energization.energized, colorMap);
  const props: SymProps = { comp, color, gridPx };
  switch (comp.type) {
    case 'SOURCE':        return <SourceSym       {...props} />;
    case 'BREAKER':       return <BreakerSym      {...props} />;
    case 'BUS':           return <BusSym          {...props} />;
    case 'LOAD':          return <LoadSym         {...props} />;
    case 'CONTACTOR':     return <ContactorSym    {...props} />;
    case 'NPORT_SWITCH':  return <NportSwitchSym  {...props} />;
    case 'GROUND':        return <GroundSym       {...props} />;
    default:              return null;
  }
}

// ─── Wire renderer ────────────────────────────────────────────────────────────

function WireSym({
  wire,
  colorMap,
}: {
  wire: ResolvedWire;
  colorMap: Map<string, string>;
}) {
  const color = energColor(wire.sourceId, wire.energized, colorMap);
  if (wire.segments.length === 0) {
    // Fallback: direct line between endpoints
    return (
      <line
        x1={wire.fromPx} y1={wire.fromPy}
        x2={wire.toPx}   y2={wire.toPy}
        stroke={color} strokeWidth={1.5} strokeLinecap="round"
      />
    );
  }
  return (
    <>
      {wire.segments.map((seg, i) => (
        <line
          key={i}
          x1={seg.x1} y1={seg.y1}
          x2={seg.x2} y2={seg.y2}
          stroke={color} strokeWidth={1.5} strokeLinecap="round"
        />
      ))}
    </>
  );
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

function GridDots({ canvasW, canvasH, gridPx }: { canvasW: number; canvasH: number; gridPx: number }) {
  // Use a pattern for efficiency rather than individual circle elements
  const patId = 'tr-grid';
  return (
    <g>
      <defs>
        <pattern id={patId} x={0} y={0} width={gridPx} height={gridPx} patternUnits="userSpaceOnUse">
          <circle cx={0} cy={0} r={0.8} fill={GRID_C} />
        </pattern>
      </defs>
      <rect
        x={0} y={0}
        width={canvasW * gridPx}
        height={canvasH * gridPx}
        fill={`url(#${patId})`}
      />
    </g>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

interface Props {
  model: TopologyModel;
  className?: string;
  style?: React.CSSProperties;
}

export default function TopologyRenderer({ model, className, style }: Props) {
  const { metadata, components, wires } = model;
  const W = metadata.canvasW * metadata.gridPx;
  const H = metadata.canvasH * metadata.gridPx;

  // Build colour map once per model change
  const colorMap = useMemo(() => buildSourceColorMap(components), [components]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        background: BG,
        ...style,
      }}
    >
      {/* Grid dots */}
      <GridDots canvasW={metadata.canvasW} canvasH={metadata.canvasH} gridPx={metadata.gridPx} />

      {/* Wires drawn below components */}
      <g id="wires">
        {wires.map(w => (
          <WireSym key={w.id} wire={w} colorMap={colorMap} />
        ))}
      </g>

      {/* Component symbols */}
      <g id="components">
        {components.map(c => (
          <ComponentSym key={c.id} comp={c} colorMap={colorMap} gridPx={metadata.gridPx} />
        ))}
      </g>
    </svg>
  );
}
