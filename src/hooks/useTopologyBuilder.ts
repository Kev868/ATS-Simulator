// ─── Topology builder state (useReducer-based) ────────────────────────────────
// Manages: component placement, wiring, selection, properties, undo/redo.

import { useReducer, useCallback } from 'react';
import {
  GraphTopology, GComponent, GWire, GPort,
  GCompType, GCompRole, GComponentProps, GBreakerState,
} from '../engine/graphTopology';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlacingType = GCompType | null;

export interface WireStart {
  compId: string;
  portId: string;
  wx: number; // world x in grid units
  wy: number;
}

export interface BuilderState {
  topo: GraphTopology;
  selectedId: string | null;
  placingType: PlacingType;
  wireStart: WireStart | null;
  ghostPos: { x: number; y: number } | null; // grid units, for placement ghost
  history: GraphTopology[];   // undo stack (before current)
  future:  GraphTopology[];   // redo stack
}

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_PLACING'; compType: PlacingType }
  | { type: 'SET_GHOST'; pos: { x: number; y: number } | null }
  | { type: 'PLACE_COMPONENT'; comp: GComponent }
  | { type: 'SELECT'; id: string | null }
  | { type: 'DELETE_SELECTED' }
  | { type: 'UPDATE_COMP_PROPS'; id: string; patch: Partial<GComponentProps> }
  | { type: 'UPDATE_COMP_TAG'; id: string; tag: string }
  | { type: 'UPDATE_COMP_ROLE'; id: string; role: GCompRole }
  | { type: 'TOGGLE_PORT'; compId: string; portId: string }
  | { type: 'ROTATE_COMP'; id: string }
  | { type: 'START_WIRE'; start: WireStart }
  | { type: 'FINISH_WIRE'; toCompId: string; toPortId: string; toWx: number; toWy: number }
  | { type: 'CANCEL_WIRE' }
  | { type: 'DELETE_WIRE'; wireId: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'LOAD_TOPO'; topo: GraphTopology }
  | { type: 'SET_CANVAS'; w: number; h: number };

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _seq = 0;
function uid(prefix: string): string { return `${prefix}-${Date.now()}-${++_seq}`; }

function pushHistory(s: BuilderState, current: GraphTopology): BuilderState {
  return { ...s, history: [...s.history.slice(-49), current], future: [] };
}

function defaultPorts(type: GCompType, portCount = 2): GPort[] {
  switch (type) {
    case 'SOURCE':
      return [{ id: 'out', label: 'Out', enabled: true, dx: 1, dy: 0, connectedWireIds: [] }];
    case 'BREAKER':
    case 'CONTACTOR':
      return [
        { id: 'left',  label: 'L', enabled: true, dx: -1, dy: 0, connectedWireIds: [] },
        { id: 'right', label: 'R', enabled: true, dx:  1, dy: 0, connectedWireIds: [] },
      ];
    case 'BUS':
      return [
        { id: 'left',  label: 'L',  enabled: true, dx: -2, dy: 0, connectedWireIds: [] },
        { id: 'right', label: 'R',  enabled: true, dx:  2, dy: 0, connectedWireIds: [] },
        { id: 'bot1',  label: 'B1', enabled: true, dx: -1, dy: 2, connectedWireIds: [] },
        { id: 'bot2',  label: 'B2', enabled: true, dx:  1, dy: 2, connectedWireIds: [] },
      ];
    case 'LOAD':
      return [{ id: 'top', label: 'In', enabled: true, dx: 0, dy: -1, connectedWireIds: [] }];
    case 'GROUND':
      return [{ id: 'top', label: 'In', enabled: true, dx: 0, dy: -1, connectedWireIds: [] }];
    case 'NPORT_SWITCH': {
      const ps: GPort[] = [];
      for (let i = 0; i < portCount; i++) {
        ps.push({ id: `p${i}`, label: `P${i}`, enabled: true, dx: i - Math.floor(portCount / 2), dy: (i === 0 ? -1 : 1), connectedWireIds: [] });
      }
      return ps;
    }
    default:
      return [];
  }
}

