import {
  CardData,
  CardStyleDefinition,
  CardTemplatePack,
  CHECKBOX_CHECKED_VALUE,
  CHECKBOX_UNCHECKED_VALUE,
  FieldType,
  TemplateField,
} from '../types/template';
import { resolveCardStyle } from './styleResolver';
import { sanitizeRichText } from './sanitize';

const FIELD_TYPES: FieldType[] = ['text', 'box', 'select', 'image', 'richtext', 'checkbox'];

// Imported files are untrusted: keep geometry and payload sizes bounded so a
// malformed pack cannot freeze the tab or exhaust browser storage.
const MAX_DIMENSION = 8192;
const MAX_COORDINATE = 100_000;
const MAX_FONT_SIZE = 512;
const MAX_STYLES = 100;
const MAX_FIELDS_PER_STYLE = 200;
const MAX_CARDS = 5000;
const MAX_VALUE_LENGTH = 2_000_000;
const MAX_DEFAULT_VALUE_LENGTH = 100_000;
/** Exported images are inline Data URLs, so image values need a much larger bound. */
const MAX_EMBEDDED_IMAGE_LENGTH = 8_000_000;
const MAX_ID_LENGTH = 200;
const MAX_LABEL_LENGTH = 200;
const MAX_NAME_LENGTH = 300;
const MAX_SCRIPT_LENGTH = 20_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value: unknown, path: string, maxLength = MAX_ID_LENGTH): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${path} doit être une chaîne non vide.`);
  }
  if (value.length > maxLength) {
    throw new Error(`${path} dépasse la longueur maximale de ${maxLength} caractères.`);
  }
  return value;
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`${path} doit être une chaîne.`);
  return value;
}

function requireNumber(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} doit être un nombre.`);
  }
  if (value < min || value > max) {
    throw new Error(`${path} doit être compris entre ${min} et ${max}.`);
  }
  return value;
}

function requireShortString(value: unknown, path: string, maxLength: number): string {
  const text = optionalString(value, path) ?? '';
  if (text.length > maxLength) {
    throw new Error(`${path} dépasse la longueur maximale de ${maxLength} caractères.`);
  }
  return text;
}

/**
 * `partial` fields are overrides in a style with `basedOn`: they only need an
 * id and a type, the rest is inherited and checked on the resolved style.
 */
