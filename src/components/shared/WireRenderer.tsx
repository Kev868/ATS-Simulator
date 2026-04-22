import { routeWire } from '../../core/WireRouter';
import { COLORS, GRID_SIZE, LINE_WEIGHTS } from '../../core/constants';
import type { CircuitWire, CircuitModel } from '../../core/types';
import { resolveAllPorts } from '../../core/PortResolver';

interface WireRendererProps {
  wire: CircuitWire;
  model: CircuitModel;
  selected?: boolean;
  onClick?: (wireId: string) => void;
}

export function WireRenderer({ wire, model, selected, onClick }: WireRendererProps) {
  const fromComp = model.components.find((c) => c.id === wire.fromComponentId);
  const toComp = model.components.find((c) => c.id === wire.toComponentId);
  if (!fromComp || !toComp) return null;

  const fromPorts = resolveAllPorts(fromComp);
  const toPorts = resolveAllPorts(toComp);
  const fromPort = fromPorts.get(wire.fromPortId);
  const toPort = toPorts.get(wire.toPortId);
  if (!fromPort || !toPort) return null;

  const points = routeWire(
    fromPort.absoluteX * GRID_SIZE,
    fromPort.absoluteY * GRID_SIZE,
    toPort.absoluteX * GRID_SIZE,
    toPort.absoluteY * GRID_SIZE,
  );

  const isEnergized = fromComp.state.energized && toComp.state.energized;
  const stroke = selected ? COLORS.selected : (isEnergized ? COLORS.wireEnergized : COLORS.wire);
  const pointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <g>
      {/* Selection halo behind wire */}
      {selected && (
        <polyline
          points={pointsStr}
          stroke={COLORS.selected}
          strokeOpacity={0.35}
          strokeWidth={LINE_WEIGHTS.wire + 6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}
      {/* Visible wire */}
      <polyline
        points={pointsStr}
        stroke={stroke}
        strokeWidth={selected ? LINE_WEIGHTS.wire + 1 : LINE_WEIGHTS.wire}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      />
      {/* Invisible fat hit area for easier click targeting */}
      {onClick && (
        <polyline
          points={pointsStr}
          stroke="transparent"
          strokeWidth={12}
          fill="none"
          style={{ cursor: 'pointer' }}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            onClick(wire.id);
          }}
        />
      )}
    </g>
  );
}
