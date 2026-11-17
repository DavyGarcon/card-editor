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

export function evaluateFieldScript(
  script: string | undefined,
  context: {
    card: Record<string, string>;
    style: Record<string, unknown>;
    field: Record<string, unknown>;
  }
): ComputedFieldOverrides {
  if (!script || !script.trim()) {
    return {};
  }

  try {
    const normalizedBody = script.includes('return')
      ? script
      : `let value; ${script}; return typeof value === 'object' ? value : { text: String(value ?? '') };`;

    const fn = new Function('card', 'style', 'field', `"use strict";\n${normalizedBody}`);
    const result = fn(context.card, context.style, context.field);

    if (result && typeof result === 'object') {
      return result as ComputedFieldOverrides;
    }
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Erreur de script',
    };
  }
}
