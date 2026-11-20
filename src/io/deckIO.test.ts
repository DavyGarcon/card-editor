import { describe, expect, it } from 'vitest';
import { CardStyleDefinition } from '../types/template';
import { DECK_FORMAT, FORMAT_VERSION, TEMPLATE_FORMAT } from './formats';
import { DeckSession, parseDeckSessionJson, serializeDeckSession } from './deckIO';

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
  it('serializes and parses a deck file', () => {
    const json = serializeDeckSession(session);
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe(DECK_FORMAT);
    expect(parsed.version).toBe(FORMAT_VERSION);
    expect(parseDeckSessionJson(json, styles).cards).toEqual(session.cards);
  });

  it('requires the matching template to be loaded', () => {
    const json = serializeDeckSession({
      ...session,
      cards: [{ id: '2', styleKey: 'missing', values: {} }],
    });
    expect(() => parseDeckSessionJson(json, styles)).toThrow(/absent du template/);
  });

  it('remaps incompatible styles when explicitly requested', () => {
    const json = serializeDeckSession({
      ...session,
      cards: [{ id: '2', styleKey: 'missing', values: {} }],
    });
    const parsed = parseDeckSessionJson(json, styles, { remapIncompatible: true });
    expect(parsed.cards[0].styleKey).toBe('base');
    expect(parsed.remappedCount).toBe(1);
  });

  it('rejects a template file', () => {
    expect(() =>
      parseDeckSessionJson(JSON.stringify({ format: TEMPLATE_FORMAT, pack: {} }), styles),
    ).toThrow(/contient un template/);
  });
});
