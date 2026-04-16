// ─── BFS energization sweep for TopologyModel ────────────────────────────────
// Operates on the shared TopologyModel types (Component[], Wire[]).
// Mirrors the logic in connectivity.ts but decoupled from the builder's
// GComponent / GWire types so the simulation renderer can use it directly.

import { Component, Wire } from '../models/TopologyModel';

// ─── Result type ─────────────────────────────────────────────────────────────
export type EnergizationMap = Record<
  string,
  { energized: boolean; sourceId: string | null }
>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function portKey(compId: string, portId: string): string {
  return `${compId}.${portId}`;
}

/** Wire adjacency: portKey → list of connected portKeys. */
function buildWireAdj(wires: Wire[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  };
  for (const w of wires) {
    add(
      portKey(w.fromComponentId, w.fromPortId),
      portKey(w.toComponentId, w.toPortId),
    );
  }
  return adj;
}

/**
 * Given that energy has entered `comp` through `entryPortId`, return the IDs
 * of other ports on the same component that energy can exit through.
 */
function internalPeers(comp: Component, entryPortId: string): string[] {
  const others = comp.ports
    .filter(p => p.enabled && p.id !== entryPortId)
    .map(p => p.id);

  switch (comp.type) {
    case 'utility-source':
    case 'generator-source':
      return others;

    case 'bus':
      return others;

    case 'breaker':
    case 'switch': {
      const st = (comp.properties.breakerState as string) ?? 'OPEN';
      return st === 'CLOSED' ? others : [];
    }

    case 'load':
    case 'ground':
      return [];

    default:
      // Unknown type — treat as passive (no pass-through)
      return [];
  }
}

// ─── Main BFS ────────────────────────────────────────────────────────────────

/**
 * BFS/DFS from every live source through wires, stopping at open breakers.
 * Returns an EnergizationMap: component ID → { energized, sourceId }.
 */
export function computeModelEnergization(
  components: Component[],
  wires: Wire[],
): EnergizationMap {
  const result: EnergizationMap = {};
  const compMap = new Map<string, Component>(components.map(c => [c.id, c]));
  const wireAdj = buildWireAdj(wires);

  // portKey → sourceId that energized it
  const visited = new Map<string, string>();

  interface QItem { pk: string; sourceId: string }
  const queue: QItem[] = [];

  // Seed: all live sources
  for (const comp of components) {
    if (comp.type !== 'utility-source' && comp.type !== 'generator-source') continue;

    const available = (comp.properties.available as boolean) ?? true;
    const voltage = (comp.properties.voltage as number) ?? 100;
    const alive = available && voltage > 0;

    if (alive) {
      result[comp.id] = { energized: true, sourceId: comp.id };
      for (const port of comp.ports) {
        if (!port.enabled) continue;
        const pk = portKey(comp.id, port.id);
        visited.set(pk, comp.id);
        queue.push({ pk, sourceId: comp.id });
      }
    } else {
      result[comp.id] = { energized: false, sourceId: null };
    }
  }

  // BFS
  while (queue.length > 0) {
    const { pk, sourceId } = queue.shift()!;
    const [compId, portId] = pk.split('.');
    const comp = compMap.get(compId);
    if (!comp) continue;

    // Internal propagation
    const peers = internalPeers(comp, portId);
    for (const peerId of peers) {
      const peerPk = portKey(compId, peerId);
      if (!visited.has(peerPk)) {
        visited.set(peerPk, sourceId);
        queue.push({ pk: peerPk, sourceId });
      }
    }

    // Mark component energized
    if (!(compId in result) && comp.type !== 'utility-source' && comp.type !== 'generator-source') {
      result[compId] = { energized: true, sourceId };
    }

    // Follow wires to neighbours
    const neighbours = wireAdj.get(pk) ?? [];
    for (const nPk of neighbours) {
      if (visited.has(nPk)) continue;
      const [nCompId, nPortId] = nPk.split('.');
      const nComp = compMap.get(nCompId);
      if (!nComp) continue;
      const nPort = nComp.ports.find(p => p.id === nPortId);
      if (!nPort?.enabled) continue;

      visited.set(nPk, sourceId);
      queue.push({ pk: nPk, sourceId });

      if (!(nCompId in result) && nComp.type !== 'utility-source' && nComp.type !== 'generator-source') {
        result[nCompId] = { energized: true, sourceId };
      }
    }
  }

  // Anything not reached is de-energized
  for (const comp of components) {
    if (!(comp.id in result)) {
      result[comp.id] = { energized: false, sourceId: null };
    }
  }

  return result;
}
