import { TemplateField } from '../types/template';

type ImageFieldMap = Map<string, TemplateField>;

function imageFieldMap(fields: TemplateField[]): ImageFieldMap {
  return new Map(
    fields.filter((field) => field.type === 'image').map((field) => [field.id, field]),
  );
}

/**
 * Returns the id of the field that owns the shared source for `fieldId`.
 * Broken links are ignored, and cycles resolve to the lexicographically first
 * id in the cycle so every member of the cycle agrees on one source.
 */
export function getImageLinkRootId(fieldId: string, fields: TemplateField[]): string {
  const byId = imageFieldMap(fields);
  if (!byId.has(fieldId)) return fieldId;

  const visitedAt = new Map<string, number>();
  const path: string[] = [];
  let currentId = fieldId;

  while (byId.has(currentId)) {
    const current = byId.get(currentId)!;
    if (!current.linkedTo || !byId.has(current.linkedTo)) break;

    if (visitedAt.has(currentId)) {
      const cycle = path.slice(visitedAt.get(currentId)!);
      return [...cycle].sort((a, b) => a.localeCompare(b))[0];
    }
    visitedAt.set(currentId, path.length);
    path.push(currentId);
    currentId = current.linkedTo;
  }

  return currentId;
}

/** Resolves a field to the image field that stores its actual source. */
export function resolveImageLinkRoot(field: TemplateField, fields: TemplateField[]): TemplateField {
  const rootId = getImageLinkRootId(field.id, fields);
  return imageFieldMap(fields).get(rootId) ?? field;
}

/** True when this image owns its source (rather than pointing to another image). */
export function isImageLinkRoot(field: TemplateField, fields: TemplateField[]): boolean {
  return getImageLinkRootId(field.id, fields) === field.id;
}

/** All image fields sharing the same source, including the root itself. */
export function getImageLinkMembers(rootId: string, fields: TemplateField[]): TemplateField[] {
  return fields.filter(
    (field) => field.type === 'image' && getImageLinkRootId(field.id, fields) === rootId,
  );
}

export interface ImageLinkGroup {
  root: TemplateField;
  members: TemplateField[];
}

/** Groups image fields by shared source, preserving field order. */
export function getImageLinkGroups(fields: TemplateField[]): ImageLinkGroup[] {
  const groups = new Map<string, TemplateField[]>();
  for (const field of fields) {
    if (field.type !== 'image') continue;
    const rootId = getImageLinkRootId(field.id, fields);
    const group = groups.get(rootId);
    if (group) group.push(field);
    else groups.set(rootId, [field]);
  }

  return Array.from(groups, ([rootId, members]) => ({
    root: members.find((field) => field.id === rootId) ?? members[0],
    members,
  }));
}

/** Image fields whose link chain passes through `fieldId`. */
export function getImageLinkDescendants(fieldId: string, fields: TemplateField[]): TemplateField[] {
  const byId = imageFieldMap(fields);
  const reachesAncestor = (candidate: TemplateField) => {
    const seen = new Set<string>();
    let currentId = candidate.linkedTo ?? '';
    while (currentId && byId.has(currentId) && !seen.has(currentId)) {
      if (currentId === fieldId) return true;
      seen.add(currentId);
      currentId = byId.get(currentId)!.linkedTo ?? '';
    }
    return false;
  };
  return fields.filter(
    (field) =>
      field.type === 'image' &&
      field.id !== fieldId &&
      Boolean(field.linkedTo) &&
      reachesAncestor(field),
  );
}

/** True when linking `fieldId` to `targetId` would create a cycle. */
export function wouldCreateImageLinkCycle(
  fieldId: string,
  targetId: string,
  fields: TemplateField[],
): boolean {
  if (fieldId === targetId) return true;
  const byId = imageFieldMap(fields);
  const seen = new Set<string>();
  let currentId = targetId;

  while (byId.has(currentId) && !seen.has(currentId)) {
    if (currentId === fieldId) return true;
    seen.add(currentId);
    const linkedTo = byId.get(currentId)!.linkedTo;
    if (!linkedTo || !byId.has(linkedTo)) break;
    currentId = linkedTo;
  }
  return false;
}

/**
 * Source stored on the shared root. For decks created before linking (or edited
 * outside the app), a value stored on another group member is used as a
 * fallback so the group still renders from one source.
 */
export function getSharedImageSource(
  field: TemplateField,
  fields: TemplateField[],
  values: Record<string, string>,
): string {
  const root = resolveImageLinkRoot(field, fields);
  if (values[root.id] !== undefined) return values[root.id];
  for (const member of getImageLinkMembers(root.id, fields)) {
    if (values[member.id] !== undefined) return values[member.id];
  }
  return root.defaultValue ?? '';
}

/**
 * A linked image group is editable in Card Mode when at least one of its
 * members is editable there. The source is then stored on the root field even
 * if the root itself is decorative.
 */
export function isImageSourceEditableInCard(
  field: TemplateField,
  fields: TemplateField[],
): boolean {
  const root = resolveImageLinkRoot(field, fields);
  return getImageLinkMembers(root.id, fields).some((member) => member.editableInCard !== false);
}

/** Ids of images that belong to a group with more than one member. */
export function getLinkedImageIds(fields: TemplateField[]): Set<string> {
  return new Set(
    getImageLinkGroups(fields)
      .filter((group) => group.members.length > 1)
      .flatMap((group) => group.members.map((member) => member.id)),
  );
}