function validateField(input: unknown, path: string, partial = false): TemplateField {
  if (!isObject(input)) throw new Error(`${path} doit être un objet.`);
  const id = requireString(input.id, `${path}.id`);
  const type = input.type;
  if (!FIELD_TYPES.includes(type as FieldType)) {
    throw new Error(`${path}.type doit être l'un de : ${FIELD_TYPES.join(', ')}.`);
  }

  const field: TemplateField = { id } as TemplateField;
  if (type !== undefined) field.type = type as FieldType;
  if (input.label !== undefined) {
    field.label = requireString(input.label, `${path}.label`, MAX_LABEL_LENGTH);
  } else if (!partial) {
    throw new Error(`${path}.label doit être une chaîne non vide.`);
  }
  const geometry = [
    ['x', -MAX_COORDINATE, MAX_COORDINATE],
    ['y', -MAX_COORDINATE, MAX_COORDINATE],
    ['width', 1, MAX_DIMENSION],
    ['height', 1, MAX_DIMENSION],
  ] as const;
  for (const [key, min, max] of geometry) {
    if (input[key] !== undefined) {
      field[key] = requireNumber(input[key], `${path}.${key}`, min, max);
    } else if (!partial) {
      throw new Error(`${path}.${key} doit être un nombre.`);
    }
  }

  if (input.verticalAlign !== undefined) {
    if (!['top', 'middle', 'bottom'].includes(String(input.verticalAlign))) {
      throw new Error(`${path}.verticalAlign doit être top, middle ou bottom.`);
    }
    field.verticalAlign = input.verticalAlign as 'top' | 'middle' | 'bottom';
  }
  if (input.lineHeight !== undefined)
    field.lineHeight = requireNumber(input.lineHeight, `${path}.lineHeight`, 0.5, 5);
  if (input.letterSpacing !== undefined)
    field.letterSpacing = requireNumber(input.letterSpacing, `${path}.letterSpacing`, -100, 100);
  if (input.strokeWidth !== undefined)
    field.strokeWidth = requireNumber(input.strokeWidth, `${path}.strokeWidth`, 0, 100);
  if (input.stroke !== undefined) field.stroke = optionalString(input.stroke, `${path}.stroke`);
  if (input.rotation !== undefined)
    field.rotation = requireNumber(input.rotation, `${path}.rotation`, -360, 360);
  for (const key of ['flipX', 'flipY'] as const) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== 'boolean') throw new Error(`${path}.${key} doit être un booléen.`);
      field[key] = input[key];
    }
  }
  if (input.z !== undefined)
    field.z = requireNumber(input.z, `${path}.z`, -MAX_COORDINATE, MAX_COORDINATE);
  if (input.zOnly !== undefined) {
    if (typeof input.zOnly !== 'boolean') throw new Error(`${path}.zOnly doit être un booléen.`);
    field.zOnly = input.zOnly;
  }
  if (input.fontSize !== undefined)
    field.fontSize = requireNumber(input.fontSize, `${path}.fontSize`, 1, MAX_FONT_SIZE);
  if (input.opacity !== undefined) {
    const opacity = requireNumber(input.opacity, `${path}.opacity`, 0, 1);
    field.opacity = Math.min(1, Math.max(0, opacity));
  }
  if (input.defaultValue !== undefined) {
    const limit =
      field.type === 'image'
        ? Math.max(MAX_DEFAULT_VALUE_LENGTH, MAX_EMBEDDED_IMAGE_LENGTH)
        : field.type === 'richtext'
          ? MAX_VALUE_LENGTH
          : MAX_DEFAULT_VALUE_LENGTH;
    const defaultValue = requireShortString(input.defaultValue, `${path}.defaultValue`, limit);
    if (
      field.type === 'checkbox' &&
      defaultValue !== '' &&
      defaultValue !== CHECKBOX_CHECKED_VALUE &&
      defaultValue !== CHECKBOX_UNCHECKED_VALUE
    ) {
      throw new Error(`${path}.defaultValue doit être "true" ou "false" pour une case à cocher.`);
    }
    field.defaultValue =
      field.type === 'checkbox'
        ? defaultValue || CHECKBOX_UNCHECKED_VALUE
        : field.type === 'richtext'
          ? sanitizeRichText(defaultValue)
          : defaultValue;
  }
  if (input.linkedTo !== undefined) {
    if (field.type !== 'image') {
      throw new Error(`${path}.linkedTo ne s'applique qu'aux images.`);
    }
    // An empty string is the JSON-safe "no link" override: it can replace an
    // inherited link, which an omitted/undefined property cannot do.
    field.linkedTo = requireShortString(input.linkedTo, `${path}.linkedTo`, MAX_ID_LENGTH);
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
  if (input.hidden !== undefined) {
    if (typeof input.hidden !== 'boolean') throw new Error(`${path}.hidden doit être un booléen.`);
    field.hidden = input.hidden;
  }
  if (input.script !== undefined)
    field.script = requireShortString(input.script, `${path}.script`, MAX_SCRIPT_LENGTH);
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
  if (input.fields.length > MAX_FIELDS_PER_STYLE) {
    throw new Error(`${path}.fields dépasse ${MAX_FIELDS_PER_STYLE} calques.`);
  }

  const basedOn =
    input.basedOn !== undefined ? optionalString(input.basedOn, `${path}.basedOn`) : undefined;
  const style: CardStyleDefinition = {
    key: requireString(input.key, `${path}.key`),
    name: requireString(input.name, `${path}.name`, MAX_NAME_LENGTH),
    fields: input.fields.map((field, index) =>
      validateField(field, `${path}.fields[${index}]`, Boolean(basedOn)),
    ),
  };
  const fieldIds = new Set<string>();
  for (const field of style.fields) {
    if (fieldIds.has(field.id)) {
      throw new Error(`${path} contient deux calques avec l'identifiant "${field.id}".`);
    }
    fieldIds.add(field.id);
  }
  if (basedOn !== undefined) style.basedOn = basedOn;
  for (const key of ['width', 'height'] as const) {
    if (input[key] !== undefined)
      style[key] = requireNumber(input[key], `${path}.${key}`, 1, MAX_DIMENSION);
  }
  for (const key of ['backgroundColor', 'borderColor'] as const) {
    if (input[key] !== undefined) style[key] = optionalString(input[key], `${path}.${key}`);
  }
  return style;
}

