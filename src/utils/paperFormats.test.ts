import { describe, expect, it } from 'vitest';
import { getPaperDimensions, getPaperFormat, PAPER_FORMATS } from './paperFormats';

describe('paper formats', () => {
  it('exposes the standard A sizes plus common US sheets', () => {
    expect(PAPER_FORMATS.map((format) => format.id)).toContain('a3');
    expect(PAPER_FORMATS.map((format) => format.id)).toContain('a5');
    expect(PAPER_FORMATS.map((format) => format.id)).toContain('letter');
  });

  it('resolves paper dimensions', () => {
    expect(getPaperFormat('a3')).toMatchObject({ widthMm: 297, heightMm: 420 });
    expect(getPaperFormat('a5')).toMatchObject({ widthMm: 148, heightMm: 210 });
    expect(getPaperFormat('letter')).toMatchObject({ widthMm: 215.9, heightMm: 279.4 });
  });

  it('swaps page dimensions for landscape', () => {
    expect(getPaperDimensions('a4')).toEqual({ widthMm: 210, heightMm: 297 });
    expect(getPaperDimensions('a4', 'landscape')).toEqual({ widthMm: 297, heightMm: 210 });
  });

  it('falls back to A4 for an unknown size', () => {
    expect(getPaperFormat('unknown' as 'a4')).toMatchObject({ id: 'a4', widthMm: 210 });
  });
});
