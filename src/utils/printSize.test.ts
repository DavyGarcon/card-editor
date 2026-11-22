import { describe, expect, it } from 'vitest';
import { TEMPLATE_DPI, templateWidthToMm } from './printSize';

describe('templateWidthToMm', () => {
  it('uses the template scale where 370 px prints as 34 mm', () => {
    expect(TEMPLATE_DPI).toBeCloseTo(276.4, 1);
    expect(templateWidthToMm(370)).toBe(34);
    expect(templateWidthToMm(375)).toBe(34.5);
    expect(templateWidthToMm(750)).toBe(68.9);
  });

  it('rounds to the nearest tenth of a millimetre', () => {
    expect(templateWidthToMm(300)).toBe(27.6);
  });

  it('accepts a DPI override from the PDF options', () => {
    expect(templateWidthToMm(370, 300)).toBe(31.3);
  });
});
