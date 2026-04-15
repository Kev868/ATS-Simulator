// ─── Built-in topologies as GraphTopology objects ────────────────────────────
// These mirror the existing preset topologies (TWO_SOURCE, MTM, MMM) so that
// the custom-topology engine path can run them, and regression tests can
// compare results against the hardcoded engine.

import { GraphTopology, GComponent, GWire } from './graphTopology';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCtr = 0;
function uid(prefix: string): string {
  return `${prefix}-${++_idCtr}`;
}

function breaker(
  id: string, tag: string, role: GComponent['role'],
  x: number, y: number
): GComponent {
  return {
    id, tag, ansiNumber: '52', type: 'BREAKER', role,
    x, y, rotation: 0,
    ports: [
      { id: 'left',  label: 'L', enabled: true,  dx: -2, dy: 0, connectedWireIds: [] },
      { id: 'right', label: 'R', enabled: true,   dx:  2, dy: 0, connectedWireIds: [] },
    ],
    props: { breakerState: 'OPEN', operationTimeMs: 50, lockedOut: false, elapsed: 0 },
  };
}

function source(
  id: string, tag: string, role: GComponent['role'],
  x: number, y: number, available = true
): GComponent {
  return {
    id, tag, ansiNumber: '',
    type: 'SOURCE', role,
    x, y, rotation: 0,
    ports: [{ id: 'out', label: 'Out', enabled: true, dx: 2, dy: 0, connectedWireIds: [] }],
    props: {
      sourceType: 'UTILITY',
      nominalVoltage: 13.8,
      nominalFrequency: 60,
      voltage: 100,
      frequency: 60,
      phaseAngle: 0,
      available,
    },
  };
}

function bus(
  id: string, tag: string, role: GComponent['role'],
  x: number, y: number, portCount = 4
): GComponent {
  const ports = [];
  if (portCount >= 1) ports.push({ id: 'left',  label: 'L', enabled: true, dx: -3, dy: 0, connectedWireIds: [] });
  if (portCount >= 2) ports.push({ id: 'right', label: 'R', enabled: true, dx:  3, dy: 0, connectedWireIds: [] });
  if (portCount >= 3) ports.push({ id: 'bot1',  label: 'B1', enabled: true, dx: -1, dy: 2, connectedWireIds: [] });
  if (portCount >= 4) ports.push({ id: 'bot2',  label: 'B2', enabled: true, dx:  1, dy: 2, connectedWireIds: [] });
  return { id, tag, ansiNumber: '', type: 'BUS', role, x, y, rotation: 0, ports, props: {} };
}

function load(
  id: string, tag: string,
  x: number, y: number, loadKW = 500
): GComponent {
  return {
    id, tag, ansiNumber: '',
    type: 'LOAD', role: 'AGGREGATE_LOAD',
    x, y, rotation: 0,
    ports: [{ id: 'top', label: 'In', enabled: true, dx: 0, dy: -2, connectedWireIds: [] }],
    props: { loadKW },
  };
}

function wire(
  id: string,
  fromCompId: string, fromPortId: string,
  toCompId: string,   toPortId: string,
  // segments are descriptive only — routing ignores them for simulation
  segments: GWire['segments'] = []
): GWire {
  return { id, fromCompId, fromPortId, toCompId, toPortId, segments };
}

// ─── TWO_SOURCE ───────────────────────────────────────────────────────────────
//
//  M1 --[52-M1]-- BUS-1 --[52-M2]-- M2
//                   |
//                 LOAD-1

export function makeTwoSourceTopology(): GraphTopology {
  const M1    = source('M1',    'M1',    'PREFERRED_SOURCE', 1, 5);
  const BR_M1 = breaker('52-M1','52-M1','SOURCE_BREAKER',   5, 5);
  const BUS1  = bus   ('BUS1',  'BUS-1','MAIN_BUS',         10, 5, 3);
  const BR_M2 = breaker('52-M2','52-M2','SOURCE_BREAKER',   15, 5);
  const M2    = source('M2',    'M2',   'ALTERNATE_SOURCE', 19, 5);
  const LOAD1 = load  ('LOAD1', 'LOAD-1',                   10, 8);

  // Initial state: M1 closed, M2 open
  BR_M1.props.breakerState = 'CLOSED';

  const components = [M1, BR_M1, BUS1, BR_M2, M2, LOAD1];

  const wires: GWire[] = [
    wire('w1', 'M1',    'out',   '52-M1', 'left'),
    wire('w2', '52-M1', 'right', 'BUS1',  'left'),
    wire('w3', 'BUS1',  'right', '52-M2', 'left'),
    wire('w4', '52-M2', 'right', 'M2',    'out'),
    wire('w5', 'BUS1',  'bot1',  'LOAD1', 'top'),
  ];

  // Stamp connectedWireIds
  _stampWireIds(components, wires);

  return {
    id: 'preset-two-source',
    name: 'Two-Source ATS',
    gridPx: 20,
    canvasW: 40,
    canvasH: 20,
    components,
    wires,
  };
}

// ─── MTM (Main-Tie-Main) ──────────────────────────────────────────────────────
//
//  M1 --[52-M1]-- BUS-A --[52-T]-- BUS-B --[52-M2]-- M2
//                   |                  |
//                LOAD-A             LOAD-B

