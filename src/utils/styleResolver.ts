import { CardStyleDefinition, ResolvedCardStyle, TemplateField } from '../types/template';

/**
 * Resolves a style by recursively merging parent styles defined via `basedOn`.
 * Child fields with the same `id` override parent fields; new child fields are appended.
 */
export function resolveCardStyle(
  styleKey: string,
  allStyles: CardStyleDefinition[],
  visited: Set<string> = new Set(),
): ResolvedCardStyle {
  if (visited.has(styleKey)) {
    throw new Error(`Boucle d'héritage détectée (basedOn) sur le style "${styleKey}".`);
  }
  visited.add(styleKey);

  const current = allStyles.find((s) => s.key === styleKey);
  if (!current) {
    // An empty pack still needs a paintable fallback; a missing key on a real
    // pack is a data error and must not silently render with a random style.
    if (styleKey === '' && allStyles.length === 0) {
      return {
        key: 'default',
        name: 'Défaut',
        width: 375,
        height: 525,
        backgroundColor: '#1e293b',
        borderColor: '#f59e0b',
        fields: [],
      };
    }
    throw new Error(`Le style "${styleKey}" est absent du template chargé.`);
  }

  if (!current.basedOn) {
    return {
      key: current.key,
      name: current.name,
      width: current.width ?? 375,
      height: current.height ?? 525,
      backgroundColor: current.backgroundColor ?? '#1e293b',
      borderColor: current.borderColor ?? '#f59e0b',
      fields: current.fields.map((f) => ({ ...f })),
    };
  }

  const parent = resolveCardStyle(current.basedOn, allStyles, visited);

  const mergedFieldsMap = new Map<string, TemplateField>();
  for (const pf of parent.fields) {
    mergedFieldsMap.set(pf.id, { ...pf });
  }
  for (const cf of current.fields) {
    const existing = mergedFieldsMap.get(cf.id);
    if (existing) {
      // z-only overrides preserve every inherited property (including future
      // parent edits) and change just the stacking order.
      mergedFieldsMap.set(cf.id, cf.zOnly ? { ...existing, z: cf.z } : { ...existing, ...cf });
    } else {
      mergedFieldsMap.set(cf.id, { ...cf });
    }
  }

  return {
    key: current.key,
    name: current.name,
    basedOn: current.basedOn,
    width: current.width ?? parent.width,
    height: current.height ?? parent.height,
    backgroundColor: current.backgroundColor ?? parent.backgroundColor,
    borderColor: current.borderColor ?? parent.borderColor,
    fields: Array.from(mergedFieldsMap.values()),
  };
}
