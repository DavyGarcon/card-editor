export const TEMPLATE_FORMAT = 'modern-geckos-template';
export const DECK_FORMAT = 'modern-geckos-deck';
export const FORMAT_VERSION = 1;

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'modern-geckos'
  );
}
