import type { DocumentSnapshot } from '../hooks/useUndoableDocument';
import type { CardData, CardTemplatePack } from '../types/template';
import { validateDeck, validateTemplatePack } from '../utils/templateValidation';
import { resolveCardStyle } from '../utils/styleResolver';
import { FORMAT_VERSION, isObject } from './formats';

/**
 * The editor keeps one autosaved workspace in localStorage. Artwork is NOT
 * inlined here: cards/styles hold short `idb:` refs whose blobs live in
 * IndexedDB, so the stored JSON stays small enough for every keystroke.
 */
export const WORKSPACE_STORAGE_KEY = 'modern-geckos-workspace-v1';
export const WORKSPACE_FORMAT = 'modern-geckos-workspace';

export function saveWorkspace(snapshot: DocumentSnapshot): void {
  try {
    localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({
        format: WORKSPACE_FORMAT,
        version: FORMAT_VERSION,
        ...snapshot,
      }),
    );
  } catch {
    // Storage can be disabled or full; editing continues without persistence.
  }
}

/** Cards whose style disappeared keep working on the pack's active style. */
function normalizeCards(raw: unknown, pack: CardTemplatePack): CardData[] {
  const cards = validateDeck(raw, pack.styles);
  const available = new Set(pack.styles.map((style) => style.key));
  const fallback = pack.activeStyleKey ?? pack.styles[0].key;
  return cards.map((card) =>
    available.has(card.styleKey) ? card : { ...card, styleKey: fallback },
  );
}

/** Restores an autosaved session, or returns null when it is unusable. */
export function loadWorkspace(): DocumentSnapshot | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) return null;
    if (typeof parsed.format === 'string' && parsed.format !== WORKSPACE_FORMAT) return null;

    // Reuse the same validation as file imports; a corrupt autosave must never
    // leave the editor with an invalid pack.
    const pack = validateTemplatePack(parsed.pack);
    let cards: CardData[] = [];
    try {
      cards = normalizeCards(parsed.cards ?? [], pack);
    } catch {
      // A broken deck should not discard an otherwise valid template pack.
    }

    const styleKeys = new Set(pack.styles.map((style) => style.key));
    const candidateStyle = typeof parsed.activeStyleKey === 'string' ? parsed.activeStyleKey : '';
    const activeStyleKey = styleKeys.has(candidateStyle)
      ? candidateStyle
      : pack.activeStyleKey && styleKeys.has(pack.activeStyleKey)
        ? pack.activeStyleKey
        : pack.styles[0].key;

    const cardIds = new Set(cards.map((card) => card.id));
    const candidateCard = typeof parsed.activeCardId === 'string' ? parsed.activeCardId : '';
    const activeCardId = cardIds.has(candidateCard) ? candidateCard : (cards[0]?.id ?? '');

    const fieldIds = new Set(resolveCardStyle(activeStyleKey, pack.styles).fields.map((f) => f.id));
    const selectedFieldId =
      typeof parsed.selectedFieldId === 'string' && fieldIds.has(parsed.selectedFieldId)
        ? parsed.selectedFieldId
        : null;

    return {
      pack,
      cards,
      activeStyleKey,
      activeCardId,
      selectedFieldId,
      mode: parsed.mode === 'template' ? 'template' : 'card',
    };
  } catch {
    return null;
  }
}
