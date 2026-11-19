import { describe, expect, it } from 'vitest';
import { resolveCardStyle } from './styleResolver';
import { CardStyleDefinition } from '../types/template';

const base: CardStyleDefinition = {
  key: 'base',
  name: 'Base',
  width: 375,
  height: 525,
  backgroundColor: '#1e293b',
  borderColor: '#64748b',
  fields: [
    {
      id: 'title',
      label: 'Titre',
      type: 'text',
      x: 10,
      y: 10,
      width: 300,
      height: 40,
      fontSize: 20,
    },
    { id: 'body', label: 'Corps', type: 'text', x: 10, y: 60, width: 300, height: 200 },
  ],
};

describe('resolveCardStyle', () => {
  it('inherits dimensions, colors and fields from the parent', () => {
    const child: CardStyleDefinition = {
      key: 'child',
      name: 'Child',
      basedOn: 'base',
      borderColor: '#f59e0b',
      fields: [
        {
          id: 'title',
          label: 'Titre',
          type: 'text',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          color: '#fff',
        },
      ],
    };
    const result = resolveCardStyle('child', [base, child]);

    expect(result.width).toBe(375);
    expect(result.backgroundColor).toBe('#1e293b');
    expect(result.borderColor).toBe('#f59e0b');
    expect(result.fields).toHaveLength(2);
    expect(result.fields[0]).toMatchObject({ x: 0, color: '#fff', fontSize: 20 });
    expect(result.fields[1].id).toBe('body');
  });

  it('resolves multi-level inheritance', () => {
    const child: CardStyleDefinition = { key: 'a', name: 'A', basedOn: 'base', fields: [] };
    const grandChild: CardStyleDefinition = { key: 'b', name: 'B', basedOn: 'a', fields: [] };
    expect(resolveCardStyle('b', [base, child, grandChild]).fields).toHaveLength(2);
  });

  it('rejects inheritance cycles', () => {
    const a: CardStyleDefinition = { key: 'a', name: 'A', basedOn: 'b', fields: [] };
    const b: CardStyleDefinition = { key: 'b', name: 'B', basedOn: 'a', fields: [] };
    expect(() => resolveCardStyle('a', [a, b])).toThrow(/Boucle d'héritage/);
  });
});
