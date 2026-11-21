import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardStyleDefinition } from '../types/template';
import { DECK_FORMAT, FORMAT_VERSION, TEMPLATE_FORMAT } from './formats';
import { DeckSession, parseDeckSessionJson, saveDeckFile, serializeDeckSession } from './deckIO';

const mocks = vi.hoisted(() => ({
  isImageRef: vi.fn((value: unknown) => typeof value === 'string' && value.startsWith('idb:')),
  readImageDataUrl: vi.fn(async (ref: string) => `data:image/webp;base64,${ref.slice(4)}`),
  downloadJsonFile: vi.fn(),
}));

vi.mock('./imageStore', () => ({
  isImageRef: mocks.isImageRef,
  readImageDataUrl: mocks.readImageDataUrl,
}));
vi.mock('./fileIO', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./fileIO')>()),
  downloadJsonFile: mocks.downloadJsonFile,
}));

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
    mocks.isImageRef.mockClear();
    mocks.readImageDataUrl.mockClear();
    mocks.downloadJsonFile.mockReset();
  });

  it('serializes and parses a deck file', async () => {
    const json = await serializeDeckSession(session);
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe(DECK_FORMAT);
    expect(parsed.version).toBe(FORMAT_VERSION);
    expect(parseDeckSessionJson(json, styles).cards).toEqual(session.cards);
  });

  it('embeds loaded images as Data URLs in the downloaded file', async () => {
    const withImage: DeckSession = {
      ...session,
      cards: [{ ...session.cards[0], values: { ...session.cards[0].values, art: 'idb:abc' } }],
    };

    await saveDeckFile(withImage);
    expect(mocks.downloadJsonFile).toHaveBeenCalledTimes(1);
    const json = mocks.downloadJsonFile.mock.calls[0][1] as string;
    expect(JSON.parse(json).cards[0].values.art).toBe('data:image/webp;base64,abc');
    expect(parseDeckSessionJson(json, styles).cards[0].values.art).toBe(
      'data:image/webp;base64,abc',
    );
  });

  it('requires the matching template to be loaded', async () => {
    const json = await serializeDeckSession({
      ...session,
      cards: [{ id: '2', styleKey: 'missing', values: {} }],
    });
    expect(() => parseDeckSessionJson(json, styles)).toThrow(/absent du template/);
  });

  it('remaps incompatible styles when explicitly requested', async () => {
    const json = await serializeDeckSession({
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
