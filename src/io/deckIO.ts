import { CardData, CardStyleDefinition } from '../types/template';
import { validateDeck } from '../utils/templateValidation';
import { downloadJsonFile, jsonFileName, readTextFile } from './fileIO';
import { embedImageRefs } from './imageEmbedding';
import { DECK_FORMAT, FORMAT_VERSION, isObject, TEMPLATE_FORMAT } from './formats';

export interface DeckSession {
  cards: CardData[];
  activeCardId?: string;
  name?: string;
  templateName?: string;
  styleKeys?: string[];
  /** Cards whose style key was remapped to a style present in the current template. */
  remappedCount?: number;
}

export interface ParseDeckOptions {
  /** Remap cards using unknown styles instead of rejecting the whole deck. */
  remapIncompatible?: boolean;
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

export function parseDeckSessionJson(
  json: string,
  styles: CardStyleDefinition[],
  options: ParseDeckOptions = {},
): DeckSession {
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
  const fallbackKey = styles[0]?.key ?? '';
  let remappedCount = 0;
  for (const card of cards) {
    if (availableKeys.has(card.styleKey)) continue;
    if (!options.remapIncompatible) {
      throw new Error(
        `La carte "${card.values.title || card.id}" utilise le style "${card.styleKey}" absent du template chargé. Chargez d'abord le template correspondant.`,
      );
    }
    card.styleKey = fallbackKey;
    remappedCount++;
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
    remappedCount,
  };
}

export async function serializeDeckSession(session: DeckSession): Promise<string> {
  // Cards hold local `idb:` refs in the editor; write the image bytes inline so
  // the exported deck works on another machine without the source IndexedDB.
  const cards = await embedImageRefs(session.cards);
  return JSON.stringify(
    {
      format: DECK_FORMAT,
      version: FORMAT_VERSION,
      name: session.name || 'Deck',
      template: {
        name: session.templateName || '',
        styleKeys: session.styleKeys || [],
      },
      cards,
      activeCardId: session.activeCardId,
    },
    null,
    2,
  );
}

export async function loadDeckFile(
  file: File,
  styles: CardStyleDefinition[],
  options: ParseDeckOptions = {},
): Promise<DeckSession> {
  return parseDeckSessionJson(await readTextFile(file), styles, options);
}

export async function saveDeckFile(session: DeckSession): Promise<void> {
  const name = session.name || session.templateName || 'deck';
  downloadJsonFile(jsonFileName(name, 'deck'), await serializeDeckSession(session));
}