/** Linked images must target another image in the same resolved style. */
function validateImageLinks(fields: TemplateField[], path: string): void {
  const byId = new Map(fields.map((field) => [field.id, field]));
  for (const field of fields) {
    if (!field.linkedTo) continue;
    if (field.type !== 'image') {
      throw new Error(`${path}.${field.id}.linkedTo ne s'applique qu'aux images.`);
    }
    const target = byId.get(field.linkedTo);
    if (!target || target.type !== 'image') {
      throw new Error(
        `${path}.${field.id}.linkedTo référence une image inexistante : "${field.linkedTo}".`,
      );
    }

    const seen = new Set<string>();
    let current: TemplateField | undefined = field;
    while (current?.linkedTo) {
      if (seen.has(current.id)) {
        throw new Error(`${path} contient une boucle de liens d'images sur "${current.id}".`);
      }
      seen.add(current.id);
      current = byId.get(current.linkedTo);
      if (!current || current.type !== 'image') break;
    }
  }
}

/** Validates and normalizes an imported template pack, throwing on bad input. */
export function validateTemplatePack(input: unknown): CardTemplatePack {
  if (!isObject(input)) throw new Error('Le fichier doit contenir un objet JSON.');
  if (!Array.isArray(input.styles) || input.styles.length === 0) {
    throw new Error('Le pack doit contenir au moins un style dans "styles".');
  }
  if (input.styles.length > MAX_STYLES) {
    throw new Error(`Le pack dépasse ${MAX_STYLES} styles.`);
  }

  const pack: CardTemplatePack = {
    name: requireString(input.name, 'name', MAX_NAME_LENGTH),
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
    // Throws on inheritance cycles; resolved fields also include inherited
    // images, which may be link targets.
    const resolved = resolveCardStyle(style.key, pack.styles);
    // Partial overrides are valid only if the merged field is complete, so a
    // hand-written override cannot leave a layer without geometry or type.
    resolved.fields.forEach((field, index) => {
      validateField(field, `styles[${style.key}].fields[${index}] (résolu)`);
    });
    validateImageLinks(resolved.fields, `styles[${style.key}]`);
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
  if (rawCards.length > MAX_CARDS) {
    throw new Error(`Le deck dépasse ${MAX_CARDS} cartes.`);
  }

  const richTextIds = new Set(
    styles.flatMap((style) =>
      style.fields.filter((field) => field.type === 'richtext').map((field) => field.id),
    ),
  );

  const seenIds = new Set<string>();
  return rawCards.map((card, index) => {
    if (!isObject(card)) throw new Error(`cards[${index}] doit être un objet.`);
    const id = requireString(card.id, `cards[${index}].id`);
    if (seenIds.has(id)) {
      throw new Error(`Identifiant de carte dupliqué : "${id}".`);
    }
    seenIds.add(id);
    const styleKey = requireString(card.styleKey, `cards[${index}].styleKey`);
    const valuesRaw = card.values ?? {};
    if (!isObject(valuesRaw)) throw new Error(`cards[${index}].values doit être un objet.`);

    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(valuesRaw)) {
      if (typeof value !== 'string')
        throw new Error(`cards[${index}].values.${key} doit être une chaîne.`);
      const limit =
        value.startsWith('data:image/') && !richTextIds.has(key)
          ? Math.max(MAX_VALUE_LENGTH, MAX_EMBEDDED_IMAGE_LENGTH)
          : MAX_VALUE_LENGTH;
      if (value.length > limit) {
        throw new Error(`cards[${index}].values.${key} dépasse la taille maximale autorisée.`);
      }
      values[key] = richTextIds.has(key) ? sanitizeRichText(value) : value;
    }
    return { id, styleKey, values };
  });
}
