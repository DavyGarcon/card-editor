import { beforeEach, describe, expect, it } from 'vitest';
import { CardTemplatePack } from '../types/template';
import { DECK_STORAGE_KEY } from './deckIO';
import { DECK_FORMAT, TEMPLATE_FORMAT } from './formats';
import {
  clearTemplateSession,
  loadTemplateSession,
  parseTemplateSessionJson,
  saveTemplateSession,
  serializeTemplateSession,
  TEMPLATE_STORAGE_KEY,
  TemplateSession,
} from './templateIO';

const pack: CardTemplatePack = {
  name: 'Pack test',
  activeStyleKey: 'base',
  styles: [
    {
      key: 'base',
      name: 'Base',
      width: 375,
      height: 525,
      backgroundColor: '#1e293b',
      borderColor: '#f59e0b',
      fields: [{ id: 'title', label: 'Titre', type: 'text', x: 0, y: 0, width: 100, height: 20 }],
    },
  ],
};

const session: TemplateSession = { pack, activeStyleKey: 'base', mode: 'template' };

describe('templateIO', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('serializes and parses a template file', () => {
    const json = serializeTemplateSession(session);
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe(TEMPLATE_FORMAT);
    expect(parsed.pack.name).toBe('Pack test');
    expect(parseTemplateSessionJson(json)).toEqual(session);
  });

  it('rejects a deck file', () => {
    expect(() =>
      parseTemplateSessionJson(JSON.stringify({ format: DECK_FORMAT, cards: [] })),
    ).toThrow(/deck de cartes/);
  });

  it('still accepts a legacy single-style template', () => {
    const legacy = JSON.stringify({
      name: 'Ancien template',
      fields: [{ id: 'title', label: 'Titre', type: 'text', x: 0, y: 0, width: 10, height: 10 }],
    });
    expect(parseTemplateSessionJson(legacy).pack.styles[0].key).toBe('default');
  });

  it('uses its own localStorage key and ignores corrupt data', () => {
    saveTemplateSession(session);
    expect(localStorage.getItem(TEMPLATE_STORAGE_KEY)).toBeTruthy();
    expect(localStorage.getItem(DECK_STORAGE_KEY)).toBeNull();
    expect(loadTemplateSession(session).session).toEqual(session);

    localStorage.setItem(TEMPLATE_STORAGE_KEY, 'not json');
    const failed = loadTemplateSession(session);
    expect(failed.session).toEqual(session);
    expect(failed.error).toMatch(/illisible/);
    expect(localStorage.getItem('modern-geckos-template-recovery-v1')).toBe('not json');
    clearTemplateSession();
    expect(localStorage.getItem(TEMPLATE_STORAGE_KEY)).toBeNull();
  });

  it('reports autosave failures instead of swallowing them', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(saveTemplateSession(session)).toBe(false);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
