import type { CircuitModel, AdjacencyGraph } from './types';
import { COMPONENT_REGISTRY } from './ComponentRegistry';
import { buildAdjacencyGraph, nodeKey } from './CircuitGraph';

export function solveEnergization(model: CircuitModel, graph: AdjacencyGraph): Map<string, boolean> {
  const energized = new Map<string, boolean>();
  for (const comp of model.components) {
    energized.set(comp.id, false);
  }

  const visited = new Set<string>();
  const queue: string[] = [];

  // Seed BFS from all live source output ports
  for (const comp of model.components) {
    const def = COMPONENT_REGISTRY[comp.type];
    if (!def.isSource) continue;
    if (!def.conductsWhen(comp.state)) continue;

    for (const port of comp.ports) {
      if (!port.enabled) continue;
      const key = nodeKey(comp.id, port.id);
      if (graph.nodes.has(key)) {
        queue.push(key);
        visited.add(key);
      }
    }
  }

  // BFS through adjacency graph
  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = graph.nodes.get(current);
    if (!node) continue;

    energized.set(node.componentId, true);

    const neighbors = graph.adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return energized;
}

export function applyEnergization(model: CircuitModel): void {
  const graph = buildAdjacencyGraph(model);
  const energizationMap = solveEnergization(model, graph);
  for (const comp of model.components) {
    comp.state.energized = energizationMap.get(comp.id) ?? false;
  }
}
