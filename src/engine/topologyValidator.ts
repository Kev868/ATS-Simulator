// ─── Topology validation ──────────────────────────────────────────────────────
// Runs a graph-level check before simulation starts on a custom topology.
// Returns a list of human-readable error strings; empty array = valid.

import { GraphTopology, GComponent, GCompRole, findCompsByRole, findCompsByType, pathExists } from './graphTopology';
import { sweepTopology } from './connectivity';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasRole(topo: GraphTopology, role: GCompRole): boolean {
  return topo.components.some(c => c.role === role);
}

function floatingPorts(topo: GraphTopology): string[] {
  const msgs: string[] = [];
  for (const comp of topo.components) {
    for (const port of comp.ports) {
      if (!port.enabled) continue;
      const wired = topo.wires.some(
        w => (w.fromCompId === comp.id && w.fromPortId === port.id) ||
             (w.toCompId   === comp.id && w.toPortId   === port.id)
      );
      if (!wired) {
        msgs.push(
          `${comp.tag} — port "${port.label}" is enabled but not wired`
        );
      }
    }
  }
  return msgs;
}

function unreachableLoads(topo: GraphTopology): string[] {
  // Open all breakers temporarily to find loads that can never be reached
  // even with all breakers closed.
  const allClosed: GraphTopology = {
    ...topo,
    components: topo.components.map(c =>
      c.type === 'BREAKER' || c.type === 'CONTACTOR'
        ? { ...c, props: { ...c.props, breakerState: 'CLOSED' as const } }
        : c
    ),
  };

  const energ = sweepTopology(allClosed);
  const msgs: string[] = [];

  for (const comp of topo.components) {
    if (comp.type !== 'LOAD') continue;
    const e = energ.get(comp.id);
    if (!e?.energized) {
      msgs.push(`Load "${comp.tag}" has no traceable path to any source (even with all breakers closed)`);
    }
  }
  return msgs;
}

function isolatedBuses(topo: GraphTopology): string[] {
  const allClosed: GraphTopology = {
    ...topo,
    components: topo.components.map(c =>
      c.type === 'BREAKER' || c.type === 'CONTACTOR'
        ? { ...c, props: { ...c.props, breakerState: 'CLOSED' as const } }
        : c
    ),
  };
  const energ = sweepTopology(allClosed);
  const msgs: string[] = [];
  for (const comp of topo.components) {
    if (comp.type !== 'BUS') continue;
    if (!energ.get(comp.id)?.energized) {
      msgs.push(`Bus "${comp.tag}" is not reachable from any source`);
    }
  }
  return msgs;
}

// ─── Main validator ───────────────────────────────────────────────────────────

export function validateTopology(topo: GraphTopology): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  // 1. Must have at least one source
  const sources = findCompsByType(topo, 'SOURCE');
  if (sources.length === 0) {
    errors.push('Topology has no source components — add at least one utility or generator source');
  }

  // 2. Exactly one preferred source
  const preferredSources = findCompsByRole(topo, 'PREFERRED_SOURCE');
  if (preferredSources.length === 0) {
    errors.push('No source is designated as "Preferred" — assign the PREFERRED_SOURCE role to one source');
  } else if (preferredSources.length > 1) {
    errors.push(`Multiple sources designated as Preferred (${preferredSources.map(s => s.tag).join(', ')}) — only one is allowed`);
  }

  // 3. Must have at least one load
  const loads = findCompsByType(topo, 'LOAD');
  if (loads.length === 0) {
    warnings.push('No load components — simulation will run but there is nothing to power');
  }

  // 4. Floating ports
  const fp = floatingPorts(topo);
  errors.push(...fp);

  // 5. Unreachable loads
  const ul = unreachableLoads(topo);
  errors.push(...ul);

  // 6. Isolated buses
  const ib = isolatedBuses(topo);
  errors.push(...ib);

  // 7. Components with unassigned roles (warning only)
  const unassigned = topo.components.filter(
    c => c.role === 'NONE' && c.type !== 'GROUND'
  );
  for (const c of unassigned) {
    warnings.push(`"${c.tag}" has no role assigned — it will not participate in automatic transfer logic`);
  }

  // 8. MTM / TWO_SOURCE role-consistency hints
  const tieBrks = findCompsByRole(topo, 'TIE_BREAKER');
  const altSrcs  = findCompsByRole(topo, 'ALTERNATE_SOURCE');
  if (tieBrks.length === 1 && altSrcs.length === 0) {
    warnings.push('A tie breaker is present but no alternate source is assigned — MTM auto-transfer requires an ALTERNATE_SOURCE');
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Verify that the connectivity sweep correctly reports isolated buses
 * when a specific breaker is opened.  Returns a human-readable summary.
 * (Used by tests to confirm the sweep behaves correctly.)
 */
export function checkIsolationOnOpen(
  topo: GraphTopology,
  breakerCompId: string
): { busesLost: string[]; busesRetained: string[] } {
  const modified: GraphTopology = {
    ...topo,
    components: topo.components.map(c =>
      c.id === breakerCompId
        ? { ...c, props: { ...c.props, breakerState: 'OPEN' as const } }
        : c
    ),
  };
  const energ = sweepTopology(modified);
  const busesLost:     string[] = [];
  const busesRetained: string[] = [];

  for (const comp of topo.components) {
    if (comp.type !== 'BUS') continue;
    const e = energ.get(comp.id);
    if (e?.energized) {
      busesRetained.push(comp.tag);
    } else {
      busesLost.push(comp.tag);
    }
  }
  return { busesLost, busesRetained };
}
