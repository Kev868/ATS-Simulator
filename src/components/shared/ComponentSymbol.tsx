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

// --- Geometry-only symbol functions (get rotated) ---

function UtilitySourceGeometry({ comp }: { comp: CircuitComponent }) {
  const color = getComponentColor(comp);
  const r = GRID_SIZE * 0.9;
  const portX = 2.5 * GRID_SIZE;
  return (
    <g>
      <circle cx={0} cy={0} r={r} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} fill="none" />
      <path
        d={`M ${-r * 0.55} 0 Q ${-r * 0.275} ${-r * 0.45} 0 0 T ${r * 0.55} 0`}
        stroke={color} strokeWidth={LINE_WEIGHTS.symbol} fill="none"
      />
      <line x1={r} y1={0} x2={portX} y2={0} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
    </g>
  );
}

function GeneratorSourceGeometry({ comp }: { comp: CircuitComponent }) {
  const color = getComponentColor(comp);
  const r = GRID_SIZE * 0.9;
  const portX = 2.5 * GRID_SIZE;
  return (
    <g>
      <circle cx={0} cy={0} r={r} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} fill="none" />
      <circle cx={0} cy={0} r={r - 4} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} fill="none" opacity={0.55} />
      <line x1={r} y1={0} x2={portX} y2={0} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
    </g>
  );
}

function CircuitBreakerGeometry({ comp }: { comp: CircuitComponent }) {
  const color = getComponentColor(comp);
  const s = GRID_SIZE * 0.5;
  const linePortX = -1.5 * GRID_SIZE;
  const loadPortX = 1.5 * GRID_SIZE;
  const isClosed = comp.state.closed && !comp.state.tripped && !comp.state.locked;
  return (
    <g>
      <line x1={linePortX} y1={0} x2={-s} y2={0} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
      <line x1={s} y1={0} x2={loadPortX} y2={0} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
      {isClosed ? (
        <rect x={-s} y={-s} width={s * 2} height={s * 2} fill={color} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
      ) : (
        <>
          <rect x={-s} y={-s} width={s * 2} height={s * 2} fill="none" stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
          <line x1={-s} y1={s} x2={s} y2={-s} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
        </>
      )}
      {(comp.state.tripped || comp.state.locked) && (
        <>
          <line x1={-s * 0.6} y1={-s * 0.6} x2={s * 0.6} y2={s * 0.6} stroke={COLORS.background} strokeWidth={LINE_WEIGHTS.symbol} />
          <line x1={-s * 0.6} y1={s * 0.6} x2={s * 0.6} y2={-s * 0.6} stroke={COLORS.background} strokeWidth={LINE_WEIGHTS.symbol} />
        </>
      )}
    </g>
  );
}

function BusSegmentGeometry({ comp }: { comp: CircuitComponent }) {
  const color = getComponentColor(comp);
  const busLen = (comp.properties.busLength ?? 6) * GRID_SIZE;
  const halfLen = busLen / 2;
  const tap1X = -1 * GRID_SIZE;
  const tap2X = 1 * GRID_SIZE;
  const tapY = 1.5 * GRID_SIZE;
  return (
    <g>
      <line
        x1={-halfLen} y1={0} x2={halfLen} y2={0}
        stroke={color} strokeWidth={LINE_WEIGHTS.busBar} strokeLinecap="square"
      />
      <line x1={tap1X} y1={0} x2={tap1X} y2={tapY} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
      <line x1={tap2X} y1={0} x2={tap2X} y2={tapY} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
    </g>
  );
}

function LoadGeometry({ comp }: { comp: CircuitComponent }) {
  const color = getComponentColor(comp);
  const w = GRID_SIZE * 1.4;
  const h = GRID_SIZE * 0.9;
  const portY = -1.5 * GRID_SIZE;
  const rectTop = -h / 2;
  const rectBot = h / 2;
  return (
    <g>
      <line x1={0} y1={rectTop} x2={0} y2={portY} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
      <rect x={-w / 2} y={rectTop} width={w} height={h} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
      <line x1={-GRID_SIZE * 0.35} y1={rectBot + GRID_SIZE * 0.22} x2={GRID_SIZE * 0.35} y2={rectBot + GRID_SIZE * 0.22} stroke={COLORS.deenergized} strokeWidth={LINE_WEIGHTS.symbol} />
      <line x1={-GRID_SIZE * 0.22} y1={rectBot + GRID_SIZE * 0.38} x2={GRID_SIZE * 0.22} y2={rectBot + GRID_SIZE * 0.38} stroke={COLORS.deenergized} strokeWidth={LINE_WEIGHTS.symbol} />
      <line x1={-GRID_SIZE * 0.1} y1={rectBot + GRID_SIZE * 0.54} x2={GRID_SIZE * 0.1} y2={rectBot + GRID_SIZE * 0.54} stroke={COLORS.deenergized} strokeWidth={LINE_WEIGHTS.symbol} />
    </g>
  );
}

function GroundGeometry() {
  const color = COLORS.deenergized;
  const portY = -1 * GRID_SIZE;
  return (
    <g>
      <line x1={0} y1={portY} x2={0} y2={0} stroke={color} strokeWidth={LINE_WEIGHTS.wire} />
      <line x1={-GRID_SIZE * 0.4} y1={0} x2={GRID_SIZE * 0.4} y2={0} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
      <line x1={-GRID_SIZE * 0.25} y1={GRID_SIZE * 0.18} x2={GRID_SIZE * 0.25} y2={GRID_SIZE * 0.18} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
      <line x1={-GRID_SIZE * 0.1} y1={GRID_SIZE * 0.36} x2={GRID_SIZE * 0.1} y2={GRID_SIZE * 0.36} stroke={color} strokeWidth={LINE_WEIGHTS.symbol} />
    </g>
  );
}

