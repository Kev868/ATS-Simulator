export interface Point {
  x: number;
  y: number;
}

export function routeWire(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Point[] {
  // Straight horizontal
  if (Math.abs(fromY - toY) < 0.001) {
    return [{ x: fromX, y: fromY }, { x: toX, y: toY }];
  }
  // Straight vertical
  if (Math.abs(fromX - toX) < 0.001) {
    return [{ x: fromX, y: fromY }, { x: toX, y: toY }];
  }
  // L-shaped: horizontal-first (go to midX, then vertical to destination)
  const midX = (fromX + toX) / 2;
  return [
    { x: fromX, y: fromY },
    { x: midX, y: fromY },
    { x: midX, y: toY },
    { x: toX, y: toY },
  ];
}
