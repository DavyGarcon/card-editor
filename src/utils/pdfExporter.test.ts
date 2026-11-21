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
    // Built-in card ratio: 375 x 525 px printed at 63.5 mm wide.
    await exportDeckToPdf(
      ['a', 'b'],
      [
        { width: 375, height: 525 },
        { width: 375, height: 300 },
      ],
    );
    const doc = jsPDFMock.mock.results[0].value as { addImage: ReturnType<typeof vi.fn> };
    const first = doc.addImage.mock.calls[0];
    const second = doc.addImage.mock.calls[1];

    expect(first[4]).toBeCloseTo(63.5, 1);
    expect(first[5]).toBeCloseTo(88.9, 1);
    expect(second[5]).toBeCloseTo(50.8, 1);
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
