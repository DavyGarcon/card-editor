import { describe, expect, it } from 'vitest';
import { CardTemplatePack } from '../types/template';
import { DECK_FORMAT, TEMPLATE_FORMAT, FORMAT_VERSION } from './formats';
import { parseTemplateSessionJson, serializeTemplateSession, TemplateSession } from './templateIO';

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
  it('serializes and parses a template file', () => {
    const json = serializeTemplateSession(session);
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe(TEMPLATE_FORMAT);
    expect(parsed.version).toBe(FORMAT_VERSION);
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

  it('rejects an old combined project file', () => {
    const legacyProject = JSON.stringify({ template: session, deck: { cards: [] } });
    expect(() => parseTemplateSessionJson(legacyProject)).toThrow(/styles/);
  });
});
