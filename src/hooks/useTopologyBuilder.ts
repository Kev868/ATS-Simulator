// ─── Topology builder state (useReducer-based) ────────────────────────────────
// Manages: component placement, wiring, selection, undo/redo, move, rotation.

import { useReducer, useCallback } from 'react';
import {
  GraphTopology, GComponent, GWire, GPort,
  GCompType, GCompRole, GComponentProps,
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
  selectedId: string | null;       // primary selection (wire OR comp)
  selectedIds: string[];           // all selected component IDs (for multi-select)
  placingType: PlacingType;
  ghostRotation: number;           // 0 | 90 | 180 | 270 — ghost rotation before placement
  wireStart: WireStart | null;
  ghostPos: { x: number; y: number } | null;
  history: GraphTopology[];
  future:  GraphTopology[];
}

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_PLACING'; compType: PlacingType }
  | { type: 'SET_GHOST'; pos: { x: number; y: number } | null }
  | { type: 'PLACE_COMPONENT'; comp: GComponent }
  | { type: 'SELECT'; id: string | null }
  | { type: 'SELECT_TOGGLE'; id: string }
  | { type: 'SELECT_BOX'; ids: string[] }
  | { type: 'DELETE_SELECTED' }
  | { type: 'UPDATE_COMP_PROPS'; id: string; patch: Partial<GComponentProps> }
  | { type: 'UPDATE_COMP_TAG'; id: string; tag: string }
  | { type: 'UPDATE_COMP_ROLE'; id: string; role: GCompRole }
  | { type: 'TOGGLE_PORT'; compId: string; portId: string }
  | { type: 'ROTATE_COMP'; id: string; clockwise?: boolean }
  | { type: 'ROTATE_GHOST'; clockwise?: boolean }
  | { type: 'MOVE_COMP'; id: string; x: number; y: number }
  | { type: 'MOVE_MULTI'; moves: Array<{ id: string; x: number; y: number }> }
  | { type: 'START_WIRE'; start: WireStart }
  | { type: 'FINISH_WIRE'; toCompId: string; toPortId: string; toWx: number; toWy: number }
  | { type: 'CANCEL_WIRE' }
  | { type: 'DELETE_WIRE'; wireId: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'LOAD_TOPO'; topo: GraphTopology }
  | { type: 'SET_CANVAS'; w: number; h: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _seq = 0;
function uid(prefix: string): string { return `${prefix}-${Date.now()}-${++_seq}`; }

function pushHistory(s: BuilderState, current: GraphTopology): BuilderState {
  return { ...s, history: [...s.history.slice(-49), current], future: [] };
}

/** Rotate a port dx/dy vector 90° CW or CCW in screen space (y-down).
 *  CW:  (dx, dy) → (-dy,  dx)   e.g. (1,0)→(0,1) [right→down]
 *  CCW: (dx, dy) → ( dy, -dx)   e.g. (1,0)→(0,-1)[right→up]
 */
function rotateVec(dx: number, dy: number, clockwise: boolean): { dx: number; dy: number } {
  if (clockwise) return { dx: -dy, dy: dx };
  return { dx: dy, dy: -dx };
}

function rotatePorts(ports: GPort[], clockwise: boolean): GPort[] {
  return ports.map(p => {
    const { dx, dy } = rotateVec(p.dx, p.dy, clockwise);
    return { ...p, dx, dy };
  });
}

/** Re-route all wires that touch the given component ID, using updated comps. */
function rerouteWiresForComp(wires: GWire[], comps: GComponent[], compId: string): GWire[] {
  return wires.map(w => {
    if (w.fromCompId !== compId && w.toCompId !== compId) return w;
    const fc = comps.find(c => c.id === w.fromCompId);
    const tc = comps.find(c => c.id === w.toCompId);
    if (!fc || !tc) return w;
    const fp = fc.ports.find(p => p.id === w.fromPortId);
    const tp = tc.ports.find(p => p.id === w.toPortId);
    if (!fp || !tp) return w;
    return { ...w, segments: routeWire(fc.x + fp.dx, fc.y + fp.dy, tc.x + tp.dx, tc.y + tp.dy) };
  });
}

/** Re-route all wires that touch any of the given component IDs. */
function rerouteWiresForComps(wires: GWire[], comps: GComponent[], compIds: string[]): GWire[] {
  const affected = new Set(compIds);
  return wires.map(w => {
    if (!affected.has(w.fromCompId) && !affected.has(w.toCompId)) return w;
    const fc = comps.find(c => c.id === w.fromCompId);
    const tc = comps.find(c => c.id === w.toCompId);
    if (!fc || !tc) return w;
    const fp = fc.ports.find(p => p.id === w.fromPortId);
    const tp = tc.ports.find(p => p.id === w.toPortId);
    if (!fp || !tp) return w;
    return { ...w, segments: routeWire(fc.x + fp.dx, fc.y + fp.dy, tc.x + tp.dx, tc.y + tp.dy) };
  });
}

/** Generate orthogonal wire segments (horizontal-first elbow). */
export function routeWire(x1: number, y1: number, x2: number, y2: number): GWire['segments'] {
  if (x1 === x2) return [{ x1, y1, x2, y2 }];
  if (y1 === y2) return [{ x1, y1, x2, y2 }];
  return [
    { x1, y1, x2, y2: y1 },
    { x1: x2, y1, x2, y2 },
  ];
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
    case 'BREAKER':      return '52';
    case 'NPORT_SWITCH': return 'ATS';
    default:             return '';
  }
}

