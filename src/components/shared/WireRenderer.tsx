
import { routeWire } from '../../core/WireRouter';
import { COLORS, GRID_SIZE, LINE_WEIGHTS } from '../../core/constants';
import type { CircuitWire, CircuitModel } from '../../core/types';
import { resolveAllPorts } from '../../core/PortResolver';

interface WireRendererProps {
  wire: CircuitWire;
  model: CircuitModel;
}

export function WireRenderer({ wire, model }: WireRendererProps) {
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
  const stroke = isEnergized ? COLORS.wireEnergized : COLORS.wire;
  const pointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <polyline
      points={pointsStr}
      stroke={stroke}
      strokeWidth={LINE_WEIGHTS.wire}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