function defaultProps(type: GCompType): GComponentProps {
  switch (type) {
    case 'SOURCE':    return { sourceType: 'UTILITY', nominalVoltage: 13.8, nominalFrequency: 60, voltage: 100, frequency: 60, phaseAngle: 0, available: true };
    case 'BREAKER':   return { breakerState: 'OPEN', operationTimeMs: 50, lockedOut: false, elapsed: 0 };
    case 'CONTACTOR': return { breakerState: 'OPEN', operationTimeMs: 20, lockedOut: false, elapsed: 0 };
    case 'NPORT_SWITCH': return { portCount: 2, breakerState: 'OPEN' };
    case 'BUS':       return {};
    case 'LOAD':      return { loadKW: 500 };
    case 'GROUND':    return {};
    default:          return {};
  }
}

function defaultAnsi(type: GCompType): string {
  switch (type) {
    case 'SOURCE':    return '';
    case 'BREAKER':   return '52';
    case 'CONTACTOR': return '';
    case 'NPORT_SWITCH': return 'ATS';
    case 'BUS':       return '';
    case 'LOAD':      return '';
    case 'GROUND':    return '';
    default:          return '';
  }
}

function defaultTag(type: GCompType, idx: number): string {
  switch (type) {
    case 'SOURCE':    return `SRC-${idx}`;
    case 'BREAKER':   return `52-${idx}`;
    case 'CONTACTOR': return `K${idx}`;
    case 'NPORT_SWITCH': return `ATS-${idx}`;
    case 'BUS':       return `BUS-${idx}`;
    case 'LOAD':      return `LOAD-${idx}`;
    case 'GROUND':    return `GND-${idx}`;
    default:          return `COMP-${idx}`;
  }
}

/** Generate simple orthogonal wire segments between two grid points. */
function routeWire(x1: number, y1: number, x2: number, y2: number): GWire['segments'] {
  if (x1 === x2) return [{ x1, y1, x2, y2 }];
  if (y1 === y2) return [{ x1, y1, x2, y2 }];
  // Elbow: horizontal first, then vertical
  return [
    { x1, y1, x2, y2: y1 },
    { x1: x2, y1, x2, y2 },
  ];
}

