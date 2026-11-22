import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardTemplatePack } from '../types/template';
import { DECK_FORMAT, TEMPLATE_FORMAT, FORMAT_VERSION } from './formats';
import { resolveCardStyle } from '../utils/styleResolver';
import {
  parseTemplateSessionJson,
  saveTemplateFile,
  serializeTemplateSession,
  TemplateSession,
} from './templateIO';

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
    mocks.isImageRef.mockClear();
    mocks.readImageDataUrl.mockClear();
    mocks.downloadJsonFile.mockReset();
  });

  it('serializes and parses a template file', async () => {
    const json = await serializeTemplateSession(session);
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe(TEMPLATE_FORMAT);
    expect(parsed.version).toBe(FORMAT_VERSION);
    expect(parsed.pack.name).toBe('Pack test');
    expect(parseTemplateSessionJson(json)).toEqual(session);
  });

  it('saves child styles as minimal basedOn overrides', async () => {
    const baseField = pack.styles[0].fields[0];
    const childPack: CardTemplatePack = {
      ...pack,
      styles: [
        pack.styles[0],
        {
          key: 'child',
          name: 'Child',
          basedOn: 'base',
          height: 525,
          fields: [{ ...baseField }, { ...baseField, id: 'subtitle', fontSize: 12, x: 5 }],
        },
      ],
    };
    const childSession: TemplateSession = {
      pack: childPack,
      activeStyleKey: 'child',
      mode: 'template',
    };

    const json = await serializeTemplateSession(childSession);
    const savedChild = JSON.parse(json).pack.styles[1];

    expect(savedChild.fields).toEqual([
      {
        id: 'subtitle',
        label: 'Titre',
        type: 'text',
        x: 5,
        y: 0,
        width: 100,
        height: 20,
        fontSize: 12,
      },
    ]);
    expect(savedChild.height).toBeUndefined();
    expect(resolveCardStyle('child', parseTemplateSessionJson(json).pack.styles)).toEqual(
      resolveCardStyle('child', childPack.styles),
    );
  });

  it('embeds loaded images as Data URLs in the downloaded file', async () => {
    const withImage: TemplateSession = {
      ...session,
      pack: {
        ...pack,
        styles: [
          {
            ...pack.styles[0],
            fields: [
              ...pack.styles[0].fields,
              {
                id: 'art',
                label: 'Illustration',
                type: 'image',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                defaultValue: 'idb:abc',
              },
            ],
          },
        ],
      },
    };

    await saveTemplateFile(withImage);
    expect(mocks.downloadJsonFile).toHaveBeenCalledTimes(1);
    const json = mocks.downloadJsonFile.mock.calls[0][1] as string;
    expect(JSON.parse(json).pack.styles[0].fields[1].defaultValue).toBe(
      'data:image/webp;base64,abc',
    );
    expect(parseTemplateSessionJson(json).pack.styles[0].fields[1].defaultValue).toBe(
      'data:image/webp;base64,abc',
    );
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
