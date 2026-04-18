import type { CircuitModel, AdjacencyGraph, PortNode, GraphEdge } from './types';
import { COMPONENT_REGISTRY } from './ComponentRegistry';
import { resolveAllPorts } from './PortResolver';

function nodeKey(componentId: string, portId: string): string {
  return `${componentId}:${portId}`;
}

export function buildAdjacencyGraph(model: CircuitModel): AdjacencyGraph {
  const nodes = new Map<string, PortNode>();
  const edges: GraphEdge[] = [];
  const adjacency = new Map<string, string[]>();

  const addEdge = (fromKey: string, toKey: string, wireId: string) => {
    edges.push({
      wireId,
      from: nodes.get(fromKey)!,
      to: nodes.get(toKey)!,
    });
    if (!adjacency.has(fromKey)) adjacency.set(fromKey, []);
    if (!adjacency.has(toKey)) adjacency.set(toKey, []);
    adjacency.get(fromKey)!.push(toKey);
    adjacency.get(toKey)!.push(fromKey);
  };

  // Create a node for every enabled port of every component
  for (const comp of model.components) {
    const resolved = resolveAllPorts(comp);
    for (const [portId, pos] of resolved) {
      const key = nodeKey(comp.id, portId);
      nodes.set(key, {
        componentId: comp.id,
        portId,
        absoluteX: pos.absoluteX,
        absoluteY: pos.absoluteY,
      });
      if (!adjacency.has(key)) adjacency.set(key, []);
    }
  }

  // Wire edges (external)
  for (const wire of model.wires) {
    const fromKey = nodeKey(wire.fromComponentId, wire.fromPortId);
    const toKey = nodeKey(wire.toComponentId, wire.toPortId);
    if (nodes.has(fromKey) && nodes.has(toKey)) {
      addEdge(fromKey, toKey, wire.id);
    }
  }

  // Internal component edges — only if the component conducts
  for (const comp of model.components) {
    const def = COMPONENT_REGISTRY[comp.type];
    if (!def.conductsWhen(comp.state)) continue;

    const portIds = comp.ports
      .filter((p) => p.enabled)
      .map((p) => p.id);

    // Connect every port to every other port within the component
    for (let i = 0; i < portIds.length; i++) {
      for (let j = i + 1; j < portIds.length; j++) {
        const keyA = nodeKey(comp.id, portIds[i]);
        const keyB = nodeKey(comp.id, portIds[j]);
        if (nodes.has(keyA) && nodes.has(keyB)) {
          // Use a synthetic wire id for internal edges
          addEdge(keyA, keyB, `__internal__${comp.id}`);
        }
      }
    }
  }

  return { nodes, edges, adjacency };
}

export { nodeKey };
