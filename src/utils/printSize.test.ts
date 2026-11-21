import { describe, expect, it } from 'vitest';
import { TEMPLATE_DPI, templateWidthToMm } from './printSize';

describe('templateWidthToMm', () => {
  it('uses the built-in 150 DPI template scale', () => {
    expect(TEMPLATE_DPI).toBe(150);
    expect(templateWidthToMm(375)).toBe(63.5);
    expect(templateWidthToMm(750)).toBe(127);
  });

  it('rounds to the nearest tenth of a millimetre', () => {
    expect(templateWidthToMm(300)).toBe(50.8);
  });
});
