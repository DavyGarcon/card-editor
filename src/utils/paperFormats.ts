/**
 * Paper sizes offered by the PDF options dialog, with their real dimensions
 * in millimetres. The `id` values are the format names understood by jsPDF.
 */
export const PAPER_FORMATS = [
  { id: 'a0', label: 'A0 (841 × 1189 mm)', widthMm: 841, heightMm: 1189 },
  { id: 'a1', label: 'A1 (594 × 841 mm)', widthMm: 594, heightMm: 841 },
  { id: 'a2', label: 'A2 (420 × 594 mm)', widthMm: 420, heightMm: 594 },
  { id: 'a3', label: 'A3 (297 × 420 mm)', widthMm: 297, heightMm: 420 },
  { id: 'a4', label: 'A4 (210 × 297 mm)', widthMm: 210, heightMm: 297 },
  { id: 'a5', label: 'A5 (148 × 210 mm)', widthMm: 148, heightMm: 210 },
  { id: 'a6', label: 'A6 (105 × 148 mm)', widthMm: 105, heightMm: 148 },
  { id: 'a7', label: 'A7 (74 × 105 mm)', widthMm: 74, heightMm: 105 },
  { id: 'a8', label: 'A8 (52 × 74 mm)', widthMm: 52, heightMm: 74 },
  { id: 'a9', label: 'A9 (37 × 52 mm)', widthMm: 37, heightMm: 52 },
  { id: 'a10', label: 'A10 (26 × 37 mm)', widthMm: 26, heightMm: 37 },
  { id: 'letter', label: 'Letter (215.9 × 279.4 mm)', widthMm: 215.9, heightMm: 279.4 },
  { id: 'legal', label: 'Legal (215.9 × 355.6 mm)', widthMm: 215.9, heightMm: 355.6 },
  { id: 'tabloid', label: 'Tabloid (279.4 × 431.8 mm)', widthMm: 279.4, heightMm: 431.8 },
] as const;

export type PaperSize = (typeof PAPER_FORMATS)[number]['id'];

export interface PaperFormat {
  id: PaperSize;
  label: string;
  widthMm: number;
  heightMm: number;
}

export type PaperOrientation = 'portrait' | 'landscape';

/** Resolves a paper size to its dimensions, falling back to A4 for stale files. */
export function getPaperFormat(size: PaperSize): PaperFormat {
  return (
    PAPER_FORMATS.find((format) => format.id === size) ??
    PAPER_FORMATS.find((format) => format.id === 'a4')!
  );
}

/** Page dimensions for a format in the chosen orientation. */
export function getPaperDimensions(size: PaperSize, orientation: PaperOrientation = 'portrait') {
  const format = getPaperFormat(size);
  return orientation === 'landscape'
    ? { widthMm: format.heightMm, heightMm: format.widthMm }
    : { widthMm: format.widthMm, heightMm: format.heightMm };
}
