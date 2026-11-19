import {
  CardData,
  CardStyleDefinition,
  CardTemplatePack,
  FieldType,
  TemplateField,
} from '../types/template';
import { resolveCardStyle } from './styleResolver';
import { sanitizeRichText } from './sanitize';

const FIELD_TYPES: FieldType[] = ['text', 'box', 'select', 'image', 'richtext'];

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${path} doit être une chaîne non vide.`);
  }
  return value;
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`${path} doit être une chaîne.`);
  return value;
}

function requireNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} doit être un nombre.`);
  }
  return value;
}

function validateField(input: unknown, path: string): TemplateField {
  if (!isObject(input)) throw new Error(`${path} doit être un objet.`);
  const id = requireString(input.id, `${path}.id`);
  const type = input.type;
  if (!FIELD_TYPES.includes(type as FieldType)) {
    throw new Error(`${path}.type doit être l'un de : ${FIELD_TYPES.join(', ')}.`);
  }

  const field: TemplateField = {
    id,
    label: requireString(input.label, `${path}.label`),
    type: type as FieldType,
    x: requireNumber(input.x, `${path}.x`),
    y: requireNumber(input.y, `${path}.y`),
    width: requireNumber(input.width, `${path}.width`),
    height: requireNumber(input.height, `${path}.height`),
  };

  if (input.z !== undefined) field.z = requireNumber(input.z, `${path}.z`);
  if (input.fontSize !== undefined)
    field.fontSize = requireNumber(input.fontSize, `${path}.fontSize`);
  if (input.opacity !== undefined) {
    const opacity = requireNumber(input.opacity, `${path}.opacity`);
    field.opacity = Math.min(1, Math.max(0, opacity));
  }
  if (input.defaultValue !== undefined) {
    const defaultValue = optionalString(input.defaultValue, `${path}.defaultValue`) || '';
    field.defaultValue = field.type === 'richtext' ? sanitizeRichText(defaultValue) : defaultValue;
  }
  for (const key of ['color', 'fill', 'align', 'fontFamily'] as const) {
    if (input[key] !== undefined) {
      (field as unknown as Record<string, unknown>)[key] = optionalString(
        input[key],
        `${path}.${key}`,
      );
    }
  }
  if (typeof input.align === 'string' && !['left', 'center', 'right'].includes(input.align)) {
    throw new Error(`${path}.align doit être left, center ou right.`);
  }
  if (input.editableInCard !== undefined) {
    if (typeof input.editableInCard !== 'boolean')
      throw new Error(`${path}.editableInCard doit être un booléen.`);
    field.editableInCard = input.editableInCard;
  }
  if (input.script !== undefined) field.script = optionalString(input.script, `${path}.script`);
  if (input.options !== undefined) {
    if (!Array.isArray(input.options)) throw new Error(`${path}.options doit être un tableau.`);
    field.options = input.options.map((option, index) => {
      if (!isObject(option)) throw new Error(`${path}.options[${index}] doit être un objet.`);
      return {
        value: requireString(option.value, `${path}.options[${index}].value`),
        label: requireString(option.label, `${path}.options[${index}].label`),
      };
    });
  }

  return field;
}

function validateStyle(input: unknown, path: string): CardStyleDefinition {
  if (!isObject(input)) throw new Error(`${path} doit être un objet.`);
  if (!Array.isArray(input.fields)) throw new Error(`${path}.fields doit être un tableau.`);

  const style: CardStyleDefinition = {
    key: requireString(input.key, `${path}.key`),
    name: requireString(input.name, `${path}.name`),
    fields: input.fields.map((field, index) => validateField(field, `${path}.fields[${index}]`)),
  };
  if (input.basedOn !== undefined) style.basedOn = optionalString(input.basedOn, `${path}.basedOn`);
  for (const key of ['width', 'height'] as const) {
    if (input[key] !== undefined) style[key] = requireNumber(input[key], `${path}.${key}`);
  }
  for (const key of ['backgroundColor', 'borderColor'] as const) {
    if (input[key] !== undefined) style[key] = optionalString(input[key], `${path}.${key}`);
  }
  return style;
}

/** Validates and normalizes an imported template pack, throwing on bad input. */
export function validateTemplatePack(input: unknown): CardTemplatePack {
  if (!isObject(input)) throw new Error('Le fichier doit contenir un objet JSON.');
  if (!Array.isArray(input.styles) || input.styles.length === 0) {
    throw new Error('Le pack doit contenir au moins un style dans "styles".');
  }

  const pack: CardTemplatePack = {
    name: requireString(input.name, 'name'),
    styles: input.styles.map((style, index) => validateStyle(style, `styles[${index}]`)),
  };

  const seen = new Set<string>();
  for (const style of pack.styles) {
    if (seen.has(style.key)) throw new Error(`Clé de style dupliquée : "${style.key}".`);
    seen.add(style.key);
  }
  for (const style of pack.styles) {
    if (style.basedOn && !seen.has(style.basedOn)) {
      throw new Error(`Le style "${style.key}" hérite d'un style inexistant : "${style.basedOn}".`);
    }
    resolveCardStyle(style.key, pack.styles); // throws on inheritance cycles
  }

  if (input.activeStyleKey !== undefined) {
    const key = optionalString(input.activeStyleKey, 'activeStyleKey');
    if (key && seen.has(key)) pack.activeStyleKey = key;
  }
  return pack;
}

/** Validates and normalizes an imported deck. Accepts `{ cards: [...] }` or a bare array. */
export function validateDeck(input: unknown, styles: CardStyleDefinition[]): CardData[] {
  const rawCards = Array.isArray(input) ? input : isObject(input) ? input.cards : undefined;
  if (!Array.isArray(rawCards)) throw new Error('Le fichier doit contenir une liste de cartes.');

  const richTextIds = new Set(
    styles.flatMap((style) =>
      style.fields.filter((field) => field.type === 'richtext').map((field) => field.id),
    ),
  );

  return rawCards.map((card, index) => {
    if (!isObject(card)) throw new Error(`cards[${index}] doit être un objet.`);
    const id = requireString(card.id, `cards[${index}].id`);
    const styleKey = requireString(card.styleKey, `cards[${index}].styleKey`);
    const valuesRaw = card.values ?? {};
    if (!isObject(valuesRaw)) throw new Error(`cards[${index}].values doit être un objet.`);

    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(valuesRaw)) {
      if (typeof value !== 'string')
        throw new Error(`cards[${index}].values.${key} doit être une chaîne.`);
      values[key] = richTextIds.has(key) ? sanitizeRichText(value) : value;
    }
    return { id, styleKey, values };
  });
}
