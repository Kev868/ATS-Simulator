import type { ComponentType, PortDefinition, ComponentProperties, ComponentRuntimeState } from './types';

export interface ComponentDefinition {
  type: ComponentType;
  label: string;
  category: "source" | "switchgear" | "distribution" | "load" | "reference" | "routing";
  description: string;
  defaultPorts: PortDefinition[];
  symbolWidth: number;
  symbolHeight: number;
  conductsWhen: (state: ComponentRuntimeState) => boolean;
  isSource: boolean;
  isTerminal: boolean;
  isSwitchgear: boolean;
  defaultProperties: ComponentProperties;
  defaultState: ComponentRuntimeState;
}

const defaultState: ComponentRuntimeState = {
  closed: true,
  energized: false,
  failed: false,
  tripped: false,
  locked: false,
  voltagePercent: 0,
  frequencyHz: 0,
  phaseAngleDeg: 0,
};

export const COMPONENT_REGISTRY: Record<ComponentType, ComponentDefinition> = {
  "utility-source": {
    type: "utility-source",
    label: "Utility Source",
    category: "source",
    description: "Infinite bus utility power feed",
    defaultPorts: [
      { id: "output", label: "Output", relativeX: 2.5, relativeY: 0, enabled: true, direction: "out" },
    ],
    symbolWidth: 3,
    symbolHeight: 3,
    conductsWhen: (s) => !s.failed,
    isSource: true,
    isTerminal: false,
    isSwitchgear: false,
    defaultProperties: { nominalVoltage: 480, nominalFrequency: 60 },
    defaultState: { ...defaultState, closed: true, voltagePercent: 100, frequencyHz: 60 },
  },

  "generator-source": {
    type: "generator-source",
    label: "Generator Source",
    category: "source",
    description: "Standby or prime generator",
    defaultPorts: [
      { id: "output", label: "Output", relativeX: 2.5, relativeY: 0, enabled: true, direction: "out" },
    ],
    symbolWidth: 3,
    symbolHeight: 3,
    conductsWhen: (s) => !s.failed && s.closed,
    isSource: true,
    isTerminal: false,
    isSwitchgear: false,
    defaultProperties: { nominalVoltage: 480, nominalFrequency: 60, startupTime: 10000, rampRate: 10 },
    defaultState: { ...defaultState, closed: false, voltagePercent: 0, frequencyHz: 0 },
  },

  "circuit-breaker": {
    type: "circuit-breaker",
    label: "Circuit Breaker",
    category: "switchgear",
    description: "Drawout circuit breaker (ANSI 52)",
    defaultPorts: [
      { id: "line", label: "Line Side", relativeX: -1.5, relativeY: 0, enabled: true, direction: "bidirectional" },
      { id: "load", label: "Load Side", relativeX: 1.5, relativeY: 0, enabled: true, direction: "bidirectional" },
    ],
    symbolWidth: 2,
    symbolHeight: 2,
    conductsWhen: (s) => s.closed && !s.tripped && !s.locked,
    isSource: false,
    isTerminal: false,
    isSwitchgear: true,
    defaultProperties: {},
    defaultState: { ...defaultState, closed: true },
  },

  "bus-segment": {
    type: "bus-segment",
    label: "Bus Segment",
    category: "distribution",
    description: "Bus bar section",
    defaultPorts: [
      { id: "left", label: "Left", relativeX: -3, relativeY: 0, enabled: true, direction: "bidirectional" },
      { id: "right", label: "Right", relativeX: 3, relativeY: 0, enabled: true, direction: "bidirectional" },
      { id: "tap1", label: "Tap 1", relativeX: -1, relativeY: 1.5, enabled: true, direction: "bidirectional" },
      { id: "tap2", label: "Tap 2", relativeX: 1, relativeY: 1.5, enabled: true, direction: "bidirectional" },
    ],
    symbolWidth: 6,
    symbolHeight: 1,
    conductsWhen: () => true,
    isSource: false,
    isTerminal: false,
    isSwitchgear: false,
    defaultProperties: { busLength: 6 },
    defaultState: { ...defaultState, closed: true },
  },

  "load": {
    type: "load",
    label: "Load",
    category: "load",
    description: "Aggregate load block",
    defaultPorts: [
      { id: "supply", label: "Supply", relativeX: 0, relativeY: -1.5, enabled: true, direction: "in" },
    ],
    symbolWidth: 3,
    symbolHeight: 2,
    conductsWhen: () => true,
    isSource: false,
    isTerminal: true,
    isSwitchgear: false,
    defaultProperties: { loadKW: 500 },
    defaultState: { ...defaultState, closed: true },
  },

  "ground": {
    type: "ground",
    label: "Ground",
    category: "reference",
    description: "Ground reference",
    defaultPorts: [
      { id: "terminal", label: "Terminal", relativeX: 0, relativeY: -1, enabled: true, direction: "in" },
    ],
    symbolWidth: 2,
    symbolHeight: 2,
    conductsWhen: () => true,
    isSource: false,
    isTerminal: true,
    isSwitchgear: false,
    defaultProperties: {},
    defaultState: { ...defaultState, closed: true },
  },

  "junction": {
    type: "junction",
    label: "Junction",
    category: "routing",
    description: "Wire routing node (invisible)",
    defaultPorts: [
      { id: "a", label: "A", relativeX: 0, relativeY: 0, enabled: true, direction: "bidirectional" },
      { id: "b", label: "B", relativeX: 0, relativeY: 0, enabled: true, direction: "bidirectional" },
      { id: "c", label: "C", relativeX: 0, relativeY: 0, enabled: true, direction: "bidirectional" },
      { id: "d", label: "D", relativeX: 0, relativeY: 0, enabled: true, direction: "bidirectional" },
    ],
    symbolWidth: 0,
    symbolHeight: 0,
    conductsWhen: () => true,
    isSource: false,
    isTerminal: false,
    isSwitchgear: false,
    defaultProperties: {},
    defaultState: { ...defaultState, closed: true },
  },
};

export function createComponent(
  type: ComponentType,
  id: string,
  tag: string,
  x: number,
  y: number,
): import('./types').CircuitComponent {
  const def = COMPONENT_REGISTRY[type];
  return {
    id,
    type,
    tag,
    x,
    y,
    rotation: 0,
    ports: def.defaultPorts.map((p) => ({ ...p })),
    properties: { ...def.defaultProperties },
    state: { ...def.defaultState },
  };
}
