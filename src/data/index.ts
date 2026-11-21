import type { CardTemplatePack } from '../types/template';
import { isObject } from '../io/formats';
import { validateTemplatePack } from '../utils/templateValidation';

export interface BuiltInTemplate {
  /** JSON file name in `src/data`, used as a stable identifier. */
  id: string;
  pack: CardTemplatePack;
}

/**
 * Every `src/data/*.json` file becomes a template available at startup. No
 * registry to maintain: dropping a JSON file in the directory is enough. A file
 * may be a bare pack or a full saved template session. Templates are sorted
 * alphabetically by pack name; the first one is the default loaded at launch.
 */
// Test JSON files are excluded so they never leak into the app bundle.
const jsonModules = import.meta.glob(['./*.json', '!**/*.test.json'], {
  eager: true,
}) as Record<string, { default?: unknown }>;

function fileId(path: string): string {
  return path.replace(/^\.\//, '').replace(/\.json$/, '');
}

function packFromJsonModule(module: { default?: unknown }): CardTemplatePack | null {
  // Vite may expose the parsed JSON directly or under `default`, depending on
  // how the module is consumed. Unwrap `pack` when present, then validate the
  // resulting pack with the same schema used everywhere else.
  const exported = module.default ?? module;
  try {
    const value = typeof exported === 'string' ? JSON.parse(exported) : exported;
    if (!isObject(value)) return null;
    return validateTemplatePack(isObject(value.pack) ? value.pack : value);
  } catch (error) {
    console.error('Template JSON invalide dans src/data :', error);
    return null;
  }
}

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = Object.entries(jsonModules)
  .map(([path, module]) => ({ path, pack: packFromJsonModule(module) }))
  .filter((entry): entry is { path: string; pack: CardTemplatePack } => entry.pack !== null)
  .map(({ path, pack }) => ({ id: fileId(path), pack }))
  .sort((a, b) => a.pack.name.localeCompare(b.pack.name, 'fr'));

/** Last-resort fallback if `src/data` contains no template file. */
export const EMPTY_PACK: CardTemplatePack = {
  name: 'Template vide',
  activeStyleKey: 'default',
  styles: [],
};
