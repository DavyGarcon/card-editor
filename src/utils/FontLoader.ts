/**
 * Dynamic Google Fonts & Custom Web Font Loader for Card Editor.
 * Ensures fonts are fetched and ready in `document.fonts` before Konva redraws.
 */

export interface FontDefinition {
  /** Font family name (e.g. "Cinzel", "MedievalSharp", "Roboto") */
  family: string;
  /** Optional weights to load (defaults to ['400', '700']) */
  weights?: string[];
  /** Optional category hint for UI pickers */
  category?: 'serif' | 'sans-serif' | 'display' | 'monospace';
}

/** Curated tabletop/gaming Google Fonts ready for templates */
export const DEFAULT_GAMING_FONTS: FontDefinition[] = [
  { family: 'Cinzel', weights: ['400', '700'], category: 'serif' },
  { family: 'MedievalSharp', weights: ['400'], category: 'display' },
  { family: 'Uncial Antiqua', weights: ['400'], category: 'display' },
  { family: 'Almendra', weights: ['400', '700'], category: 'serif' },
  { family: 'Crimson Text', weights: ['400', '600', '700'], category: 'serif' },
  { family: 'Orbitron', weights: ['400', '700'], category: 'sans-serif' },
  { family: 'Rajdhani', weights: ['400', '600', '700'], category: 'sans-serif' },
  { family: 'Press Start 2P', weights: ['400'], category: 'display' },
  { family: 'Inter', weights: ['400', '600', '700'], category: 'sans-serif' },
  { family: 'Fira Code', weights: ['400', '700'], category: 'monospace' },
];

const loadedFamilies = new Set<string>();
const pendingLoads = new Map<string, Promise<void>>();

/**
 * Builds a Google Fonts CSS2 URL for a given family and weight list.
 */
function buildGoogleFontUrl(family: string, weights: string[] = ['400', '700']): string {
  const encodedFamily = encodeURIComponent(family.trim()).replace(/%20/g, '+');
  const sortedWeights = [...new Set(weights)].sort().join(';');
  return `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@${sortedWeights}&display=swap`;
}

/**
 * Dynamically loads a Google Font and resolves once the browser font face is ready for Canvas/Konva.
 */
export function fontDefinitionFor(family: string): FontDefinition | undefined {
  return DEFAULT_GAMING_FONTS.find((font) => font.family === family.trim());
}

export async function loadGoogleFont(family: string, weights?: string[]): Promise<void> {
  const cleanFamily = family.trim();
  if (!cleanFamily) return;

  // Single-weight families (e.g. MedievalSharp) fail when CSS2 asks for 400;700.
  const resolvedWeights = weights ?? fontDefinitionFor(cleanFamily)?.weights ?? ['400', '700'];
  const cacheKey = `${cleanFamily}:${[...resolvedWeights].sort().join(',')}`;
  if (loadedFamilies.has(cacheKey)) return;

  const existingPromise = pendingLoads.get(cacheKey);
  if (existingPromise) return existingPromise;

  const loadPromise = (async () => {
    try {
      const weightKey = [...resolvedWeights].sort().join('-');
      const linkId = `google-font-${cleanFamily.toLowerCase().replace(/\s+/g, '-')}-${weightKey}`;
      let linkEl = document.getElementById(linkId) as HTMLLinkElement | null;

      if (!linkEl) {
        linkEl = document.createElement('link');
        linkEl.id = linkId;
        linkEl.rel = 'stylesheet';
        linkEl.href = buildGoogleFontUrl(cleanFamily, resolvedWeights);
        document.head.appendChild(linkEl);

        await new Promise<void>((resolve, reject) => {
          linkEl!.onload = () => resolve();
          linkEl!.onerror = () =>
            reject(new Error(`Failed to load stylesheet for font: ${cleanFamily}`));
        });
      }

      // Explicitly trigger FontFaceSet loading so Konva canvas draws with the real font immediately
      if ('fonts' in document) {
        await Promise.all(
          resolvedWeights.map((weight) => document.fonts.load(`${weight} 16px "${cleanFamily}"`)),
        );
        await document.fonts.ready;
      }

      loadedFamilies.add(cacheKey);
    } catch (err) {
      console.warn(`[FontLoader] Could not load font "${cleanFamily}":`, err);
    } finally {
      pendingLoads.delete(cacheKey);
    }
  })();

  pendingLoads.set(cacheKey, loadPromise);
  return loadPromise;
}

/**
 * Batch-loads an array of fonts (useful when importing a Template Pack JSON).
 */
export async function loadTemplateFonts(fonts: Array<string | FontDefinition>): Promise<void> {
  const tasks = fonts.map((entry) =>
    typeof entry === 'string' ? loadGoogleFont(entry) : loadGoogleFont(entry.family, entry.weights),
  );
  await Promise.all(tasks);
}

/**
 * Checks whether a font family has already been loaded via FontLoader.
 */
export function isFontLoaded(family: string, weights?: string[]): boolean {
  const cleanFamily = family.trim();
  const resolved = weights ?? fontDefinitionFor(cleanFamily)?.weights ?? ['400', '700'];
  return loadedFamilies.has(`${cleanFamily}:${[...resolved].sort().join(',')}`);
}