function JunctionGeometry({ comp }: { comp: CircuitComponent }) {
  const color = comp.state.energized ? COLORS.energized : COLORS.deenergized;
  return <circle cx={0} cy={0} r={LINE_WEIGHTS.wire * 1.2} fill={color} />;
}

// --- Labels (always horizontal, never rotated, at fixed offsets from component center) ---

function ComponentLabels({ comp }: { comp: CircuitComponent }) {
  switch (comp.type) {
    case 'utility-source':
      return (
        <g>
          <text x={0} y={-GRID_SIZE * 1.25} textAnchor="middle" {...LABEL_FONT} fill={COLORS.text}>{comp.tag}</text>
          <text x={0} y={GRID_SIZE * 1.45} textAnchor="middle" {...LABEL_FONT} fill={COLORS.textDim}>UTIL</text>
        </g>
      );
    case 'generator-source':
      return (
        <g>
          <text x={0} y={GRID_SIZE * 0.18} textAnchor="middle" fontFamily="monospace" fontSize={GRID_SIZE * 0.55} fontWeight="bold" fill={getComponentColor(comp)}>G</text>
          <text x={0} y={-GRID_SIZE * 1.25} textAnchor="middle" {...LABEL_FONT} fill={COLORS.text}>{comp.tag}</text>
          <text x={0} y={GRID_SIZE * 1.45} textAnchor="middle" {...LABEL_FONT} fill={COLORS.textDim}>GEN</text>
        </g>
      );
    case 'circuit-breaker':
      return (
        <g>
          <text x={0} y={-GRID_SIZE * 0.85} textAnchor="middle" {...LABEL_FONT} fill={COLORS.text}>{comp.tag}</text>
          <text x={0} y={GRID_SIZE * 1.05} textAnchor="middle" {...LABEL_FONT} fill={COLORS.textDim}>52</text>
        </g>
      );
    case 'bus-segment':
      return (
        <text x={0} y={-GRID_SIZE * 0.35} textAnchor="middle" {...LABEL_FONT} fill={COLORS.text}>{comp.tag}</text>
      );
    case 'load':
      return (
        <g>
          <text x={0} y={-GRID_SIZE * 1.7} textAnchor="middle" {...LABEL_FONT} fill={COLORS.text}>{comp.tag}</text>
          <text x={0} y={2} textAnchor="middle" dominantBaseline="middle" fontFamily="monospace" fontSize={GRID_SIZE * 0.38} fill={getComponentColor(comp)}>
            {comp.properties.loadKW ?? '?'}kW
          </text>
        </g>
      );
    case 'ground':
      return comp.tag ? (
        <text x={GRID_SIZE * 0.55} y={GRID_SIZE * 0.15} {...LABEL_FONT} fill={COLORS.textDim}>{comp.tag}</text>
      ) : null;
    case 'junction':
      return null;
  }
}

function getSymbolBounds(comp: CircuitComponent): { x: number; y: number; w: number; h: number } {
  switch (comp.type) {
    case 'utility-source':
    case 'generator-source': {
      const r = GRID_SIZE * 0.9;
      return { x: -r - 4, y: -r - 4, w: r * 2 + 8, h: r * 2 + 8 };
    }
    case 'circuit-breaker': {
      const s = GRID_SIZE * 0.5;
      return { x: -s - 4, y: -s - 4, w: s * 2 + 8, h: s * 2 + 8 };
    }
    case 'bus-segment': {
      const busLen = (comp.properties.busLength ?? 6) * GRID_SIZE;
      return { x: -busLen / 2 - 4, y: -GRID_SIZE * 0.3, w: busLen + 8, h: GRID_SIZE * 2.0 };
    }
    case 'load': {
      const w = GRID_SIZE * 1.4;
      const h = GRID_SIZE * 0.9;
      return { x: -w / 2 - 4, y: -GRID_SIZE * 1.6, w: w + 8, h: h + GRID_SIZE * 2.4 };
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

  let geometry: ReactNode;
  switch (component.type) {
    case 'utility-source':    geometry = <UtilitySourceGeometry comp={component} />; break;
    case 'generator-source':  geometry = <GeneratorSourceGeometry comp={component} />; break;
    case 'circuit-breaker':   geometry = <CircuitBreakerGeometry comp={component} />; break;
    case 'bus-segment':       geometry = <BusSegmentGeometry comp={component} />; break;
    case 'load':              geometry = <LoadGeometry comp={component} />; break;
    case 'ground':            geometry = <GroundGeometry />; break;
    case 'junction':          geometry = <JunctionGeometry comp={component} />; break;
  }

  const resolvedPorts = resolveAllPorts(component);
  const bounds = getSymbolBounds(component);

  return (
    <g transform={`translate(${cx},${cy})`}>
      {/* Rotated geometry + selection rect */}
      <g transform={`rotate(${rotDeg})`}>
        {selected && (
          <rect
            x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h}
            fill="none" stroke={COLORS.selected} strokeWidth={2}
            strokeDasharray="4 3" opacity={0.8}
          />
        )}
        {geometry}
      </g>
      {/* Labels — always horizontal, never rotated */}
      <ComponentLabels comp={component} />
      {/* Port indicators — positioned from already-rotated port offsets */}
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
