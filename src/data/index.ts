import type { CardTemplatePack } from '../types/template';

export interface BuiltInTemplate {
  /** File name in `src/data`, used as a stable identifier. */
  id: string;
  pack: CardTemplatePack;
}

/**
 * Every `src/data/*.ts` module that exports a `pack` becomes a template
 * available at startup. No registry to maintain: dropping a new file in the
 * directory is enough. Templates are sorted alphabetically by pack name; the
 * first one is the default loaded at launch.
 */
// Negated patterns keep test files (and this loader itself) out of the app
// bundle: importing a test module in the browser would execute Vitest there.
const modules = import.meta.glob(['./*.ts', '!**/*.test.ts', '!**/index.ts'], {
  eager: true,
}) as Record<string, { pack?: CardTemplatePack }>;

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = Object.entries(modules)
  .map(([path, module]) =>
    module.pack ? { id: path.replace(/^\.\//, '').replace(/\.ts$/, ''), pack: module.pack } : null,
  )
  .filter((template): template is BuiltInTemplate => template !== null)
  .sort((a, b) => a.pack.name.localeCompare(b.pack.name, 'fr'));

/** Last-resort fallback if `src/data` contains no template module. */
export const EMPTY_PACK: CardTemplatePack = {
  name: 'Template vide',
  activeStyleKey: 'default',
  styles: [],
};
