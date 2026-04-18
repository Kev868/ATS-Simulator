import React from 'react';
import type { CircuitComponent } from '../../core/types';
import { COLORS, GRID_SIZE, LINE_WEIGHTS } from '../../core/constants';
import { resolveAllPorts } from '../../core/PortResolver';

interface ComponentSymbolProps {
  component: CircuitComponent;
  selected?: boolean;
  showPorts?: boolean;
  onPortClick?: (portId: string) => void;
}

function getComponentColor(comp: CircuitComponent): string {
  if (comp.state.failed) return COLORS.failed;
  if (comp.state.tripped) return COLORS.tripped;
  if (comp.state.locked) return COLORS.locked;
  if (comp.state.energized) return COLORS.energized;
  return COLORS.deenergized;
}

function UtilitySourceSymbol({ comp }: { comp: CircuitComponent }) {
  const color = getComponentColor(comp);
  const r = GRID_SIZE * 1.2;
  return (
    <g>
      <circle cx={0} cy={0} r={r} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} fill="none" />
      {/* Tilde (~) symbol */}
      <path
        d={`M ${-r * 0.5} 0 Q ${-r * 0.25} ${-r * 0.3} 0 0 Q ${r * 0.25} ${r * 0.3} ${r * 0.5} 0`}
        stroke={color} strokeWidth={LINE_WEIGHTS.symbol} fill="none"
      />
      <text x={0} y={r + GRID_SIZE * 0.6} textAnchor="middle" fontSize={GRID_SIZE * 0.45} fill={COLORS.textDim} fontFamily="monospace">
        {comp.tag}
      </text>
    </g>
  );
}

function GeneratorSourceSymbol({ comp }: { comp: CircuitComponent }) {
  const color = getComponentColor(comp);
  const r = GRID_SIZE * 1.2;
  return (
    <g>
      <circle cx={0} cy={0} r={r} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} fill="none" />
      <text x={0} y={GRID_SIZE * 0.2} textAnchor="middle" fontSize={GRID_SIZE * 0.6} fill={color} fontFamily="monospace" fontWeight="bold">G</text>
      <text x={0} y={r + GRID_SIZE * 0.6} textAnchor="middle" fontSize={GRID_SIZE * 0.45} fill={COLORS.textDim} fontFamily="monospace">
        {comp.tag}
      </text>
    </g>
  );
}

function CircuitBreakerSymbol({ comp }: { comp: CircuitComponent }) {
  const color = getComponentColor(comp);
  const s = GRID_SIZE * 0.8;
  const isClosed = comp.state.closed && !comp.state.tripped && !comp.state.locked;
  return (
    <g>
      {isClosed ? (
        // Closed: filled square
        <rect x={-s} y={-s} width={s * 2} height={s * 2} fill={color} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} opacity={0.8} />
      ) : (
        // Open: square outline with diagonal slash
        <>
          <rect x={-s} y={-s} width={s * 2} height={s * 2} fill="none" stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
          <line x1={-s} y1={-s} x2={s} y2={s} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
        </>
      )}
      <text x={0} y={s + GRID_SIZE * 0.6} textAnchor="middle" fontSize={GRID_SIZE * 0.45} fill={COLORS.textDim} fontFamily="monospace">
        {comp.tag}
      </text>
    </g>
  );
}

function BusSegmentSymbol({ comp }: { comp: CircuitComponent }) {
  const color = getComponentColor(comp);
  const busLen = (comp.properties.busLength ?? 6) * GRID_SIZE;
  const halfLen = busLen / 2;
  // Tap stub positions
  const tap1X = (-1) * GRID_SIZE;
  const tap2X = (1) * GRID_SIZE;
  const stubLen = GRID_SIZE * 0.8;
  return (
    <g>
      {/* Main bus bar */}
      <line x1={-halfLen} y1={0} x2={halfLen} y2={0} stroke={color} strokeWidth={LINE_WEIGHTS.busBar} strokeLinecap="round" />
      {/* Tap stubs */}
      <line x1={tap1X} y1={0} x2={tap1X} y2={stubLen} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
      <line x1={tap2X} y1={0} x2={tap2X} y2={stubLen} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
      <text x={0} y={-GRID_SIZE * 0.6} textAnchor="middle" fontSize={GRID_SIZE * 0.45} fill={COLORS.textDim} fontFamily="monospace">
        {comp.tag}
      </text>
    </g>
  );
}

