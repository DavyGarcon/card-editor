import { describe, expect, it } from 'vitest';
import { exportDeckToPdf } from './pdfExporter';

describe('exportDeckToPdf', () => {
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
});
