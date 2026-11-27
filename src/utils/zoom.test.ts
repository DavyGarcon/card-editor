import { describe, expect, it } from 'vitest';
import { computeFitZoom } from './zoom';

describe('computeFitZoom', () => {
  it('uses the limiting dimension and accounts for the preview padding', () => {
    expect(computeFitZoom(3230, 2280, 800, 600, 16)).toBeCloseTo(768 / 3230, 10);
    expect(computeFitZoom(1000, 400, 800, 600, 16)).toBeCloseTo(768 / 1000, 10);
    expect(computeFitZoom(400, 1000, 800, 600, 16)).toBeCloseTo(568 / 1000, 10);
  });

  it('never enlarges a card that already fits at 100%', () => {
    expect(computeFitZoom(375, 525, 800, 600, 16)).toBe(1);
  });

  it('returns null until the viewport has a usable size', () => {
    expect(computeFitZoom(375, 525, 0, 0, 16)).toBeNull();
    expect(computeFitZoom(375, 525, 800, 0, 16)).toBeNull();
    expect(computeFitZoom(0, 525, 800, 600, 16)).toBeNull();
  });
});
