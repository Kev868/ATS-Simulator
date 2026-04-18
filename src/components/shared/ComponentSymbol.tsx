import type { ReactNode } from 'react';
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

const LABEL_FONT = { fontFamily: 'monospace', fontSize: GRID_SIZE * 0.38 };

function UtilitySourceSymbol({ comp }: { comp: CircuitComponent }) {
  const color = getComponentColor(comp);
  const r = GRID_SIZE * 0.9;
  const portX = 2.5 * GRID_SIZE;
  return (
    <g>
      <circle cx={0} cy={0} r={r} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} fill="none" />
      {/* Sine wave (~) inside */}
      <path
        d={`M ${-r * 0.55} 0 Q ${-r * 0.275} ${-r * 0.45} 0 0 T ${r * 0.55} 0`}
        stroke={color} strokeWidth={LINE_WEIGHTS.symbol} fill="none"
      />
      {/* Output stub */}
      <line x1={r} y1={0} x2={portX} y2={0} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
      {/* Tag above */}
      <text x={0} y={-r - GRID_SIZE * 0.35} textAnchor="middle" {...LABEL_FONT} fill={COLORS.text}>
        {comp.tag}
      </text>
      {/* Device label below */}
      <text x={0} y={r + GRID_SIZE * 0.55} textAnchor="middle" {...LABEL_FONT} fill={COLORS.textDim}>
        UTIL
      </text>
    </g>
  );
}

function GeneratorSourceSymbol({ comp }: { comp: CircuitComponent }) {
  const color = getComponentColor(comp);
  const r = GRID_SIZE * 0.9;
  const portX = 2.5 * GRID_SIZE;
  return (
    <g>
      {/* Double circle for differentiation */}
      <circle cx={0} cy={0} r={r} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} fill="none" />
      <circle cx={0} cy={0} r={r - 4} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} fill="none" opacity={0.55} />
      {/* G label inside */}
      <text x={0} y={GRID_SIZE * 0.18} textAnchor="middle" fontFamily="monospace" fontSize={GRID_SIZE * 0.55} fontWeight="bold" fill={color}>
        G
      </text>
      {/* Output stub */}
      <line x1={r} y1={0} x2={portX} y2={0} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
      <text x={0} y={-r - GRID_SIZE * 0.35} textAnchor="middle" {...LABEL_FONT} fill={COLORS.text}>
        {comp.tag}
      </text>
      <text x={0} y={r + GRID_SIZE * 0.55} textAnchor="middle" {...LABEL_FONT} fill={COLORS.textDim}>
        GEN
      </text>
    </g>
  );
}

function CircuitBreakerSymbol({ comp }: { comp: CircuitComponent }) {
  const color = getComponentColor(comp);
  const s = GRID_SIZE * 0.5;
  const linePortX = -1.5 * GRID_SIZE;
  const loadPortX = 1.5 * GRID_SIZE;
  const isClosed = comp.state.closed && !comp.state.tripped && !comp.state.locked;
  return (
    <g>
      {/* Line-side stub */}
      <line x1={linePortX} y1={0} x2={-s} y2={0} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
      {/* Load-side stub */}
      <line x1={s} y1={0} x2={loadPortX} y2={0} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
      {/* Square body */}
      {isClosed ? (
        <rect x={-s} y={-s} width={s * 2} height={s * 2} fill={color} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
      ) : (
        <>
          <rect x={-s} y={-s} width={s * 2} height={s * 2} fill="none" stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
          {/* Diagonal slash from bottom-left to top-right */}
          <line x1={-s} y1={s} x2={s} y2={-s} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
        </>
      )}
      {/* Trip/lock overlay */}
      {(comp.state.tripped || comp.state.locked) && (
        <>
          <line x1={-s * 0.6} y1={-s * 0.6} x2={s * 0.6} y2={s * 0.6} stroke={COLORS.background} strokeWidth={LINE_WEIGHTS.symbol} />
          <line x1={-s * 0.6} y1={s * 0.6} x2={s * 0.6} y2={-s * 0.6} stroke={COLORS.background} strokeWidth={LINE_WEIGHTS.symbol} />
        </>
      )}
      {/* Tag above */}
      <text x={0} y={-s - GRID_SIZE * 0.35} textAnchor="middle" {...LABEL_FONT} fill={COLORS.text}>
        {comp.tag}
      </text>
      {/* ANSI device number below */}
      <text x={0} y={s + GRID_SIZE * 0.55} textAnchor="middle" {...LABEL_FONT} fill={COLORS.textDim}>
        52
      </text>
    </g>
  );
}

