import type { CircuitModel, CircuitComponent, CircuitWire, SchemeSettings } from '../core/types';
import { resolveAllPorts } from '../core/PortResolver';
import { buildAdjacencyGraph } from '../core/CircuitGraph';
import { solveEnergization } from '../core/EnergizationSolver';
import { validateCircuit } from '../core/Validator';
import { COMPONENT_REGISTRY } from '../core/ComponentRegistry';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, testName: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${testName}`);
  } else {
    failed++;
    const msg = `  ✗ ${testName}`;
    failures.push(msg);
    console.log(msg);
  }
}

// === HELPER: Build components programmatically ===

function makeSource(id: string, tag: string, x: number, y: number): CircuitComponent {
  const def = COMPONENT_REGISTRY["utility-source"];
  return {
    id, type: "utility-source", tag, x, y, rotation: 0,
    ports: JSON.parse(JSON.stringify(def.defaultPorts)),
    properties: { ...def.defaultProperties },
    state: { ...def.defaultState, energized: false },
  };
}

function makeBreaker(id: string, tag: string, x: number, y: number, closed: boolean): CircuitComponent {
  const def = COMPONENT_REGISTRY["circuit-breaker"];
  return {
    id, type: "circuit-breaker", tag, x, y, rotation: 0,
    ports: JSON.parse(JSON.stringify(def.defaultPorts)),
    properties: { ...def.defaultProperties },
    state: { ...def.defaultState, closed, energized: false },
  };
}

function makeBus(id: string, tag: string, x: number, y: number): CircuitComponent {
  const def = COMPONENT_REGISTRY["bus-segment"];
  return {
    id, type: "bus-segment", tag, x, y, rotation: 0,
    ports: JSON.parse(JSON.stringify(def.defaultPorts)),
    properties: { ...def.defaultProperties },
    state: { ...def.defaultState, energized: false },
  };
}

function makeLoad(id: string, tag: string, x: number, y: number): CircuitComponent {
  const def = COMPONENT_REGISTRY["load"];
  return {
    id, type: "load", tag, x, y, rotation: 0,
    ports: JSON.parse(JSON.stringify(def.defaultPorts)),
    properties: { ...def.defaultProperties, loadKW: 500 },
    state: { ...def.defaultState, energized: false },
  };
}

function wire(id: string, fromComp: string, fromPort: string, toComp: string, toPort: string): CircuitWire {
  return { id, fromComponentId: fromComp, fromPortId: fromPort, toComponentId: toComp, toPortId: toPort };
}

function defaultSettings(): SchemeSettings {
  return {
    transferMode: "open-transition",
    preferredSourceId: null,
    undervoltagePickup: 85,
    overvoltagePickup: 110,
    underfrequencyPickup: 57,
    overfrequencyPickup: 63,
    pickupDelay: 500,
    transferDelay: 100,
    retransferDelay: 10000,
    autoRetransfer: true,
    syncCheckDeltaV: 5,
    syncCheckDeltaF: 0.5,
    syncCheckDeltaPhi: 10,
    maxParallelTime: 100,
    lockoutAfterN: 3,
    lockoutWindow: 60000,
  };
}

// ================================================================
// TEST GROUP 1: PORT RESOLUTION
// ================================================================

console.log("\n=== TEST GROUP 1: Port Resolution ===\n");

(() => {
  const src = makeSource("s1", "SRC", 5, 5);
  const ports0 = resolveAllPorts(src);
  const outPort = ports0.get("output");
  assert(outPort !== undefined, "Source output port resolved");
  assert(outPort!.absoluteX === 5 + 2.5, "Source output X at rotation=0");
  assert(outPort!.absoluteY === 5, "Source output Y at rotation=0");

  src.rotation = 90;
  const ports90 = resolveAllPorts(src);
  const outPort90 = ports90.get("output");
  assert(outPort90 !== undefined, "Source output port resolved at 90°");
  // At 90°, relativeX=2.5 relativeY=0 should rotate to relativeX=0 relativeY=2.5
  assert(Math.abs(outPort90!.absoluteX - 5) < 0.01, "Source output X at rotation=90");
  assert(Math.abs(outPort90!.absoluteY - 7.5) < 0.01, "Source output Y at rotation=90");

  src.rotation = 180;
  const ports180 = resolveAllPorts(src);
  const outPort180 = ports180.get("output");
  assert(Math.abs(outPort180!.absoluteX - 2.5) < 0.01, "Source output X at rotation=180");
  assert(Math.abs(outPort180!.absoluteY - 5) < 0.01, "Source output Y at rotation=180");

  src.rotation = 270;
  const ports270 = resolveAllPorts(src);
  const outPort270 = ports270.get("output");
  assert(Math.abs(outPort270!.absoluteX - 5) < 0.01, "Source output X at rotation=270");
  assert(Math.abs(outPort270!.absoluteY - 2.5) < 0.01, "Source output Y at rotation=270");
})();

// ================================================================
// TEST GROUP 2: CONNECTIVITY GRAPH
// ================================================================

console.log("\n=== TEST GROUP 2: Connectivity Graph ===\n");

(() => {
  // Build: SRC -> BRK -> BUS -> LOAD
  const model: CircuitModel = {
    version: "2.0",
    name: "Graph Test",
    components: [
      makeSource("s1", "SRC-1", 0, 5),
      makeBreaker("b1", "52-1", 4, 5, true),
      makeBus("bus1", "BUS-1", 8, 5),
      makeLoad("l1", "LOAD-1", 8, 8),
    ],
    wires: [
      wire("w1", "s1", "output", "b1", "line"),
      wire("w2", "b1", "load", "bus1", "left"),
      wire("w3", "bus1", "tap1", "l1", "supply"),
    ],
    schemeSettings: defaultSettings(),
  };

  const graph = buildAdjacencyGraph(model);

  // s1:output should connect to b1:line via wire
  const s1OutAdj = graph.adjacency.get("s1:output") || [];
  assert(s1OutAdj.includes("b1:line"), "SRC output -> BRK line connected via wire");

  // b1:line should connect to b1:load internally (breaker is closed)
  const b1LineAdj = graph.adjacency.get("b1:line") || [];
  assert(b1LineAdj.includes("b1:load"), "BRK line -> BRK load connected internally (closed)");

  // Now open the breaker and rebuild
  model.components.find((c) => c.id === "b1")!.state.closed = false;
  const graph2 = buildAdjacencyGraph(model);
  const b1LineAdj2 = graph2.adjacency.get("b1:line") || [];
  assert(!b1LineAdj2.includes("b1:load"), "BRK line -> BRK load NOT connected internally (open)");
})();

// ================================================================
// TEST GROUP 3: ENERGIZATION
// ================================================================

console.log("\n=== TEST GROUP 3: Energization ===\n");

(() => {
  // Simple chain: SRC -> BRK(closed) -> BUS -> LOAD
  const model: CircuitModel = {
    version: "2.0",
    name: "Energization Test",
    components: [
      makeSource("s1", "SRC-1", 0, 5),
      makeBreaker("b1", "52-1", 4, 5, true),
      makeBus("bus1", "BUS-1", 8, 5),
      makeLoad("l1", "LOAD-1", 8, 8),
    ],
    wires: [
      wire("w1", "s1", "output", "b1", "line"),
      wire("w2", "b1", "load", "bus1", "left"),
      wire("w3", "bus1", "tap1", "l1", "supply"),
    ],
    schemeSettings: defaultSettings(),
  };

  // All should be energized
  const graph1 = buildAdjacencyGraph(model);
  const e1 = solveEnergization(model, graph1);
  assert(e1.get("s1") === true, "Source energized");
  assert(e1.get("b1") === true, "Breaker energized");
  assert(e1.get("bus1") === true, "Bus energized");
  assert(e1.get("l1") === true, "Load energized");

  // Fail the source
  model.components.find((c) => c.id === "s1")!.state.failed = true;
  const graph2 = buildAdjacencyGraph(model);
  const e2 = solveEnergization(model, graph2);
  assert(e2.get("s1") === false, "Failed source not energized");
  assert(e2.get("bus1") === false, "Bus not energized after source failure");
  assert(e2.get("l1") === false, "Load not energized after source failure");

  // Restore source, open breaker
  model.components.find((c) => c.id === "s1")!.state.failed = false;
  model.components.find((c) => c.id === "b1")!.state.closed = false;
  const graph3 = buildAdjacencyGraph(model);
  const e3 = solveEnergization(model, graph3);
  assert(e3.get("s1") === true, "Source energized after restore");
  assert(e3.get("b1") === true, "Breaker energized on line side");
  assert(e3.get("bus1") === false, "Bus NOT energized with breaker open");
  assert(e3.get("l1") === false, "Load NOT energized with breaker open");
})();

// ================================================================
// TEST GROUP 4: DUAL SOURCE ENERGIZATION
// ================================================================

console.log("\n=== TEST GROUP 4: Dual Source Energization ===\n");

(() => {
  // SRC1 -> BRK1 -> BUS <- BRK2 <- SRC2
  //                  |
  //                LOAD
  const model: CircuitModel = {
    version: "2.0",
    name: "Dual Source Test",
    components: [
      makeSource("s1", "M1", 0, 5),
      makeBreaker("b1", "52-M1", 3, 5, true),
      makeBus("bus1", "BUS-1", 7, 5),
      makeBreaker("b2", "52-M2", 11, 5, true),
      makeSource("s2", "M2", 14, 5),
      makeLoad("l1", "LOAD-1", 7, 8),
    ],
    wires: [
      wire("w1", "s1", "output", "b1", "line"),
      wire("w2", "b1", "load", "bus1", "left"),
      wire("w3", "bus1", "right", "b2", "line"),
      wire("w4", "b2", "load", "s2", "output"),
      wire("w5", "bus1", "tap1", "l1", "supply"),
    ],
    schemeSettings: defaultSettings(),
  };

  // Both sources live, both breakers closed
  const g1 = buildAdjacencyGraph(model);
  const e1 = solveEnergization(model, g1);
  assert(e1.get("bus1") === true, "Bus energized from both sources");
  assert(e1.get("l1") === true, "Load energized from both sources");

  // Fail S1, bus should still be energized from S2
  model.components.find((c) => c.id === "s1")!.state.failed = true;
  const g2 = buildAdjacencyGraph(model);
  const e2 = solveEnergization(model, g2);
  assert(e2.get("bus1") === true, "Bus still energized from S2 after S1 failure");
  assert(e2.get("l1") === true, "Load still energized from S2 after S1 failure");

  // Fail both
  model.components.find((c) => c.id === "s2")!.state.failed = true;
  const g3 = buildAdjacencyGraph(model);
  const e3 = solveEnergization(model, g3);
  assert(e3.get("bus1") === false, "Bus de-energized after both sources fail");
  assert(e3.get("l1") === false, "Load de-energized after both sources fail");

  // Restore S2 only
  model.components.find((c) => c.id === "s2")!.state.failed = false;
  const g4 = buildAdjacencyGraph(model);
  const e4 = solveEnergization(model, g4);
  assert(e4.get("bus1") === true, "Bus re-energized after S2 restore");
})();

// ================================================================
// TEST GROUP 5: MAIN-TIE-MAIN ENERGIZATION
// ================================================================

console.log("\n=== TEST GROUP 5: Main-Tie-Main Energization ===\n");

(() => {
  // S1 -> B1 -> BUS1 -> TIE(open) -> BUS2 -> B2 -> S2
  //               |                     |
  //             LOAD1                 LOAD2
  const model: CircuitModel = {
    version: "2.0",
    name: "MTM Test",
    components: [
      makeSource("s1", "M1", 0, 5),
      makeBreaker("b1", "52-M1", 3, 5, true),
      makeBus("bus1", "BUS-1", 7, 5),
      makeBreaker("tie", "52-TIE", 11, 5, false), // TIE is OPEN
      makeBus("bus2", "BUS-2", 15, 5),
      makeBreaker("b2", "52-M2", 19, 5, true),
      makeSource("s2", "M2", 22, 5),
      makeLoad("l1", "LOAD-1", 7, 8),
      makeLoad("l2", "LOAD-2", 15, 8),
    ],
    wires: [
      wire("w1", "s1", "output", "b1", "line"),
      wire("w2", "b1", "load", "bus1", "left"),
      wire("w3", "bus1", "right", "tie", "line"),
      wire("w4", "tie", "load", "bus2", "left"),
      wire("w5", "bus2", "right", "b2", "line"),
      wire("w6", "b2", "load", "s2", "output"),
      wire("w7", "bus1", "tap1", "l1", "supply"),
      wire("w8", "bus2", "tap1", "l2", "supply"),
    ],
    schemeSettings: defaultSettings(),
  };

  // Tie open: each bus energized from its own source independently
  const g1 = buildAdjacencyGraph(model);
  const e1 = solveEnergization(model, g1);
  assert(e1.get("bus1") === true, "BUS-1 energized from M1");
  assert(e1.get("bus2") === true, "BUS-2 energized from M2");
  assert(e1.get("l1") === true, "LOAD-1 energized");
  assert(e1.get("l2") === true, "LOAD-2 energized");

  // Fail M1, open B1: BUS-1 should de-energize
  model.components.find((c) => c.id === "s1")!.state.failed = true;
  model.components.find((c) => c.id === "b1")!.state.closed = false;
  const g2 = buildAdjacencyGraph(model);
  const e2 = solveEnergization(model, g2);
  assert(e2.get("bus1") === false, "BUS-1 de-energized after M1 fail + B1 open");
  assert(e2.get("l1") === false, "LOAD-1 de-energized");
  assert(e2.get("bus2") === true, "BUS-2 still energized from M2");
  assert(e2.get("l2") === true, "LOAD-2 still energized");

  // Close the tie: BUS-1 should re-energize from M2 through tie
  model.components.find((c) => c.id === "tie")!.state.closed = true;
  const g3 = buildAdjacencyGraph(model);
  const e3 = solveEnergization(model, g3);
  assert(e3.get("bus1") === true, "BUS-1 re-energized through TIE from M2");
  assert(e3.get("l1") === true, "LOAD-1 re-energized through TIE");

  // Now fail M2 too: everything should go dark
  model.components.find((c) => c.id === "s2")!.state.failed = true;
  const g4 = buildAdjacencyGraph(model);
  const e4 = solveEnergization(model, g4);
  assert(e4.get("bus1") === false, "BUS-1 de-energized after both sources fail");
  assert(e4.get("bus2") === false, "BUS-2 de-energized after both sources fail");
  assert(e4.get("l1") === false, "LOAD-1 de-energized after both sources fail");
  assert(e4.get("l2") === false, "LOAD-2 de-energized after both sources fail");
})();

// ================================================================
// TEST GROUP 6: VALIDATOR
// ================================================================

console.log("\n=== TEST GROUP 6: Validation ===\n");

(() => {
  // Valid circuit
  const valid: CircuitModel = {
    version: "2.0",
    name: "Valid",
    components: [
      makeSource("s1", "SRC", 0, 5),
      makeBreaker("b1", "BRK", 4, 5, true),
      makeBus("bus1", "BUS", 8, 5),
      makeLoad("l1", "LOAD", 8, 8),
    ],
    wires: [
      wire("w1", "s1", "output", "b1", "line"),
      wire("w2", "b1", "load", "bus1", "left"),
      wire("w3", "bus1", "tap1", "l1", "supply"),
    ],
    schemeSettings: defaultSettings(),
  };

  const r1 = validateCircuit(valid);
  assert(r1.valid === true, "Valid circuit passes validation");
  assert(r1.errors.length === 0, "Valid circuit has zero errors");

  // Bad wire — references nonexistent component
  const badWire: CircuitModel = {
    ...valid,
    name: "Bad Wire",
    wires: [
      ...valid.wires,
      wire("w-bad", "nonexistent", "output", "b1", "line"),
    ],
  };
  const r2 = validateCircuit(badWire);
  assert(r2.valid === false, "Bad wire reference caught");
  assert(r2.errors.some((e) => e.message.includes("nonexistent")), "Error names the bad component");

  // Bad wire — references nonexistent port
  const badPort: CircuitModel = {
    ...valid,
    name: "Bad Port",
    wires: [
      ...valid.wires,
      wire("w-bad2", "s1", "fakePORT", "b1", "line"),
    ],
  };
  const r3 = validateCircuit(badPort);
  assert(r3.valid === false, "Bad port reference caught");
  assert(r3.errors.some((e) => e.message.includes("fakePORT")), "Error names the bad port");

  // No source
  const noSource: CircuitModel = {
    ...valid,
    name: "No Source",
    components: valid.components.filter((c) => c.type !== "utility-source"),
    wires: valid.wires.filter((w) => w.fromComponentId !== "s1" && w.toComponentId !== "s1"),
  };
  const r4 = validateCircuit(noSource);
  assert(r4.valid === false, "Missing source caught");

  // Duplicate IDs
  const dupeIds: CircuitModel = {
    ...valid,
    name: "Dupe IDs",
    components: [...valid.components, { ...valid.components[0] }],
  };
  const r5 = validateCircuit(dupeIds);
  assert(r5.valid === false, "Duplicate component IDs caught");
})();

// ================================================================
// SUMMARY
// ================================================================

console.log("\n========================================");
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log("========================================\n");

if (failed > 0) {
  console.log("FAILURES:");
  failures.forEach((f) => console.log(f));
  console.log("");
  process.exit(1);
} else {
  console.log("All tests passed.\n");
  process.exit(0);
}
