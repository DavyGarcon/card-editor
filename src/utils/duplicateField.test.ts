import { describe, expect, it } from 'vitest';
import type { CardTemplatePack, TemplateField } from '../types/template';
import { resolveCardStyle } from './styleResolver';
import {
  createDuplicatedField,
  duplicateFieldInStyle,
  getDuplicateFieldId,
} from './duplicateField';

const field = (id: string, overrides: Partial<TemplateField> = {}): TemplateField => ({
  id,
  label: id,
  type: 'text',
  x: 12,
  y: 34,
  width: 200,
  height: 40,
  fontSize: 18,
  ...overrides,
});

describe('duplicateField helpers', () => {
  it('generates a unique id based on the source field', () => {
    expect(getDuplicateFieldId('title', [])).toBe('title_copy');
    expect(getDuplicateFieldId('title', ['title_copy'])).toBe('title_copy_2');
    expect(getDuplicateFieldId('title', ['title_copy', 'title_copy_2'])).toBe('title_copy_3');
  });

  it('copies every attribute without sharing mutable options', () => {
    const source = field('school', {
      type: 'select',
      options: [{ value: 'a', label: 'A' }],
      rotation: 45,
      flipX: true,
      script: 'return {};',
      zOnly: true,
    });
    const copy = createDuplicatedField(source, 'school_copy', 7);

    expect(copy).toMatchObject({
      id: 'school_copy',
      label: 'school (Copie)',
      type: 'select',
      x: 12,
      y: 34,
      width: 200,
      height: 40,
      fontSize: 18,
      rotation: 45,
      flipX: true,
      script: 'return {};',
      z: 7,
    });
    expect(copy).not.toHaveProperty('zOnly');
    expect(copy.options).toEqual(source.options);
    expect(copy.options).not.toBe(source.options);
    expect(copy.options![0]).not.toBe(source.options![0]);
  });

  it('adds the copy above the original in the active style', () => {
    const pack: CardTemplatePack = {
      name: 'Pack',
      styles: [
        {
          key: 'main',
          name: 'Main',
          fields: [field('first', { z: 2 }), field('target', { z: 1 }), field('last', { z: 0 })],
        },
      ],
    };
    const resolved = resolveCardStyle('main', pack.styles).fields;
    const result = duplicateFieldInStyle(pack, 'main', resolved, 'target');

    expect(result?.fieldId).toBe('target_copy');
    const nextFields = result!.pack.styles[0].fields;
    expect(nextFields).toHaveLength(4);
    expect(nextFields.find((item) => item.id === 'target_copy')).toMatchObject({
      z: 2,
      x: 12,
      fontSize: 18,
    });
    const displayOrder = [...resolveCardStyle('main', result!.pack.styles).fields]
      .map((item, index) => ({ id: item.id, z: item.z ?? index, index }))
      .sort((a, b) => b.z - a.z || b.index - a.index)
      .map((item) => item.id);
    expect(displayOrder).toEqual(['first', 'target_copy', 'target', 'last']);
  });

  it('duplicates inherited fields with their resolved attributes', () => {
    const pack: CardTemplatePack = {
      name: 'Pack',
      styles: [
        {
          key: 'base',
          name: 'Base',
          fields: [field('inherited', { color: '#fff', fontSize: 22 })],
        },
        { key: 'child', name: 'Child', basedOn: 'base', fields: [] },
      ],
    };
    const resolved = resolveCardStyle('child', pack.styles).fields;
    const result = duplicateFieldInStyle(pack, 'child', resolved, 'inherited');

    expect(result?.fieldId).toBe('inherited_copy');
    const copy = result!.pack.styles[1].fields.find((item) => item.id === 'inherited_copy');
    expect(copy).toMatchObject({
      type: 'text',
      x: 12,
      color: '#fff',
      fontSize: 22,
      z: 1,
    });
    expect(copy).not.toHaveProperty('zOnly');
    expect(resolveCardStyle('child', result!.pack.styles).fields).toHaveLength(2);
  });

  it('is a no-op for an unknown field', () => {
    const pack: CardTemplatePack = {
      name: 'Pack',
      styles: [{ key: 'main', name: 'Main', fields: [] }],
    };
    expect(duplicateFieldInStyle(pack, 'main', [], 'missing')).toBeNull();
  });
});
