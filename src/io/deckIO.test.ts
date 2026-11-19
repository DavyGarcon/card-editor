import { beforeEach, describe, expect, it } from 'vitest';
import { CardStyleDefinition } from '../types/template';
import { DECK_FORMAT, TEMPLATE_FORMAT } from './formats';
import { TEMPLATE_STORAGE_KEY } from './templateIO';
import {
  clearDeckSession,
  DeckSession,
  DECK_STORAGE_KEY,
  loadDeckSession,
  parseDeckSessionJson,
  saveDeckSession,
  serializeDeckSession,
} from './deckIO';

const styles: CardStyleDefinition[] = [
  {
    key: 'base',
    name: 'Base',
    width: 100,
    height: 100,
    fields: [{ id: 'rules', label: 'Rules', type: 'richtext', x: 0, y: 0, width: 10, height: 10 }],
  },
];

const session: DeckSession = {
  cards: [{ id: '1', styleKey: 'base', values: { title: 'Carte', rules: '<b>Feu</b>' } }],
  activeCardId: '1',
  name: 'Mon deck',
  templateName: 'Pack test',
  styleKeys: ['base'],
};

describe('deckIO', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('serializes and parses a deck file', () => {
    const json = serializeDeckSession(session);
    expect(JSON.parse(json).format).toBe(DECK_FORMAT);
    expect(parseDeckSessionJson(json, styles).cards).toEqual(session.cards);
  });

  it('requires the matching template to be loaded', () => {
    const json = serializeDeckSession({
      ...session,
      cards: [{ id: '2', styleKey: 'missing', values: {} }],
    });
    expect(() => parseDeckSessionJson(json, styles)).toThrow(/absent du template/);
  });

  it('rejects a template file', () => {
    expect(() =>
      parseDeckSessionJson(JSON.stringify({ format: TEMPLATE_FORMAT, pack: {} }), styles),
    ).toThrow(/contient un template/);
  });

  it('uses its own localStorage key and ignores corrupt data', () => {
    saveDeckSession(session);
    expect(localStorage.getItem(DECK_STORAGE_KEY)).toBeTruthy();
    expect(localStorage.getItem(TEMPLATE_STORAGE_KEY)).toBeNull();
    expect(loadDeckSession(session, styles).session.cards).toEqual(session.cards);

    localStorage.setItem(DECK_STORAGE_KEY, '{');
    const failed = loadDeckSession(session, styles);
    expect(failed.session.cards).toEqual(session.cards);
    expect(failed.error).toMatch(/illisible/);
    // The rejected payload must survive so the user can download it.
    expect(localStorage.getItem('modern-geckos-deck-recovery-v1')).toBe('{');
    clearDeckSession();
    expect(localStorage.getItem(DECK_STORAGE_KEY)).toBeNull();
  });

  it('reports autosave failures instead of swallowing them', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(saveDeckSession(session)).toBe(false);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