function LoadSymbol({ comp }: { comp: CircuitComponent }) {
  const color = getComponentColor(comp);
  const w = GRID_SIZE * 1.5;
  const h = GRID_SIZE * 1.0;
  return (
    <g>
      <rect x={-w / 2} y={0} width={w} height={h} fill={color} opacity={0.2} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
      <text x={0} y={h / 2 + GRID_SIZE * 0.15} textAnchor="middle" fontSize={GRID_SIZE * 0.38} fill={color} fontFamily="monospace">
        {comp.properties.loadKW ?? '?'}kW
      </text>
      <text x={0} y={h + GRID_SIZE * 0.6} textAnchor="middle" fontSize={GRID_SIZE * 0.45} fill={COLORS.textDim} fontFamily="monospace">
        {comp.tag}
      </text>
    </g>
  );
}

function GroundSymbol(_: { comp: CircuitComponent }) {
  const color = COLORS.deenergized;
  const w = GRID_SIZE * 0.8;
  return (
    <g>
      <line x1={0} y1={0} x2={0} y2={GRID_SIZE * 0.5} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
      <line x1={-w / 2} y1={GRID_SIZE * 0.5} x2={w / 2} y2={GRID_SIZE * 0.5} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
      <line x1={-w * 0.35} y1={GRID_SIZE * 0.8} x2={w * 0.35} y2={GRID_SIZE * 0.8} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
      <line x1={-w * 0.15} y1={GRID_SIZE * 1.1} x2={w * 0.15} y2={GRID_SIZE * 1.1} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
    </g>
  );
}

function JunctionSymbol({ comp }: { comp: CircuitComponent }) {
  const color = comp.state.energized ? COLORS.energized : COLORS.deenergized;
  return (
    <circle cx={0} cy={0} r={GRID_SIZE * 0.15} fill={color} />
  );
}

export function ComponentSymbol({ component, selected, showPorts, onPortClick }: ComponentSymbolProps) {
  const cx = component.x * GRID_SIZE;
  const cy = component.y * GRID_SIZE;
  const rotDeg = component.rotation;

  let symbol: React.ReactNode;
  switch (component.type) {
    case "utility-source":    symbol = <UtilitySourceSymbol comp={component} />; break;
    case "generator-source":  symbol = <GeneratorSourceSymbol comp={component} />; break;
    case "circuit-breaker":   symbol = <CircuitBreakerSymbol comp={component} />; break;
    case "bus-segment":       symbol = <BusSegmentSymbol comp={component} />; break;
    case "load":              symbol = <LoadSymbol comp={component} />; break;
    case "ground":            symbol = <GroundSymbol comp={component} />; break;
    case "junction":          symbol = <JunctionSymbol comp={component} />; break;
  }

  const resolvedPorts = resolveAllPorts(component);

  return (
    <g transform={`translate(${cx},${cy}) rotate(${rotDeg})`}>
      {selected && (
        <circle cx={0} cy={0} r={GRID_SIZE * 1.8} fill="none" stroke={COLORS.selected} strokeWidth={2} opacity={0.5} strokeDasharray="4 2" />
      )}
      {symbol}
      {showPorts && Array.from(resolvedPorts.values()).map((rp) => {
        const px = (rp.absoluteX - component.x) * GRID_SIZE;
        const py = (rp.absoluteY - component.y) * GRID_SIZE;
        return (
          <circle
            key={rp.portId}
            cx={px}
            cy={py}
            r={GRID_SIZE * 0.18}
            fill={COLORS.selected}
            stroke="white"
            strokeWidth={1}
            style={{ cursor: 'pointer' }}
            onClick={() => onPortClick?.(rp.portId)}
          />
        );
      })}
    </g>
  );
}
