import { describe, it, expect } from 'vitest';
import { routeWire } from '../core/WireRouter';

describe('WireRouter', () => {
  it('returns straight horizontal line for same Y', () => {
    const pts = routeWire(0, 5, 10, 5);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ x: 0, y: 5 });
    expect(pts[1]).toEqual({ x: 10, y: 5 });
  });

  it('returns straight vertical line for same X', () => {
    const pts = routeWire(5, 0, 5, 10);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ x: 5, y: 0 });
    expect(pts[1]).toEqual({ x: 5, y: 10 });
  });

  it('returns L-shaped path for different X and Y', () => {
    const pts = routeWire(0, 0, 10, 10);
    expect(pts.length).toBeGreaterThanOrEqual(3);
    // All segments must be horizontal or vertical
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      expect(dx === 0 || dy === 0).toBe(true);
    }
    // Must start and end at correct positions
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 10, y: 10 });
  });

  it('no diagonal segments in any route', () => {
    const cases = [
      [0, 0, 100, 200],
      [50, 50, 10, 90],
      [-5, 3, 20, -10],
    ];
    for (const [fx, fy, tx, ty] of cases) {
      const pts = routeWire(fx, fy, tx, ty);
      for (let i = 1; i < pts.length; i++) {
        const dx = Math.abs(pts[i].x - pts[i - 1].x);
        const dy = Math.abs(pts[i].y - pts[i - 1].y);
        expect(dx === 0 || dy === 0).toBe(true);
      }
    }
  });
});
