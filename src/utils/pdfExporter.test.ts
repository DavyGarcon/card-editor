import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportDeckToPdf } from './pdfExporter';

const { jsPDFMock } = vi.hoisted(() => ({ jsPDFMock: vi.fn() }));

vi.mock('jspdf', () => ({ jsPDF: jsPDFMock }));

describe('exportDeckToPdf', () => {
  beforeEach(() => {
    jsPDFMock.mockReset();
    jsPDFMock.mockImplementation(function () {
      return {
        addImage: vi.fn(),
        addPage: vi.fn(),
        setDrawColor: vi.fn(),
        setLineWidth: vi.fn(),
        line: vi.fn(),
        save: vi.fn(),
      };
    });
  });

  it('rejects an empty deck before computing an infinite cell height', async () => {
    await expect(exportDeckToPdf([], [])).rejects.toThrow(/Aucune carte/i);
  });

  it('rejects invalid ratios and print sizes', async () => {
    await expect(exportDeckToPdf(['x'], [{ width: 0, height: 10 }])).rejects.toThrow(
      /Dimensions de carte invalides/,
    );
    await expect(
      exportDeckToPdf(['x'], { width: 63, height: 89 }, { cardWidthMm: 0 }),
    ).rejects.toThrow(/Dimensions d'impression invalides/);
    await expect(
      exportDeckToPdf(['x'], { width: 63, height: 89 }, { marginMm: -1 }),
    ).rejects.toThrow(/Dimensions d'impression invalides/);
  });

  it('uses the selected paper size to lay out and center the grid', async () => {
    const ratio = { width: 63.5, height: 88.9 };

    await exportDeckToPdf(['a', 'b', 'c'], ratio, { paperSize: 'a3' });
    expect(jsPDFMock).toHaveBeenLastCalledWith(expect.objectContaining({ format: 'a3' }));
    const a3Doc = jsPDFMock.mock.results[0].value as { addImage: ReturnType<typeof vi.fn> };
    const a3X = a3Doc.addImage.mock.calls[0][2] as number;

    await exportDeckToPdf(['a', 'b', 'c'], ratio, { paperSize: 'a5' });
    expect(jsPDFMock).toHaveBeenLastCalledWith(expect.objectContaining({ format: 'a5' }));
    const a5Doc = jsPDFMock.mock.results[1].value as { addImage: ReturnType<typeof vi.fn> };
    const a5X = a5Doc.addImage.mock.calls[0][2] as number;

    // A3 fits four columns; A5 only one, so the starting x differs.
    expect(a3X).toBeCloseTo(18.5, 1);
    expect(a5X).toBeCloseTo(42.25, 1);
  });

  it('draws each card at its real print height', async () => {
    // Built-in card ratio: 375 x 525 px printed at 34.5 mm wide.
    await exportDeckToPdf(
      ['a', 'b'],
      [
        { width: 375, height: 525 },
        { width: 375, height: 300 },
      ],
      { cardWidthMm: 34.5 },
    );
    const doc = jsPDFMock.mock.results[0].value as { addImage: ReturnType<typeof vi.fn> };
    const first = doc.addImage.mock.calls[0];
    const second = doc.addImage.mock.calls[1];

    expect(first[4]).toBeCloseTo(34.5, 1);
    expect(first[5]).toBeCloseTo(48.3, 1);
    expect(second[5]).toBeCloseTo(27.6, 1);
  });

  it('prints each mixed-style card at its own template width', async () => {
    await exportDeckToPdf(
      ['small', 'big'],
      [
        { width: 380, height: 1210 },
        { width: 1125, height: 2250 },
      ],
      { cardWidthMm: [34.9, 103.4] },
    );
    const doc = jsPDFMock.mock.results[0].value as { addImage: ReturnType<typeof vi.fn> };
    const small = doc.addImage.mock.calls[0];
    const big = doc.addImage.mock.calls[1];

    // The narrow card keeps its 34.9 mm width instead of being blown up to the
    // active/widest style, and both keep their own aspect ratio.
    expect(small[4]).toBeCloseTo(34.9, 1);
    expect(small[5]).toBeCloseTo(111.1, 1);
    expect(big[4]).toBeCloseTo(103.4, 1);
    expect(big[5]).toBeCloseTo(206.8, 1);

    // Cards are packed side by side at their real widths, so the configured
    // 2 mm gap is the actual space between their edges (no overlap, no cell
    // padding determined by the widest style).
    expect(small[2]).toBeCloseTo(34.85, 2);
    expect(big[2]).toBeCloseTo(71.75, 2);
    expect(big[2] - (small[2] + small[4])).toBeCloseTo(2, 1);
    // The tall card sets the row height; the short one is centred in it.
    expect(big[3]).toBeCloseTo(45.1, 1);
    expect(small[3]).toBeCloseTo(93, 0);
  });

  it('keeps the requested gap between cards of the same small style', async () => {
    await exportDeckToPdf(
      ['a', 'b', 'c'],
      [
        { width: 380, height: 1210 },
        { width: 380, height: 1210 },
        { width: 380, height: 1210 },
      ],
      { cardWidthMm: [34.9, 34.9, 34.9] },
    );
    const doc = jsPDFMock.mock.results[0].value as { addImage: ReturnType<typeof vi.fn> };
    const [first, second, third] = doc.addImage.mock.calls;

    // All three fit on one row: their edges are separated by exactly gapMm.
    expect(second[2] - (first[2] + first[4])).toBeCloseTo(2, 1);
    expect(third[2] - (second[2] + second[4])).toBeCloseTo(2, 1);
    expect(first[3]).toBeCloseTo(second[3], 1);
    expect(first[3]).toBeCloseTo(third[3], 1);
  });

  it('rejects a width array that does not match the deck', async () => {
    await expect(
      exportDeckToPdf(['a', 'b'], { width: 375, height: 525 }, { cardWidthMm: [34.5] }),
    ).rejects.toThrow(/Dimensions d'impression invalides/);
  });

  it('prints a 370 px tall card at 34 mm', async () => {
    await exportDeckToPdf(['a'], { width: 375, height: 370 }, { cardWidthMm: 34.5 });
    const doc = jsPDFMock.mock.results[0].value as { addImage: ReturnType<typeof vi.fn> };
    const call = doc.addImage.mock.calls[0];

    expect(call[4]).toBeCloseTo(34.5, 1);
    expect(call[5]).toBeCloseTo(34, 1);
  });

  it('uses the editable margin to size and center the grid', async () => {
    const ratio = { width: 63.5, height: 88.9 };
    const deck = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

    await exportDeckToPdf(deck, ratio, { paperSize: 'a4', marginMm: 0 });
    const tight = jsPDFMock.mock.results[0].value as {
      addImage: ReturnType<typeof vi.fn>;
      addPage: ReturnType<typeof vi.fn>;
    };
    // No margin: 3 columns fit on A4, so 7 cards stay on a single page.
    expect(tight.addPage).not.toHaveBeenCalled();
    expect(tight.addImage.mock.calls[0][2] as number).toBeCloseTo(7.75, 1);

    await exportDeckToPdf(deck, ratio, { paperSize: 'a4', marginMm: 10 });
    const padded = jsPDFMock.mock.results[1].value as {
      addImage: ReturnType<typeof vi.fn>;
      addPage: ReturnType<typeof vi.fn>;
    };
    // 10 mm margins: only 2 columns fit, so the 7th card needs a second page.
    expect(padded.addPage).toHaveBeenCalledTimes(1);
    expect(padded.addImage.mock.calls[0][2] as number).toBeCloseTo(40.5, 1);
  });

  it('lays out the grid for landscape sheets', async () => {
    const ratio = { width: 63.5, height: 88.9 };

    await exportDeckToPdf(['a'], ratio, { paperSize: 'a4', orientation: 'landscape' });
    expect(jsPDFMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ orientation: 'landscape', format: 'a4' }),
    );
    const doc = jsPDFMock.mock.results[0].value as { addImage: ReturnType<typeof vi.fn> };
    expect(doc.addImage.mock.calls[0][2] as number).toBeCloseTo(18.5, 1);
  });
});
