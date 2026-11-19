import { CardData, CardStyleDefinition } from '../types/template';
import { validateDeck } from '../utils/templateValidation';
import { downloadJsonFile, jsonFileName, readTextFile } from './fileIO';
import { DECK_FORMAT, FORMAT_VERSION, isObject, TEMPLATE_FORMAT } from './formats';

export const DECK_STORAGE_KEY = 'modern-geckos-deck-v1';

export interface DeckSession {
  cards: CardData[];
  activeCardId?: string;
  name?: string;
  templateName?: string;
  styleKeys?: string[];
}

function rejectOtherFormat(parsed: unknown): void {
  if (!isObject(parsed) || typeof parsed.format !== 'string') return;
  if (parsed.format === TEMPLATE_FORMAT) {
    throw new Error('Ce fichier contient un template, pas un deck de cartes.');
  }
  if (parsed.format !== DECK_FORMAT) {
    throw new Error(`Format de fichier non reconnu : ${parsed.format}.`);
  }
}

export function parseDeckSessionJson(json: string, styles: CardStyleDefinition[]): DeckSession {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Fichier JSON invalide.');
  }
  rejectOtherFormat(parsed);

  const wrapper = isObject(parsed) ? parsed : {};
  const cards = validateDeck(parsed, styles);
  const availableKeys = new Set(styles.map((style) => style.key));
  for (const card of cards) {
    if (!availableKeys.has(card.styleKey)) {
      throw new Error(
        `La carte "${card.values.title || card.id}" utilise le style "${card.styleKey}" absent du template chargé. Chargez d'abord le template correspondant.`,
      );
    }
  }

  const candidateId =
    typeof wrapper.activeCardId === 'string' ? wrapper.activeCardId : cards[0]?.id || '';
  const rawTemplate = isObject(wrapper.template) ? wrapper.template : {};
  return {
    cards,
    activeCardId: cards.some((card) => card.id === candidateId) ? candidateId : cards[0]?.id,
    name: typeof wrapper.name === 'string' ? wrapper.name : undefined,
    templateName: typeof rawTemplate.name === 'string' ? rawTemplate.name : undefined,
    styleKeys: Array.isArray(rawTemplate.styleKeys)
      ? rawTemplate.styleKeys.filter((key): key is string => typeof key === 'string')
      : undefined,
  };
}

export function serializeDeckSession(session: DeckSession): string {
  return JSON.stringify(
    {
      format: DECK_FORMAT,
      version: FORMAT_VERSION,
      name: session.name || 'Deck',
      template: {
        name: session.templateName || '',
        styleKeys: session.styleKeys || [],
      },
      cards: session.cards,
      activeCardId: session.activeCardId,
    },
    null,
    2,
  );
}

export async function loadDeckFile(
  file: File,
  styles: CardStyleDefinition[],
): Promise<DeckSession> {
  return parseDeckSessionJson(await readTextFile(file), styles);
}

export function saveDeckFile(session: DeckSession): void {
  const name = session.name || session.templateName || 'deck';
  downloadJsonFile(jsonFileName(name, 'deck'), serializeDeckSession(session));
}

export function loadDeckSession(fallback: DeckSession, styles: CardStyleDefinition[]): DeckSession {
  try {
    const raw = localStorage.getItem(DECK_STORAGE_KEY);
    return raw ? parseDeckSessionJson(raw, styles) : fallback;
  } catch {
    return fallback;
  }
}

export function saveDeckSession(session: DeckSession): void {
  try {
    localStorage.setItem(DECK_STORAGE_KEY, serializeDeckSession(session));
  } catch {
    // Storage can be full or disabled — editing must keep working regardless.
  }
}

export function clearDeckSession(): void {
  try {
    localStorage.removeItem(DECK_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
