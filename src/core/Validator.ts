import type { CircuitModel, ValidationReport, ValidationIssue } from './types';
import { COMPONENT_REGISTRY } from './ComponentRegistry';

export function validateCircuit(model: CircuitModel): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const addError = (code: string, message: string, componentId?: string, wireId?: string) =>
    errors.push({ severity: "error", code, message, componentId, wireId });
  const addWarning = (code: string, message: string, componentId?: string, wireId?: string) =>
    warnings.push({ severity: "warning", code, message, componentId, wireId });

  const componentIds = new Set<string>();
  const wireIds = new Set<string>();

  // Duplicate component IDs
  for (const comp of model.components) {
    if (componentIds.has(comp.id)) {
      addError("DUPLICATE_COMPONENT_ID", `Duplicate component ID: ${comp.id}`, comp.id);
    }
    componentIds.add(comp.id);
  }

  // Duplicate wire IDs
  for (const wire of model.wires) {
    if (wireIds.has(wire.id)) {
      addError("DUPLICATE_WIRE_ID", `Duplicate wire ID: ${wire.id}`, undefined, wire.id);
    }
    wireIds.add(wire.id);
  }

  // Build port index: componentId -> portId -> PortDefinition
  const portIndex = new Map<string, Map<string, boolean>>();
  for (const comp of model.components) {
    const portMap = new Map<string, boolean>();
    for (const port of comp.ports) {
      portMap.set(port.id, port.enabled);
    }
    portIndex.set(comp.id, portMap);
  }

  // Track which ports have wires (for the "no wire" warnings)
  const wiredPorts = new Map<string, Set<string>>();
  for (const comp of model.components) {
    wiredPorts.set(comp.id, new Set());
  }

  // Validate each wire
  const portWireCount = new Map<string, number>(); // "componentId:portId" -> count
  for (const wire of model.wires) {
    // From component/port exists
    if (!componentIds.has(wire.fromComponentId)) {
      addError("WIRE_MISSING_FROM_COMPONENT", `Wire ${wire.id}: fromComponentId '${wire.fromComponentId}' does not exist`, undefined, wire.id);
      continue;
    }
    const fromPorts = portIndex.get(wire.fromComponentId)!;
    if (!fromPorts.has(wire.fromPortId)) {
      addError("WIRE_MISSING_FROM_PORT", `Wire ${wire.id}: fromPortId '${wire.fromPortId}' does not exist on component '${wire.fromComponentId}'`, wire.fromComponentId, wire.id);
    } else if (!fromPorts.get(wire.fromPortId)) {
      addError("WIRE_DISABLED_FROM_PORT", `Wire ${wire.id}: fromPortId '${wire.fromPortId}' is disabled on component '${wire.fromComponentId}'`, wire.fromComponentId, wire.id);
    }

    // To component/port exists
    if (!componentIds.has(wire.toComponentId)) {
      addError("WIRE_MISSING_TO_COMPONENT", `Wire ${wire.id}: toComponentId '${wire.toComponentId}' does not exist`, undefined, wire.id);
      continue;
    }
    const toPorts = portIndex.get(wire.toComponentId)!;
    if (!toPorts.has(wire.toPortId)) {
      addError("WIRE_MISSING_TO_PORT", `Wire ${wire.id}: toPortId '${wire.toPortId}' does not exist on component '${wire.toComponentId}'`, wire.toComponentId, wire.id);
    } else if (!toPorts.get(wire.toPortId)) {
      addError("WIRE_DISABLED_TO_PORT", `Wire ${wire.id}: toPortId '${wire.toPortId}' is disabled on component '${wire.toComponentId}'`, wire.toComponentId, wire.id);
    }

    // Port can only have one wire
    const fromKey = `${wire.fromComponentId}:${wire.fromPortId}`;
    const toKey = `${wire.toComponentId}:${wire.toPortId}`;
    portWireCount.set(fromKey, (portWireCount.get(fromKey) ?? 0) + 1);
    portWireCount.set(toKey, (portWireCount.get(toKey) ?? 0) + 1);

    // Track wired ports
    wiredPorts.get(wire.fromComponentId)?.add(wire.fromPortId);
    wiredPorts.get(wire.toComponentId)?.add(wire.toPortId);
  }

  for (const [key, count] of portWireCount) {
    if (count > 1) {
      addError("PORT_MULTI_WIRE", `Port '${key}' has ${count} wires connected — only 1 allowed`, key.split(':')[0]);
    }
  }

  // At least one source
  const sources = model.components.filter((c) => COMPONENT_REGISTRY[c.type].isSource);
  if (sources.length === 0) {
    addError("NO_SOURCE", "Circuit has no source components");
  }

  // Warning: no loads
  const loads = model.components.filter((c) => COMPONENT_REGISTRY[c.type].isTerminal);
  if (loads.length === 0) {
    addWarning("NO_LOAD", "Circuit has no load components");
  }

  // Warning: ports with no wire
  for (const comp of model.components) {
    const wired = wiredPorts.get(comp.id) ?? new Set();
    for (const port of comp.ports) {
      if (!port.enabled) continue;
      if (!wired.has(port.id)) {
        addWarning("UNWIRED_PORT", `Component '${comp.tag}' port '${port.id}' has no wire`, comp.id);
      }
    }
  }

  // Warning: isolated components (no ports wired at all)
  for (const comp of model.components) {
    const wired = wiredPorts.get(comp.id) ?? new Set();
    if (wired.size === 0) {
      addWarning("ISOLATED_COMPONENT", `Component '${comp.tag}' (${comp.id}) has no wired ports`, comp.id);
    }
  }

  // Error: direct source-to-source connection without breaker
  // We check: is there any wire connecting two source output ports directly?
  const sourceOutputPorts = new Set<string>();
  for (const comp of model.components) {
    const def = COMPONENT_REGISTRY[comp.type];
    if (def.isSource) {
      for (const port of comp.ports) {
        if (port.enabled) sourceOutputPorts.add(`${comp.id}:${port.id}`);
      }
    }
  }
  for (const wire of model.wires) {
    const fromKey = `${wire.fromComponentId}:${wire.fromPortId}`;
    const toKey = `${wire.toComponentId}:${wire.toPortId}`;
    if (sourceOutputPorts.has(fromKey) && sourceOutputPorts.has(toKey)) {
      addError("SOURCE_SHORT", `Wire ${wire.id} directly connects two source ports — electrical short circuit`, undefined, wire.id);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
