/** Template canvases are authored at 150 DPI (375 px = 63.5 mm). */
export const TEMPLATE_DPI = 150;

/** Converts a template width in pixels to its real print width in millimetres. */
export function templateWidthToMm(widthPx: number): number {
  return Math.round((widthPx / TEMPLATE_DPI) * 25.4 * 10) / 10;
}
