import { describe, it, expect } from 'vitest';
import { resolveAllPorts, resolvePort } from '../core/PortResolver';
import type { CircuitComponent } from '../core/types';

function makeComp(type: CircuitComponent['type'], x: number, y: number, rotation: 0|90|180|270): CircuitComponent {
  return {
    id: 'test', type, tag: 'TEST',
    x, y, rotation,
    ports: [
      { id: 'a', label: 'A', relativeX: 2, relativeY: 0, enabled: true, direction: 'out' },
      { id: 'b', label: 'B', relativeX: -2, relativeY: 0, enabled: true, direction: 'in' },
      { id: 'c', label: 'C', relativeX: 0, relativeY: 2, enabled: true, direction: 'bidirectional' },
    ],
    properties: {},
    state: { closed: true, energized: false, failed: false, tripped: false, locked: false, voltagePercent: 0, frequencyHz: 0, phaseAngleDeg: 0 },
  };
}

describe('PortResolver', () => {
  it('resolves ports at rotation=0', () => {
    const comp = makeComp('load', 5, 5, 0);
    const ports = resolveAllPorts(comp);
    expect(ports.get('a')!.absoluteX).toBeCloseTo(7);
    expect(ports.get('a')!.absoluteY).toBeCloseTo(5);
    expect(ports.get('b')!.absoluteX).toBeCloseTo(3);
    expect(ports.get('b')!.absoluteY).toBeCloseTo(5);
    expect(ports.get('c')!.absoluteX).toBeCloseTo(5);
    expect(ports.get('c')!.absoluteY).toBeCloseTo(7);
  });

  it('resolves ports at rotation=90', () => {
    const comp = makeComp('load', 5, 5, 90);
    const ports = resolveAllPorts(comp);
    // rotation=90: [-relY, relX]
    // port a: relX=2, relY=0 -> [0, 2] -> (5+0, 5+2) = (5, 7)
    expect(ports.get('a')!.absoluteX).toBeCloseTo(5);
    expect(ports.get('a')!.absoluteY).toBeCloseTo(7);
    // port b: relX=-2, relY=0 -> [0, -2] -> (5, 3)
    expect(ports.get('b')!.absoluteX).toBeCloseTo(5);
    expect(ports.get('b')!.absoluteY).toBeCloseTo(3);
    // port c: relX=0, relY=2 -> [-2, 0] -> (3, 5)
    expect(ports.get('c')!.absoluteX).toBeCloseTo(3);
    expect(ports.get('c')!.absoluteY).toBeCloseTo(5);
  });

  it('resolves ports at rotation=180', () => {
    const comp = makeComp('load', 5, 5, 180);
    const ports = resolveAllPorts(comp);
    // rotation=180: [-relX, -relY]
    // port a: relX=2, relY=0 -> [-2, 0] -> (3, 5)
    expect(ports.get('a')!.absoluteX).toBeCloseTo(3);
    expect(ports.get('a')!.absoluteY).toBeCloseTo(5);
    // port b: relX=-2, relY=0 -> [2, 0] -> (7, 5)
    expect(ports.get('b')!.absoluteX).toBeCloseTo(7);
    expect(ports.get('b')!.absoluteY).toBeCloseTo(5);
  });

  it('resolves ports at rotation=270', () => {
    const comp = makeComp('load', 5, 5, 270);
    const ports = resolveAllPorts(comp);
    // rotation=270: [relY, -relX]
    // port a: relX=2, relY=0 -> [0, -2] -> (5, 3)
    expect(ports.get('a')!.absoluteX).toBeCloseTo(5);
    expect(ports.get('a')!.absoluteY).toBeCloseTo(3);
    // port c: relX=0, relY=2 -> [2, 0] -> (7, 5)
    expect(ports.get('c')!.absoluteX).toBeCloseTo(7);
    expect(ports.get('c')!.absoluteY).toBeCloseTo(5);
  });

  it('skips disabled ports', () => {
    const comp = makeComp('load', 5, 5, 0);
    comp.ports[0].enabled = false;
    const ports = resolveAllPorts(comp);
    expect(ports.has('a')).toBe(false);
    expect(ports.has('b')).toBe(true);
  });

  it('resolvePort returns correct absolute position', () => {
    const comp = makeComp('load', 10, 3, 0);
    const resolved = resolvePort(comp, comp.ports[2]); // relX=0, relY=2
    expect(resolved.absoluteX).toBeCloseTo(10);
    expect(resolved.absoluteY).toBeCloseTo(5);
  });
});