function BusSegmentSymbol({ comp }: { comp: CircuitComponent }) {
  const color = getComponentColor(comp);
  const busLen = (comp.properties.busLength ?? 6) * GRID_SIZE;
  const halfLen = busLen / 2;
  // Tap ports: relativeX -1 and +1, relativeY +1.5 (below bus)
  const tap1X = -1 * GRID_SIZE;
  const tap2X = 1 * GRID_SIZE;
  const tapY = 1.5 * GRID_SIZE;
  return (
    <g>
      {/* Main bus bar */}
      <line
        x1={-halfLen} y1={0} x2={halfLen} y2={0}
        stroke={color} strokeWidth={LINE_WEIGHTS.busBar} strokeLinecap="square"
      />
      {/* Tap stubs extending down to port positions */}
      <line x1={tap1X} y1={0} x2={tap1X} y2={tapY} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
      <line x1={tap2X} y1={0} x2={tap2X} y2={tapY} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
      {/* Tag above, centered */}
      <text x={0} y={-GRID_SIZE * 0.3} textAnchor="middle" {...LABEL_FONT} fill={COLORS.text}>
        {comp.tag}
      </text>
    </g>
  );
}

function LoadSymbol({ comp }: { comp: CircuitComponent }) {
  const color = getComponentColor(comp);
  const w = GRID_SIZE * 1.4;
  const h = GRID_SIZE * 0.9;
  const portY = -1.5 * GRID_SIZE;
  // Rectangle centered at origin
  const rectTop = -h / 2;
  const rectBot = h / 2;
  return (
    <g>
      {/* Supply port stub from rectangle top up to port */}
      <line x1={0} y1={rectTop} x2={0} y2={portY} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
      {/* Load rectangle */}
      <rect x={-w / 2} y={rectTop} width={w} height={h} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
      <text x={0} y={2} textAnchor="middle" dominantBaseline="middle" fontFamily="monospace" fontSize={GRID_SIZE * 0.38} fill={color}>
        {comp.properties.loadKW ?? '?'}kW
      </text>
      {/* Ground bar: three horizontal lines of decreasing width below rectangle */}
      <line x1={-GRID_SIZE * 0.35} y1={rectBot + GRID_SIZE * 0.22} x2={GRID_SIZE * 0.35} y2={rectBot + GRID_SIZE * 0.22} stroke={COLORS.deenergized} strokeWidth={LINE_WEIGHTS.symbol} />
      <line x1={-GRID_SIZE * 0.22} y1={rectBot + GRID_SIZE * 0.38} x2={GRID_SIZE * 0.22} y2={rectBot + GRID_SIZE * 0.38} stroke={COLORS.deenergized} strokeWidth={LINE_WEIGHTS.symbol} />
      <line x1={-GRID_SIZE * 0.1} y1={rectBot + GRID_SIZE * 0.54} x2={GRID_SIZE * 0.1} y2={rectBot + GRID_SIZE * 0.54} stroke={COLORS.deenergized} strokeWidth={LINE_WEIGHTS.symbol} />
      {/* Tag above */}
      <text x={0} y={portY - GRID_SIZE * 0.2} textAnchor="middle" {...LABEL_FONT} fill={COLORS.text}>
        {comp.tag}
      </text>
    </g>
  );
}

function GroundSymbol({ comp }: { comp: CircuitComponent }) {
  const color = COLORS.deenergized;
  const portY = -1 * GRID_SIZE;
  return (
    <g>
      {/* Stub from origin up to port */}
      <line x1={0} y1={portY} x2={0} y2={0} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
      {/* Three horizontal lines of decreasing width */}
      <line x1={-GRID_SIZE * 0.4} y1={0} x2={GRID_SIZE * 0.4} y2={0} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
      <line x1={-GRID_SIZE * 0.25} y1={GRID_SIZE * 0.18} x2={GRID_SIZE * 0.25} y2={GRID_SIZE * 0.18} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
      <line x1={-GRID_SIZE * 0.1} y1={GRID_SIZE * 0.36} x2={GRID_SIZE * 0.1} y2={GRID_SIZE * 0.36} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
      {comp.tag && (
        <text x={GRID_SIZE * 0.55} y={GRID_SIZE * 0.15} {...LABEL_FONT} fill={COLORS.textDim}>
          {comp.tag}
        </text>
      )}
    </g>
  );
}

