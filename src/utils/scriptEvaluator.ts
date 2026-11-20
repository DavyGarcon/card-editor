import { interpretScript } from './scriptInterpreter';

export interface ComputedFieldOverrides {
  text?: string;
  visible?: boolean;
  color?: string;
  fill?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  opacity?: number;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  src?: string;
  error?: string;
}

const OVERRIDE_KEYS = new Set<keyof ComputedFieldOverrides>([
  'text',
  'visible',
  'color',
  'fill',
  'x',
  'y',
  'width',
  'height',
  'fontSize',
  'opacity',
  'rotation',
  'flipX',
  'flipY',
  'src',
]);

const MAX_OVERRIDE_TEXT_LENGTH = 100_000;

/**
 * Scripts come from imported packs. Allow only image sources that cannot send
 * card data to a third party: data/blob URLs or same-origin/relative paths.
 */
function isSafeImageSource(value: string): boolean {
  if (/^data:image\//i.test(value) || /^blob:/i.test(value)) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    try {
      if (!/^https?:$/i.test(new URL(value).protocol)) return false;
      const origin = globalThis.location?.origin;
      return !origin || new URL(value, origin).origin === origin;
    } catch {
      return false;
    }
  }
  return true; // relative path
}

function sanitizeOverrides(value: unknown): ComputedFieldOverrides {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value === undefined || value === null
      ? {}
      : { text: String(value).slice(0, MAX_OVERRIDE_TEXT_LENGTH) };
  }

  const result: ComputedFieldOverrides = {};
  const source = value as Record<string, unknown>;
  for (const key of OVERRIDE_KEYS) {
    const candidate = source[key as string];
    if (
      (key === 'visible' || key === 'flipX' || key === 'flipY') &&
      typeof candidate === 'boolean'
    ) {
      (result as Record<string, unknown>)[key] = candidate;
    } else if (key === 'text' && typeof candidate === 'string') {
      result.text = candidate.slice(0, MAX_OVERRIDE_TEXT_LENGTH);
    } else if (key === 'color' || key === 'fill') {
      if (typeof candidate === 'string') (result as Record<string, unknown>)[key] = candidate;
    } else if (key === 'src') {
      if (typeof candidate === 'string' && isSafeImageSource(candidate)) result.src = candidate;
    } else if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      const numberKey = key as 'x' | 'y' | 'width' | 'height' | 'fontSize' | 'opacity' | 'rotation';
      let number = candidate;
      if (numberKey === 'opacity') number = Math.min(1, Math.max(0, number));
      else if (numberKey === 'rotation') number = Math.min(360, Math.max(-360, number));
      else if (numberKey === 'fontSize' || numberKey === 'width' || numberKey === 'height') {
        number = Math.min(8192, Math.max(1, number));
      } else {
        number = Math.min(100_000, Math.max(-100_000, number));
      }
      (result as Record<string, unknown>)[key] = number;
    }
  }
  return result;
}

/**
 * Evaluates a field render script in a restricted interpreter. Untrusted packs
 * cannot reach the DOM, network, or host constructors.
 */
export function evaluateFieldScript(
  script: string | undefined,
  context: {
    card: Record<string, string>;
    style: Record<string, unknown>;
    field: Record<string, unknown>;
  },
): ComputedFieldOverrides {
  if (!script || !script.trim()) return {};

  try {
    const result = interpretScript(script, {
      card: context.card,
      style: context.style,
      field: context.field,
    });
    return sanitizeOverrides(result);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Erreur de script',
    };
  }
}
