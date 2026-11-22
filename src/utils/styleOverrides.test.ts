import { describe, expect, it } from 'vitest';
import type { CardTemplatePack, TemplateField } from '../types/template';
import { resolveCardStyle } from './styleResolver';
import { createMinimalTemplatePack } from './styleOverrides';

const title: TemplateField = {
  id: 'title',
  label: 'Titre',
  type: 'text',
  x: 10,
  y: 10,
  width: 300,
  height: 40,
  fontSize: 20,
};

const art: TemplateField = {
  id: 'art',
  label: 'Illustration',
  type: 'image',
  x: 20,
  y: 80,
  width: 200,
  height: 150,
};

const badge: TemplateField = {
  id: 'badge',
  label: 'Badge',
  type: 'text',
  x: 5,
  y: 5,
  width: 30,
  height: 20,
};

const pack: CardTemplatePack = {
  name: 'Pack test',
  styles: [
    {
      key: 'base',
      name: 'Base',
      width: 375,
      height: 525,
      backgroundColor: '#1e293b',
      borderColor: '#64748b',
      fields: [title, art],
    },
    {
      key: 'child',
      name: 'Child',
      basedOn: 'base',
      // Full copies as produced by older saves / "duplicate then set basedOn".
      width: 375,
      borderColor: '#f59e0b',
      fields: [
        { ...title },
        { ...art, x: 30 },
        { ...art, id: 'badge', label: 'Badge', type: 'text', x: 5, y: 5, width: 30, height: 20 },
      ],
    },
  ],
};

describe('createMinimalTemplatePack', () => {
  it('keeps only changed fields and changed properties in a child style', () => {
    const result = createMinimalTemplatePack(pack);
    const child = result.styles[1];

    expect(child.fields.map((field) => field.id)).toEqual(['art', 'badge']);
    expect(child.fields[0]).toEqual({ id: 'art', type: 'image', x: 30 });
    expect(child.fields[1]).toEqual(badge);
    expect(child.width).toBeUndefined();
    expect(child.borderColor).toBe('#f59e0b');
  });

  it('produces the same resolved style as the uncompacted pack', () => {
    const result = createMinimalTemplatePack(pack);
    expect(resolveCardStyle('child', result.styles)).toEqual(
      resolveCardStyle('child', pack.styles),
    );
    expect(createMinimalTemplatePack(result)).toEqual(result);
  });

  it('reduces a z-only override to its id, type, z and flag', () => {
    const withReorder: CardTemplatePack = {
      ...pack,
      styles: [
        pack.styles[0],
        { ...pack.styles[1], width: undefined, fields: [{ ...art, z: 7, zOnly: true }] },
      ],
    };
    const child = createMinimalTemplatePack(withReorder).styles[1];
    expect(child.fields).toEqual([{ id: 'art', type: 'image', z: 7, zOnly: true }]);
    expect(
      resolveCardStyle('child', createMinimalTemplatePack(withReorder).styles).fields.find(
        (field) => field.id === 'art',
      ),
    ).toMatchObject({ x: 20, z: 7 });
  });

  it('compares a grandchild against its resolved parent', () => {
    const nested: CardTemplatePack = {
      ...pack,
      styles: [
        ...pack.styles,
        {
          key: 'grandchild',
          name: 'Grandchild',
          basedOn: 'child',
          fields: [{ ...title }, { ...art, x: 30, y: 99 }],
        },
      ],
    };
    const result = createMinimalTemplatePack(nested);
    expect(result.styles[2].fields).toEqual([{ id: 'art', type: 'image', y: 99 }]);
    expect(resolveCardStyle('grandchild', result.styles)).toEqual(
      resolveCardStyle('grandchild', nested.styles),
    );
  });
});
