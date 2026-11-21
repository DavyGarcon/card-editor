import type { CardTemplatePack, TemplateField } from '../types/template';

const COPY_LABEL_SUFFIX = ' (Copie)';

/** Returns an id derived from the source that does not collide with existing fields. */
export function getDuplicateFieldId(sourceId: string, existingIds: Iterable<string>): string {
  const taken = new Set(existingIds);
  const baseId = `${sourceId}_copy`;
  if (!taken.has(baseId)) return baseId;
  let suffix = 2;
  while (taken.has(`${baseId}_${suffix}`)) suffix += 1;
  return `${baseId}_${suffix}`;
}

/** Copies every effective attribute of a field into a standalone local field. */
export function createDuplicatedField(field: TemplateField, id: string, z: number): TemplateField {
  // An inherited z-only override is replaced by a real, full local field.
  const attributes = { ...field };
  delete attributes.zOnly;
  return {
    ...attributes,
    id,
    label: `${field.label || field.id}${COPY_LABEL_SUFFIX}`,
    z,
    ...(field.options ? { options: field.options.map((option) => ({ ...option })) } : {}),
  };
}

/**
 * Adds a copy of `fieldId` to `styleKey`, directly above the original in the
 * component tree. Inherited fields keep working: their order is overridden
 * locally with the same `zOnly` mechanism used by drag reordering.
 */
export function duplicateFieldInStyle(
  pack: CardTemplatePack,
  styleKey: string,
  resolvedFields: TemplateField[],
  fieldId: string,
): { pack: CardTemplatePack; fieldId: string } | null {
  const displayOrder = resolvedFields
    .map((field, index) => ({ field, index }))
    .sort((a, b) => (b.field.z ?? b.index) - (a.field.z ?? a.index) || b.index - a.index)
    .map(({ field }) => field.id);
  const sourcePosition = displayOrder.indexOf(fieldId);
  if (sourcePosition < 0 || !pack.styles.some((style) => style.key === styleKey)) return null;

  const newId = getDuplicateFieldId(
    fieldId,
    resolvedFields.map((field) => field.id),
  );
  const nextOrder = [...displayOrder];
  nextOrder.splice(sourcePosition, 0, newId);

  const zById = new Map(
    nextOrder.map((id, displayIndex) => [id, nextOrder.length - 1 - displayIndex]),
  );
  const previousZById = new Map(
    displayOrder.map((id, displayIndex) => [id, displayOrder.length - 1 - displayIndex]),
  );
  const sourceField = resolvedFields.find((field) => field.id === fieldId);
  if (!sourceField) return null;
  const duplicate = createDuplicatedField(sourceField, newId, zById.get(newId)!);

  return {
    pack: {
      ...pack,
      styles: pack.styles.map((style) => {
        if (style.key !== styleKey) return style;
        let fields = [...style.fields, duplicate];
        for (const [id, z] of zById) {
          if (id === newId || previousZById.get(id) === z) continue;
          if (fields.some((field) => field.id === id)) {
            fields = fields.map((field) => (field.id === id ? { ...field, z } : field));
          } else {
            const baseField = resolvedFields.find((field) => field.id === id);
            if (baseField) fields = [...fields, { ...baseField, z, zOnly: true }];
          }
        }
        return { ...style, fields };
      }),
    },
    fieldId: newId,
  };
}