export function makeMTMTopology(): GraphTopology {
  const M1    = source ('M1',    'M1',    'PREFERRED_SOURCE',  1, 5);
  const BR_M1 = breaker('52-M1', '52-M1','SOURCE_BREAKER',    5, 5);
  const BUSA  = bus    ('BUS1',  'BUS-A','MAIN_BUS',         10, 5, 3);
  const BR_T  = breaker('52-T',  '52-T', 'TIE_BREAKER',      15, 5);
  const BUSB  = bus    ('BUS2',  'BUS-B','SECONDARY_BUS',    20, 5, 3);
  const BR_M2 = breaker('52-M2', '52-M2','SOURCE_BREAKER',   25, 5);
  const M2    = source ('M2',    'M2',   'ALTERNATE_SOURCE', 29, 5);
  const LOADA = load   ('LOAD1', 'LOAD-A',                   10, 9);
  const LOADB = load   ('LOAD2', 'LOAD-B',                   20, 9);

  // Initial state: M1 closed, tie open, M2 open
  BR_M1.props.breakerState = 'CLOSED';

  const components = [M1, BR_M1, BUSA, BR_T, BUSB, BR_M2, M2, LOADA, LOADB];

  const wires: GWire[] = [
    wire('w1', 'M1',    'out',   '52-M1', 'left'),
    wire('w2', '52-M1', 'right', 'BUS1',  'left'),
    wire('w3', 'BUS1',  'right', '52-T',  'left'),
    wire('w4', '52-T',  'right', 'BUS2',  'left'),
    wire('w5', 'BUS2',  'right', '52-M2', 'left'),
    wire('w6', '52-M2', 'right', 'M2',    'out'),
    wire('w7', 'BUS1',  'bot1',  'LOAD1', 'top'),
    wire('w8', 'BUS2',  'bot1',  'LOAD2', 'top'),
  ];

  _stampWireIds(components, wires);

  return {
    id: 'preset-mtm',
    name: 'Main-Tie-Main',
    gridPx: 20,
    canvasW: 50,
    canvasH: 25,
    components,
    wires,
  };
}

// ─── MMM (Main-Main-Main) ─────────────────────────────────────────────────────
//
//  M1 --[52-M1]-- BUS-1 --[52-T1]-- BUS-2 --[52-T2]-- BUS-3 --[52-M3]-- M3
//                   |                  |                   |
//                LOAD-1             M2(direct)           LOAD-3
//  (M2 feeds BUS-2 directly, no main breaker — matches existing engine)

export function makeMMMTopology(): GraphTopology {
  const M1    = source ('M1',    'M1',    'PREFERRED_SOURCE',  1,  5);
  const BR_M1 = breaker('52-M1', '52-M1','SOURCE_BREAKER',    5,  5);
  const BUS1  = bus    ('BUS1',  'BUS-1','MAIN_BUS',         10,  5, 3);
  const BR_T1 = breaker('52-T1', '52-T1','TIE_BREAKER',      15,  5);
  const BUS2  = bus    ('BUS2',  'BUS-2','SECONDARY_BUS',    20,  5, 4);
  const BR_T2 = breaker('52-T2', '52-T2','TIE_BREAKER',      25,  5);
  const BUS3  = bus    ('BUS3',  'BUS-3','TERTIARY_BUS',     30,  5, 3);
  const BR_M3 = breaker('52-M3', '52-M3','SOURCE_BREAKER',   35,  5);
  const M3    = source ('M3',    'M3',   'TERTIARY_SOURCE',  39,  5);
  // M2 directly connected to BUS-2 (no breaker)
  const M2    = source ('M2',    'M2',   'ALTERNATE_SOURCE', 20,  2);

  const LOAD1 = load   ('LOAD1', 'LOAD-1',                   10,  9);
  const LOAD3 = load   ('LOAD3', 'LOAD-3',                   30,  9);

  BR_M1.props.breakerState = 'CLOSED';
  BR_M3.props.breakerState = 'CLOSED';

  const components = [M1, BR_M1, BUS1, BR_T1, BUS2, BR_T2, BUS3, BR_M3, M3, M2, LOAD1, LOAD3];

  const wires: GWire[] = [
    wire('w1',  'M1',    'out',   '52-M1', 'left'),
    wire('w2',  '52-M1', 'right', 'BUS1',  'left'),
    wire('w3',  'BUS1',  'right', '52-T1', 'left'),
    wire('w4',  '52-T1', 'right', 'BUS2',  'left'),
    wire('w5',  'BUS2',  'right', '52-T2', 'left'),
    wire('w6',  '52-T2', 'right', 'BUS3',  'left'),
    wire('w7',  'BUS3',  'right', '52-M3', 'left'),
    wire('w8',  '52-M3', 'right', 'M3',    'out'),
    wire('w9',  'M2',    'out',   'BUS2',  'bot1'),
    wire('w10', 'BUS1',  'bot1',  'LOAD1', 'top'),
    wire('w11', 'BUS3',  'bot1',  'LOAD3', 'top'),
  ];

  _stampWireIds(components, wires);

  return {
    id: 'preset-mmm',
    name: 'Main-Main-Main',
    gridPx: 20,
    canvasW: 60,
    canvasH: 25,
    components,
    wires,
  };
}

// ─── Helper: stamp connectedWireIds onto ports ────────────────────────────────
function _stampWireIds(comps: GComponent[], wires: GWire[]): void {
  for (const w of wires) {
    const fc = comps.find(c => c.id === w.fromCompId);
    const tc = comps.find(c => c.id === w.toCompId);
    if (fc) {
      const fp = fc.ports.find(p => p.id === w.fromPortId);
      if (fp) fp.connectedWireIds.push(w.id);
    }
    if (tc) {
      const tp = tc.ports.find(p => p.id === w.toPortId);
      if (tp) tp.connectedWireIds.push(w.id);
    }
  }
}
