/**
 * Template canvases are authored so that 370 px prints as 34 mm
 * (about 276.4 DPI). Every template dimension uses this single scale.
 */
export const TEMPLATE_DPI = (370 * 25.4) / 34;

/** Converts a template width in pixels to its real print width in millimetres. */
export function templateWidthToMm(widthPx: number, dpi: number = TEMPLATE_DPI): number {
  return Math.round((widthPx / dpi) * 25.4 * 10) / 10;
}
