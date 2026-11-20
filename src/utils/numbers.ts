/** Numeric inputs can transiently be empty or non-finite; keep documents valid. */
export function clampNumber(raw: string, fallback: number, min: number, max: number): number {
  if (raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