function JunctionSymbol({ comp }: { comp: CircuitComponent }) {
  const color = comp.state.energized ? COLORS.energized : COLORS.deenergized;
  return <circle cx={0} cy={0} r={LINE_WEIGHTS.wire * 1.2} fill={color} />;
}

function getSymbolBounds(comp: CircuitComponent): { x: number; y: number; w: number; h: number } {
  switch (comp.type) {
    case 'utility-source':
    case 'generator-source': {
      const r = GRID_SIZE * 0.9;
      return { x: -r - 4, y: -r - GRID_SIZE * 0.6, w: r * 2 + 8, h: r * 2 + GRID_SIZE * 1.1 };
    }
    case 'circuit-breaker': {
      const s = GRID_SIZE * 0.5;
      return { x: -s - 4, y: -s - GRID_SIZE * 0.55, w: s * 2 + 8, h: s * 2 + GRID_SIZE * 1.1 };
    }
    case 'bus-segment': {
      const busLen = (comp.properties.busLength ?? 6) * GRID_SIZE;
      return { x: -busLen / 2 - 4, y: -GRID_SIZE * 0.6, w: busLen + 8, h: GRID_SIZE * 1.0 };
    }
    case 'load': {
      const w = GRID_SIZE * 1.4;
      const h = GRID_SIZE * 0.9;
      return { x: -w / 2 - 4, y: -GRID_SIZE * 1.7, w: w + 8, h: h + GRID_SIZE * 2.3 };
    }
    case 'ground':
      return { x: -GRID_SIZE * 0.5, y: -GRID_SIZE * 1.1, w: GRID_SIZE, h: GRID_SIZE * 1.6 };
    case 'junction':
      return { x: -GRID_SIZE * 0.3, y: -GRID_SIZE * 0.3, w: GRID_SIZE * 0.6, h: GRID_SIZE * 0.6 };
  }
}

export function ComponentSymbol({ component, selected, showPorts, onPortClick }: ComponentSymbolProps) {
  const cx = component.x * GRID_SIZE;
  const cy = component.y * GRID_SIZE;
  const rotDeg = component.rotation;

  let symbol: ReactNode;
  switch (component.type) {
    case 'utility-source':    symbol = <UtilitySourceSymbol comp={component} />; break;
    case 'generator-source':  symbol = <GeneratorSourceSymbol comp={component} />; break;
    case 'circuit-breaker':   symbol = <CircuitBreakerSymbol comp={component} />; break;
    case 'bus-segment':       symbol = <BusSegmentSymbol comp={component} />; break;
    case 'load':              symbol = <LoadSymbol comp={component} />; break;
    case 'ground':            symbol = <GroundSymbol comp={component} />; break;
    case 'junction':          symbol = <JunctionSymbol comp={component} />; break;
  }

  const resolvedPorts = resolveAllPorts(component);
  const bounds = getSymbolBounds(component);

  return (
    <g transform={`translate(${cx},${cy}) rotate(${rotDeg})`}>
      {selected && (
        <rect
          x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h}
          fill="none" stroke={COLORS.selected} strokeWidth={2}
          strokeDasharray="4 3" opacity={0.8}
        />
      )}
      {symbol}
      {showPorts && Array.from(resolvedPorts.values()).map((rp) => {
        const px = (rp.absoluteX - component.x) * GRID_SIZE;
        const py = (rp.absoluteY - component.y) * GRID_SIZE;
        return (
          <circle
            key={rp.portId}
            cx={px} cy={py}
            r={GRID_SIZE * 0.15}
            fill={COLORS.selected} stroke="white" strokeWidth={1}
            style={{ cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onPortClick?.(rp.portId); }}
          />
        );
      })}
    </g>
  );
}
