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
  'src',
]);

function sanitizeOverrides(value: unknown): ComputedFieldOverrides {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value === undefined || value === null ? {} : { text: String(value) };
  }

  const result: ComputedFieldOverrides = {};
  const source = value as Record<string, unknown>;
  for (const key of OVERRIDE_KEYS) {
    const candidate = source[key as string];
    if (
      typeof candidate === 'string' ||
      typeof candidate === 'number' ||
      typeof candidate === 'boolean'
    ) {
      // Only plain primitives are forwarded to the renderer.
      (result as Record<string, unknown>)[key] = candidate;
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