/** Remove a wire ID from a port's connectedWireIds list. */
function removeWireFromPort(topo: GraphTopology, wireId: string): GraphTopology {
  return {
    ...topo,
    components: topo.components.map(c => ({
      ...c,
      ports: c.ports.map(p => ({
        ...p,
        connectedWireIds: p.connectedWireIds.filter(id => id !== wireId),
      })),
    })),
  };
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: BuilderState, action: Action): BuilderState {
  switch (action.type) {

    case 'SET_PLACING':
      return { ...state, placingType: action.compType, wireStart: null, selectedId: null };

    case 'SET_GHOST':
      return { ...state, ghostPos: action.pos };

    case 'PLACE_COMPONENT': {
      const saved = pushHistory(state, state.topo);
      return {
        ...saved,
        topo: { ...state.topo, components: [...state.topo.components, action.comp] },
        placingType: null,
        ghostPos: null,
        selectedId: action.comp.id,
      };
    }

    case 'SELECT':
      return { ...state, selectedId: action.id, placingType: null, wireStart: null };

    case 'DELETE_SELECTED': {
      if (!state.selectedId) return state;
      const id = state.selectedId;
      const saved = pushHistory(state, state.topo);
      // Remove wires connected to deleted component, then clean port refs
      const affectedWires = state.topo.wires.filter(
        w => w.fromCompId === id || w.toCompId === id
      );
      let topo = { ...state.topo };
      for (const w of affectedWires) {
        topo = removeWireFromPort(topo, w.id);
      }
      topo = {
        ...topo,
        components: topo.components.filter(c => c.id !== id),
        wires: topo.wires.filter(w => w.fromCompId !== id && w.toCompId !== id),
      };
      return { ...saved, topo, selectedId: null };
    }

    case 'UPDATE_COMP_PROPS': {
      const saved = pushHistory(state, state.topo);
      return {
        ...saved,
        topo: {
          ...state.topo,
          components: state.topo.components.map(c =>
            c.id === action.id ? { ...c, props: { ...c.props, ...action.patch } } : c
          ),
        },
      };
    }

    case 'UPDATE_COMP_TAG': {
      const saved = pushHistory(state, state.topo);
      return {
        ...saved,
        topo: {
          ...state.topo,
          components: state.topo.components.map(c =>
            c.id === action.id ? { ...c, tag: action.tag } : c
          ),
        },
      };
    }

    case 'UPDATE_COMP_ROLE': {
      const saved = pushHistory(state, state.topo);
      return {
        ...saved,
        topo: {
          ...state.topo,
          components: state.topo.components.map(c =>
            c.id === action.id ? { ...c, role: action.role } : c
          ),
        },
      };
    }

    case 'TOGGLE_PORT': {
      const saved = pushHistory(state, state.topo);
      return {
        ...saved,
        topo: {
          ...state.topo,
          components: state.topo.components.map(c =>
            c.id === action.compId
              ? {
                  ...c,
                  ports: c.ports.map(p =>
                    p.id === action.portId ? { ...p, enabled: !p.enabled } : p
                  ),
                }
              : c
          ),
        },
      };
    }

    case 'ROTATE_COMP': {
      const saved = pushHistory(state, state.topo);
      return {
        ...saved,
        topo: {
          ...state.topo,
          components: state.topo.components.map(c =>
            c.id === action.id ? { ...c, rotation: (c.rotation + 90) % 360 } : c
          ),
        },
      };
    }

    case 'START_WIRE':
      return { ...state, wireStart: action.start, selectedId: null };

    case 'FINISH_WIRE': {
      const { wireStart } = state;
      if (!wireStart) return state;
      if (
        wireStart.compId === action.toCompId &&
        wireStart.portId === action.toPortId
      ) {
        return { ...state, wireStart: null };
      }
      // Prevent duplicate wires
      const dup = state.topo.wires.some(
        w =>
          (w.fromCompId === wireStart.compId && w.fromPortId === wireStart.portId &&
           w.toCompId === action.toCompId && w.toPortId === action.toPortId) ||
          (w.toCompId === wireStart.compId && w.toPortId === wireStart.portId &&
           w.fromCompId === action.toCompId && w.fromPortId === action.toPortId)
      );
      if (dup) return { ...state, wireStart: null };

      const wireId = uid('wire');
      const segments = routeWire(wireStart.wx, wireStart.wy, action.toWx, action.toWy);
      const newWire: GWire = {
        id: wireId,
        fromCompId: wireStart.compId,
        fromPortId: wireStart.portId,
        toCompId:   action.toCompId,
        toPortId:   action.toPortId,
        segments,
      };
      const saved = pushHistory(state, state.topo);
      const topo = {
        ...state.topo,
        wires: [...state.topo.wires, newWire],
        components: state.topo.components.map(c => {
          if (c.id === wireStart.compId) {
            return { ...c, ports: c.ports.map(p => p.id === wireStart.portId ? { ...p, connectedWireIds: [...p.connectedWireIds, wireId] } : p) };
          }
          if (c.id === action.toCompId) {
            return { ...c, ports: c.ports.map(p => p.id === action.toPortId ? { ...p, connectedWireIds: [...p.connectedWireIds, wireId] } : p) };
          }
          return c;
        }),
      };
      return { ...saved, topo, wireStart: null };
    }

    case 'CANCEL_WIRE':
      return { ...state, wireStart: null };

    case 'DELETE_WIRE': {
      const saved = pushHistory(state, state.topo);
      let topo = removeWireFromPort(state.topo, action.wireId);
      topo = { ...topo, wires: topo.wires.filter(w => w.id !== action.wireId) };
      return { ...saved, topo, selectedId: null };
    }

    case 'UNDO': {
      if (state.history.length === 0) return state;
      const prev = state.history[state.history.length - 1];
      return {
        ...state,
        topo: prev,
        history: state.history.slice(0, -1),
        future:  [state.topo, ...state.future.slice(0, 49)],
        selectedId: null,
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        ...state,
        topo: next,
        history: [...state.history.slice(-49), state.topo],
        future:  state.future.slice(1),
        selectedId: null,
      };
    }

    case 'LOAD_TOPO':
      return { ...state, topo: action.topo, selectedId: null, history: [], future: [], wireStart: null, placingType: null };

    case 'SET_CANVAS':
      return { ...state, topo: { ...state.topo, canvasW: action.w, canvasH: action.h } };

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function makeEmptyTopo(): GraphTopology {
  return {
    id: uid('topo'),
    name: 'Custom Topology',
    gridPx: 20,
    canvasW: 60,
    canvasH: 40,
    components: [],
    wires: [],
  };
}

export function useTopologyBuilder() {
  const [state, dispatch] = useReducer(reducer, {
    topo: makeEmptyTopo(),
    selectedId: null,
    placingType: null,
    wireStart: null,
    ghostPos: null,
    history: [],
    future: [],
  });

  // ── Component count (used for default tags)
  const compCount = state.topo.components.length;

  const startPlacing = useCallback((type: GCompType) => {
    dispatch({ type: 'SET_PLACING', compType: type });
  }, []);

  const setGhost = useCallback((pos: { x: number; y: number } | null) => {
    dispatch({ type: 'SET_GHOST', pos });
  }, []);

  const placeComponent = useCallback((x: number, y: number, compType: GCompType) => {
    const idx = compCount + 1;
    const portCount = compType === 'NPORT_SWITCH' ? 2 : 2;
    const comp: GComponent = {
      id:         uid(compType.toLowerCase()),
      type:       compType,
      role:       'NONE',
      tag:        defaultTag(compType, idx),
      ansiNumber: defaultAnsi(compType),
      x, y,
      rotation:   0,
      ports:      defaultPorts(compType, portCount),
      props:      defaultProps(compType),
    };
    dispatch({ type: 'PLACE_COMPONENT', comp });
  }, [compCount]);

  const select = useCallback((id: string | null) => dispatch({ type: 'SELECT', id }), []);

  const deleteSelected = useCallback(() => dispatch({ type: 'DELETE_SELECTED' }), []);

  const updateProps = useCallback((id: string, patch: Partial<GComponentProps>) => {
    dispatch({ type: 'UPDATE_COMP_PROPS', id, patch });
  }, []);

  const updateTag = useCallback((id: string, tag: string) => {
    dispatch({ type: 'UPDATE_COMP_TAG', id, tag });
  }, []);

  const updateRole = useCallback((id: string, role: GCompRole) => {
    dispatch({ type: 'UPDATE_COMP_ROLE', id, role });
  }, []);

  const togglePort = useCallback((compId: string, portId: string) => {
    dispatch({ type: 'TOGGLE_PORT', compId, portId });
  }, []);

  const rotateComp = useCallback((id: string) => dispatch({ type: 'ROTATE_COMP', id }), []);

  const startWire = useCallback((start: WireStart) => dispatch({ type: 'START_WIRE', start }), []);

  const finishWire = useCallback((toCompId: string, toPortId: string, toWx: number, toWy: number) => {
    dispatch({ type: 'FINISH_WIRE', toCompId, toPortId, toWx, toWy });
  }, []);

  const cancelWire = useCallback(() => dispatch({ type: 'CANCEL_WIRE' }), []);

  const deleteWire = useCallback((wireId: string) => dispatch({ type: 'DELETE_WIRE', wireId }), []);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  const loadTopo = useCallback((topo: GraphTopology) => dispatch({ type: 'LOAD_TOPO', topo }), []);

  const saveJSON = useCallback((): string => {
    return JSON.stringify(state.topo, null, 2);
  }, [state.topo]);

  const loadJSON = useCallback((json: string): boolean => {
    try {
      const topo = JSON.parse(json) as GraphTopology;
      dispatch({ type: 'LOAD_TOPO', topo });
      return true;
    } catch {
      return false;
    }
  }, []);

  const selectedComp = state.selectedId
    ? state.topo.components.find(c => c.id === state.selectedId) ?? null
    : null;

  const selectedWire = state.selectedId
    ? state.topo.wires.find(w => w.id === state.selectedId) ?? null
    : null;

  return {
    state,
    selectedComp,
    selectedWire,
    dispatch,
    actions: {
      startPlacing, setGhost, placeComponent,
      select, deleteSelected,
      updateProps, updateTag, updateRole,
      togglePort, rotateComp,
      startWire, finishWire, cancelWire, deleteWire,
      undo, redo,
      loadTopo, saveJSON, loadJSON,
    },
  };
}
