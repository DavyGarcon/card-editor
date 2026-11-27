/**
 * Scale at which a card fits entirely inside the preview's content box.
 * Small cards are never enlarged (100% is the upper bound); `null` means the
 * viewport has not been laid out yet, so no reliable fit can be computed.
 */
export function computeFitZoom(
  cardWidth: number,
  cardHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  padding = 0,
): number | null {
  if (
    !Number.isFinite(cardWidth) ||
    cardWidth <= 0 ||
    !Number.isFinite(cardHeight) ||
    cardHeight <= 0 ||
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight)
  ) {
    return null;
  }

  const availableWidth = viewportWidth - padding * 2;
  const availableHeight = viewportHeight - padding * 2;
  if (availableWidth <= 0 || availableHeight <= 0) return null;

  return Math.min(1, availableWidth / cardWidth, availableHeight / cardHeight);
}
