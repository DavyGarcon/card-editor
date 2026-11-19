import { validateDeck, validateTemplatePack } from './templateValidation';
import type { DocumentSnapshot } from '../hooks/useUndoableDocument';

const STORAGE_KEY = 'modern-geckos-project-v1';

export interface SavedProject extends DocumentSnapshot {
  activeCardId?: string;
  activeStyleKey?: string;
  mode?: 'card' | 'template';
}

export function loadProject(fallback: DocumentSnapshot): SavedProject {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const data = parsed as Record<string, unknown>;
    const pack = validateTemplatePack(data.pack);
    const cards = validateDeck(data.cards, pack.styles);
    return {
      pack,
      cards,
      activeCardId: typeof data.activeCardId === 'string' ? data.activeCardId : cards[0]?.id,
      activeStyleKey:
        typeof data.activeStyleKey === 'string' ? data.activeStyleKey : pack.styles[0]?.key,
      mode: data.mode === 'template' ? 'template' : 'card',
    };
  } catch {
    return fallback;
  }
}

export function saveProject(project: SavedProject): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...project }));
  } catch {
    // Storage can be full or disabled — editing must keep working regardless.
  }
}

export function clearProject(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
