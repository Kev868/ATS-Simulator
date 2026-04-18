import { describe, it, expect } from 'vitest';
import { buildAdjacencyGraph, nodeKey } from '../core/CircuitGraph';
import { deserializeCircuit } from '../core/serialization';
import minimalJson from './test-circuits/minimal.json';

describe('CircuitGraph — minimal circuit', () => {
  const model = deserializeCircuit(JSON.stringify(minimalJson));

  it('creates correct number of nodes', () => {
    const graph = buildAdjacencyGraph(model);
    // s1: 1 port (output)
    // b1: 2 ports (line, load)
    // bus1: 3 ports (left, right, tap1)
    // l1: 1 port (supply)
    // Total = 7
    expect(graph.nodes.size).toBe(7);
  });

  it('s1:output is adjacent to b1:line via wire', () => {
    const graph = buildAdjacencyGraph(model);
    const s1Key = nodeKey('s1', 'output');
    const b1LineKey = nodeKey('b1', 'line');
    expect(graph.adjacency.get(s1Key)).toContain(b1LineKey);
  });

  it('b1:line is adjacent to b1:load (internal, breaker closed)', () => {
    const graph = buildAdjacencyGraph(model);
    const b1Line = nodeKey('b1', 'line');
    const b1Load = nodeKey('b1', 'load');
    expect(graph.adjacency.get(b1Line)).toContain(b1Load);
  });

  it('b1:load is adjacent to bus1:left via wire', () => {
    const graph = buildAdjacencyGraph(model);
    expect(graph.adjacency.get(nodeKey('b1', 'load'))).toContain(nodeKey('bus1', 'left'));
  });

  it('bus1 ports all connected internally (bus always conducts)', () => {
    const graph = buildAdjacencyGraph(model);
    const left = nodeKey('bus1', 'left');
    const right = nodeKey('bus1', 'right');
    const tap1 = nodeKey('bus1', 'tap1');
    expect(graph.adjacency.get(left)).toContain(right);
    expect(graph.adjacency.get(left)).toContain(tap1);
    expect(graph.adjacency.get(right)).toContain(tap1);
  });

  it('opens breaker removes internal edge', () => {
    const m = deserializeCircuit(JSON.stringify(minimalJson));
    const b1 = m.components.find((c) => c.id === 'b1')!;
    b1.state.closed = false;
    const graph = buildAdjacencyGraph(m);
    const b1Line = nodeKey('b1', 'line');
    const b1Load = nodeKey('b1', 'load');
    expect(graph.adjacency.get(b1Line)).not.toContain(b1Load);
  });
});
