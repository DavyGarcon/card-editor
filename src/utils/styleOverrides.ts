import type { CardStyleDefinition, CardTemplatePack, TemplateField } from '../types/template';
import { resolveCardStyle } from './styleResolver';

const STYLE_KEYS = ['width', 'height', 'backgroundColor', 'borderColor'] as const;

/** Structural equality that treats a missing key and an `undefined` value alike. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => sameValue(item, b[index]));
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a).filter((key) => (a as Record<string, unknown>)[key] !== undefined);
    const bKeys = Object.keys(b).filter((key) => (b as Record<string, unknown>)[key] !== undefined);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) =>
      sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    );
  }
  return false;
}

function withoutDefaultZOnly(field: TemplateField): TemplateField {
  if (field.zOnly !== false) return field;
  const copy = { ...field };
  delete copy.zOnly;
  return copy;
}

/**
 * Returns the smallest definition of `field` that produces the same result on
 * top of `parent`. A `null` result means the field is unchanged and can be
 * dropped entirely, letting the resolver load it from the parent style.
 */
function fieldOverride(
  field: TemplateField,
  parent: TemplateField | undefined,
): TemplateField | null {
  // A new field has nothing to inherit; keep its full definition.
  if (!parent) return withoutDefaultZOnly(field);

  // The resolver ignores every property of a z-only override except `z`, so
  // there is no point in serializing the other copied properties.
  if (field.zOnly === true) {
    if (sameValue(field.z, parent.z) && parent.zOnly !== true) return null;
    return { id: field.id, type: parent.type, z: field.z, zOnly: true } as TemplateField;
  }

  const override = { id: field.id, type: field.type } as TemplateField;
  let hasChange = !sameValue(field.type, parent.type);
  for (const [key, value] of Object.entries(field)) {
    if (key === 'id' || key === 'type' || value === undefined) continue;
    // `zOnly: false` is the default; only keep it to clear an inherited flag.
    if (key === 'zOnly' && value === false && parent.zOnly !== true) continue;
    if (!sameValue(value, (parent as unknown as Record<string, unknown>)[key])) {
      (override as unknown as Record<string, unknown>)[key] = value;
      hasChange = true;
    }
  }
  if (parent.zOnly === true && override.zOnly === undefined) {
    override.zOnly = false;
    hasChange = true;
  }
  return hasChange ? override : null;
}

/**
 * Rewrites a child style with `basedOn` so it only stores what actually differs
 * from its parent. Unchanged fields and properties are loaded from the parent
 * at render time by `resolveCardStyle`.
 */
export function createMinimalChildStyle(
  style: CardStyleDefinition,
  allStyles: CardStyleDefinition[],
): CardStyleDefinition {
  if (!style.basedOn) return style;

  let parent;
  try {
    parent = resolveCardStyle(style.basedOn, allStyles);
  } catch {
    // An invalid parent is reported by import validation; don't lose data here.
    return style;
  }

  const parentFields = new Map(parent.fields.map((field) => [field.id, field]));
  const fields: TemplateField[] = [];
  for (const field of style.fields) {
    const override = fieldOverride(field, parentFields.get(field.id));
    if (override) fields.push(override);
  }

  const compacted = {
    key: style.key,
    name: style.name,
    ...(style.basedOn !== undefined ? { basedOn: style.basedOn } : {}),
    fields,
  } as CardStyleDefinition;
  const writable = compacted as unknown as Record<string, unknown>;
  for (const key of STYLE_KEYS) {
    const value = style[key];
    if (value !== undefined && !sameValue(value, parent[key])) {
      writable[key] = value;
    }
  }
  return compacted;
}

/** Applies the minimal-override rewrite to every child style in a pack. */
export function createMinimalTemplatePack(pack: CardTemplatePack): CardTemplatePack {
  return {
    ...pack,
    styles: pack.styles.map((style) => createMinimalChildStyle(style, pack.styles)),
  };
}