function defaultTag(type: GCompType, idx: number): string {
  switch (type) {
    case 'SOURCE':       return `SRC-${idx}`;
    case 'BREAKER':      return `52-${idx}`;
    case 'CONTACTOR':    return `K${idx}`;
    case 'NPORT_SWITCH': return `ATS-${idx}`;
    case 'BUS':          return `BUS-${idx}`;
    case 'LOAD':         return `LOAD-${idx}`;
    case 'GROUND':       return `GND-${idx}`;
    default:             return `COMP-${idx}`;
  }
}

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
      return {
        ...state,
        placingType: action.compType,
        wireStart: null,
        selectedId: null,
        selectedIds: [],
        ghostRotation: 0,
      };

    case 'SET_GHOST':
      return { ...state, ghostPos: action.pos };

    case 'PLACE_COMPONENT': {
      const saved = pushHistory(state, state.topo);
      return {
        ...saved,
        topo: { ...state.topo, components: [...state.topo.components, action.comp] },
        placingType: null,
        ghostPos: null,
        ghostRotation: 0,
        selectedId: action.comp.id,
        selectedIds: [action.comp.id],
      };
    }

    case 'SELECT':
      return {
        ...state,
        selectedId: action.id,
        selectedIds: action.id ? [action.id] : [],
        placingType: null,
        wireStart: null,
      };

    case 'SELECT_TOGGLE': {
      const already = state.selectedIds.includes(action.id);
      const newIds = already
        ? state.selectedIds.filter(i => i !== action.id)
        : [...state.selectedIds, action.id];
      return {
        ...state,
        selectedIds: newIds,
        selectedId: newIds.length > 0 ? newIds[newIds.length - 1] : null,
        placingType: null,
        wireStart: null,
      };
    }

    case 'SELECT_BOX': {
      const { ids } = action;
      return {
        ...state,
        selectedIds: ids,
        selectedId: ids.length > 0 ? ids[ids.length - 1] : null,
        placingType: null,
        wireStart: null,
      };
    }

    case 'DELETE_SELECTED': {
      if (!state.selectedId) return state;
      const id = state.selectedId;
      const saved = pushHistory(state, state.topo);
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
      return { ...saved, topo, selectedId: null, selectedIds: [] };
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
              ? { ...c, ports: c.ports.map(p => p.id === action.portId ? { ...p, enabled: !p.enabled } : p) }
              : c
          ),
        },
      };
    }

    case 'ROTATE_COMP': {
      const clockwise = action.clockwise !== false;
      const saved = pushHistory(state, state.topo);
      const updatedComps = state.topo.components.map(c => {
        if (c.id !== action.id) return c;
        const newRotation = clockwise
          ? (c.rotation + 90) % 360
          : (c.rotation + 270) % 360;
        return { ...c, rotation: newRotation, ports: rotatePorts(c.ports, clockwise) };
      });
      const updatedWires = rerouteWiresForComp(state.topo.wires, updatedComps, action.id);
      return { ...saved, topo: { ...state.topo, components: updatedComps, wires: updatedWires } };
    }

    case 'ROTATE_GHOST': {
      const clockwise = action.clockwise !== false;
      const newRot = clockwise
        ? (state.ghostRotation + 90) % 360
        : (state.ghostRotation + 270) % 360;
      return { ...state, ghostRotation: newRot };
    }

    case 'MOVE_COMP': {
      const { id, x, y } = action;
      // Reject if another component occupies the same center
      const collision = state.topo.components.some(c => c.id !== id && c.x === x && c.y === y);
      if (collision) return state;
      const saved = pushHistory(state, state.topo);
      const updatedComps = state.topo.components.map(c => c.id === id ? { ...c, x, y } : c);
      const updatedWires = rerouteWiresForComp(state.topo.wires, updatedComps, id);
      return { ...saved, topo: { ...state.topo, components: updatedComps, wires: updatedWires } };
    }

    case 'MOVE_MULTI': {
      const { moves } = action;
      const movedIds = new Set(moves.map(m => m.id));
      const staticComps = state.topo.components.filter(c => !movedIds.has(c.id));
      // Collision: any moved comp landing on a static comp's center
      const collision = moves.some(m => staticComps.some(c => c.x === m.x && c.y === m.y));
      if (collision) return state;
      const saved = pushHistory(state, state.topo);
      const posMap = new Map(moves.map(m => [m.id, { x: m.x, y: m.y }]));
      const updatedComps = state.topo.components.map(c => {
        const pos = posMap.get(c.id);
        return pos ? { ...c, ...pos } : c;
      });
      const updatedWires = rerouteWiresForComps(state.topo.wires, updatedComps, moves.map(m => m.id));
      return { ...saved, topo: { ...state.topo, components: updatedComps, wires: updatedWires } };
    }

    case 'START_WIRE':
      return { ...state, wireStart: action.start, selectedId: null, selectedIds: [] };

    case 'FINISH_WIRE': {
      const { wireStart } = state;
      if (!wireStart) return state;
      if (wireStart.compId === action.toCompId && wireStart.portId === action.toPortId) {
        return { ...state, wireStart: null };
      }
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
        fromCompId: wireStart.compId, fromPortId: wireStart.portId,
        toCompId: action.toCompId,   toPortId: action.toPortId,
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
      return { ...saved, topo, selectedId: null, selectedIds: [] };
    }

    case 'UNDO': {
      if (state.history.length === 0) return state;
      const prev = state.history[state.history.length - 1];
      return {
        ...state,
        topo: prev,
        history: state.history.slice(0, -1),
        future:  [state.topo, ...state.future.slice(0, 49)],
        selectedId: null, selectedIds: [],
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
        selectedId: null, selectedIds: [],
      };
    }

    case 'LOAD_TOPO':
      return {
        ...state,
        topo: action.topo,
        selectedId: null, selectedIds: [],
        history: [], future: [],
        wireStart: null, placingType: null, ghostRotation: 0,
      };

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
    selectedIds: [],
    placingType: null,
    ghostRotation: 0,
    wireStart: null,
    ghostPos: null,
    history: [],
    future: [],
  });

  const compCount = state.topo.components.length;
  const ghostRotation = state.ghostRotation;

  const startPlacing = useCallback((type: GCompType) => {
    dispatch({ type: 'SET_PLACING', compType: type });
  }, []);

  const setGhost = useCallback((pos: { x: number; y: number } | null) => {
    dispatch({ type: 'SET_GHOST', pos });
  }, []);

  const placeComponent = useCallback((x: number, y: number, compType: GCompType) => {
    const idx = compCount + 1;
    // Apply ghost rotation to ports before placing
    let ports = defaultPorts(compType, 2);
    const steps = ghostRotation / 90;
    for (let i = 0; i < steps; i++) {
      ports = ports.map(p => {
        const { dx, dy } = rotateVec(p.dx, p.dy, true);
        return { ...p, dx, dy };
      });
    }
    const comp: GComponent = {
      id:         uid(compType.toLowerCase()),
      type:       compType,
      role:       'NONE',
      tag:        defaultTag(compType, idx),
      ansiNumber: defaultAnsi(compType),
      x, y,
      rotation:   ghostRotation,
      ports,
      props:      defaultProps(compType),
    };
    dispatch({ type: 'PLACE_COMPONENT', comp });
  }, [compCount, ghostRotation]);

  const select = useCallback((id: string | null) =>
    dispatch({ type: 'SELECT', id }), []);

  const selectToggle = useCallback((id: string) =>
    dispatch({ type: 'SELECT_TOGGLE', id }), []);

  const selectBox = useCallback((ids: string[]) =>
    dispatch({ type: 'SELECT_BOX', ids }), []);

  const deleteSelected = useCallback(() =>
    dispatch({ type: 'DELETE_SELECTED' }), []);

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

  const rotateComp = useCallback((id: string, clockwise = true) =>
    dispatch({ type: 'ROTATE_COMP', id, clockwise }), []);

  const rotateGhost = useCallback((clockwise = true) =>
    dispatch({ type: 'ROTATE_GHOST', clockwise }), []);

  const moveComp = useCallback((id: string, x: number, y: number) =>
    dispatch({ type: 'MOVE_COMP', id, x, y }), []);

  const moveMulti = useCallback((moves: Array<{ id: string; x: number; y: number }>) =>
    dispatch({ type: 'MOVE_MULTI', moves }), []);

  const startWire = useCallback((start: WireStart) =>
    dispatch({ type: 'START_WIRE', start }), []);

  const finishWire = useCallback((toCompId: string, toPortId: string, toWx: number, toWy: number) => {
    dispatch({ type: 'FINISH_WIRE', toCompId, toPortId, toWx, toWy });
  }, []);

  const cancelWire = useCallback(() => dispatch({ type: 'CANCEL_WIRE' }), []);

  const deleteWire = useCallback((wireId: string) =>
    dispatch({ type: 'DELETE_WIRE', wireId }), []);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  const loadTopo = useCallback((topo: GraphTopology) =>
    dispatch({ type: 'LOAD_TOPO', topo }), []);

  const saveJSON = useCallback((): string =>
    JSON.stringify(state.topo, null, 2), [state.topo]);

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
      select, selectToggle, selectBox,
      deleteSelected,
      updateProps, updateTag, updateRole,
      togglePort, rotateComp, rotateGhost,
      moveComp, moveMulti,
      startWire, finishWire, cancelWire, deleteWire,
      undo, redo,
      loadTopo, saveJSON, loadJSON,
    },
  };
}
