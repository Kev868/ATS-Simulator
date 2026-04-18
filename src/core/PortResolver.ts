import type { CircuitComponent, PortDefinition } from './types';

export interface ResolvedPort {
  portId: string;
  absoluteX: number;
  absoluteY: number;
}

function rotateOffset(relX: number, relY: number, rotation: 0 | 90 | 180 | 270): [number, number] {
  switch (rotation) {
    case 0:   return [relX, relY];
    case 90:  return [-relY, relX];
    case 180: return [-relX, -relY];
    case 270: return [relY, -relX];
  }
}

export function resolvePort(component: CircuitComponent, port: PortDefinition): ResolvedPort {
  const [dx, dy] = rotateOffset(port.relativeX, port.relativeY, component.rotation);
  return {
    portId: port.id,
    absoluteX: component.x + dx,
    absoluteY: component.y + dy,
  };
}

export function resolveAllPorts(component: CircuitComponent): Map<string, ResolvedPort> {
  const result = new Map<string, ResolvedPort>();
  for (const port of component.ports) {
    if (port.enabled) {
      result.set(port.id, resolvePort(component, port));
    }
  }
  return result;
}
