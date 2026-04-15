// ─── BFS connectivity sweep ───────────────────────────────────────────────────
// Determines which components are energized each simulation tick.
//
// Model:
//   A component can be "entered" via any of its enabled, wired ports.
//   Once entered, energy propagates to OTHER ports on the same component
//   according to the component's internal-connectivity rule (below).
//   Energy then follows wires out of those ports to neighbouring components.
//
// Internal-connectivity rules:
//   SOURCE  – always conducts from itself outward through all enabled ports
//   BUS     – all enabled ports are mutually connected (broadcast node)
//   BREAKER / CONTACTOR – conducts between ports only when state === 'CLOSED'
//   NPORT_SWITCH – all enabled ports connected (simplified: switch engaged)
//   LOAD    – terminal; does not conduct through
//   GROUND  – terminal; does not conduct through

import {
  GComponent,
  GWire,
  GraphTopology,
  GEnergization,
  GBreakerState,
} from './graphTopology';

// portKey = "<compId>.<portId>"
function portKey(compId: string, portId: string): string {
  return `${compId}.${portId}`;
}

/** Build a wire adjacency map: portKey → list of portKeys reachable via wires. */
function buildWireAdj(wires: GWire[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  };
  for (const w of wires) {
    add(portKey(w.fromCompId, w.fromPortId), portKey(w.toCompId, w.toPortId));
  }
  return adj;
}

/**
 * Given that we have entered `comp` through port `entryPortId`,
 * return the IDs of other ports on the same component that energy can exit through.
 */
function internalPeers(comp: GComponent, entryPortId: string): string[] {
  const others = comp.ports.filter(p => p.enabled && p.id !== entryPortId).map(p => p.id);

  switch (comp.type) {
    case 'SOURCE':
      // Energy flows out of the source unconditionally
      return others;

    case 'BUS':
      // Bus is fully connected internally
      return others;

    case 'BREAKER':
    case 'CONTACTOR': {
      const st: GBreakerState = comp.props.breakerState ?? 'OPEN';
      return st === 'CLOSED' ? others : [];
    }

    case 'NPORT_SWITCH':
      // Simplified: all enabled ports connected when switch has a live source path.
      // The BFS itself handles which sources are reachable.
      return others;

    case 'LOAD':
    case 'GROUND':
      // Terminal — no internal pass-through
      return [];

    default:
      return [];
  }
}

/**
 * Run a BFS from every live source and return the energization status of
 * every component in the topology.
 *
 * @param components  The current component list (with up-to-date props).
 * @param wires       The wire list (topology does not change per tick).
 * @returns Map from component ID → GEnergization.
 */
export function computeEnergization(
  components: GComponent[],
  wires: GWire[]
): Map<string, GEnergization> {
  const result  = new Map<string, GEnergization>();
  const compMap = new Map<string, GComponent>(components.map(c => [c.id, c]));
  const wireAdj = buildWireAdj(wires);

  // portKey → sourceId of the source that energized it
  const visited = new Map<string, string>();

  // Seed BFS from all live sources
  interface QItem { pk: string; sourceId: string; voltage: number }
  const queue: QItem[] = [];

  for (const comp of components) {
    if (comp.type !== 'SOURCE') continue;

    const available = comp.props.available ?? true;
    const voltage   = comp.props.voltage ?? 100;
    const alive     = available && voltage > 0;

    if (alive) {
      result.set(comp.id, { energized: true, sourceId: comp.id, voltage });
      for (const port of comp.ports) {
        if (!port.enabled) continue;
        const pk = portKey(comp.id, port.id);
        visited.set(pk, comp.id);
        queue.push({ pk, sourceId: comp.id, voltage });
      }
    } else {
      result.set(comp.id, { energized: false, sourceId: null, voltage: 0 });
    }
  }

  // BFS
  while (queue.length > 0) {
    const { pk, sourceId, voltage } = queue.shift()!;
    const [compId, portId] = pk.split('.');
    const comp = compMap.get(compId);
    if (!comp) continue;

    // Propagate internally to peer ports on the same component
    const peers = internalPeers(comp, portId);
    for (const peerId of peers) {
      const peerPk = portKey(compId, peerId);
      if (!visited.has(peerPk)) {
        visited.set(peerPk, sourceId);
        queue.push({ pk: peerPk, sourceId, voltage });
      }
    }

    // Mark the component as energized (buses, loads, grounds, etc.)
    if (!result.has(compId) && comp.type !== 'SOURCE') {
      result.set(compId, { energized: true, sourceId, voltage });
    }

    // Follow wires out of this port to neighbour component ports
    const neighbours = wireAdj.get(pk) ?? [];
    for (const nPk of neighbours) {
      if (visited.has(nPk)) continue;
      const [nCompId, nPortId] = nPk.split('.');
      const nComp = compMap.get(nCompId);
      if (!nComp) continue;
      const nPort = nComp.ports.find(p => p.id === nPortId);
      if (!nPort?.enabled) continue;

      visited.set(nPk, sourceId);
      queue.push({ pk: nPk, sourceId, voltage });

      // Mark the neighbour component
      if (!result.has(nCompId) && nComp.type !== 'SOURCE') {
        result.set(nCompId, { energized: true, sourceId, voltage });
      }
    }
  }

  // Any component not reached is de-energized
  for (const comp of components) {
    if (!result.has(comp.id)) {
      result.set(comp.id, { energized: false, sourceId: null, voltage: 0 });
    }
  }

  return result;
}

/**
 * Convenience wrapper that operates on a GraphTopology.
 */
export function sweepTopology(topo: GraphTopology): Map<string, GEnergization> {
  return computeEnergization(topo.components, topo.wires);
}

/**
 * Check whether a path exists between two component IDs in the graph,
 * respecting breaker states.  Used by the validator.
 */
export function pathExists(
  components: GComponent[],
  wires: GWire[],
  fromId: string,
  toId: string
): boolean {
  const energ = computeEnergization(components, wires);
  const fromSrc = energ.get(fromId)?.sourceId;
  const toSrc   = energ.get(toId)?.sourceId;
  // Both share a source → connected
  if (fromSrc && fromSrc === toSrc) return true;
  // More precise: BFS from fromId regardless of source status
  const compMap = new Map<string, GComponent>(components.map(c => [c.id, c]));
  const wireAdj = buildWireAdj(wires);
  const visited = new Set<string>();
  const q: string[] = [];

  const seed = components.find(c => c.id === fromId);
  if (!seed) return false;
  for (const p of seed.ports) {
    if (!p.enabled) continue;
    const pk = portKey(fromId, p.id);
    visited.add(pk);
    q.push(pk);
  }

  while (q.length > 0) {
    const pk = q.shift()!;
    const [compId, portId] = pk.split('.');
    if (compId === toId) return true;
    const comp = compMap.get(compId);
    if (!comp) continue;
    for (const peerId of internalPeers(comp, portId)) {
      const peerPk = portKey(compId, peerId);
      if (!visited.has(peerPk)) { visited.add(peerPk); q.push(peerPk); }
    }
    for (const nPk of wireAdj.get(pk) ?? []) {
      if (visited.has(nPk)) continue;
      const [nCompId, nPortId] = nPk.split('.');
      const nComp = compMap.get(nCompId);
      if (!nComp) continue;
      const nPort = nComp.ports.find(p => p.id === nPortId);
      if (!nPort?.enabled) continue;
      visited.add(nPk);
      q.push(nPk);
      if (nCompId === toId) return true;
    }
  }
  return false;
}
