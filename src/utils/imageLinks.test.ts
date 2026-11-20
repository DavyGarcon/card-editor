import { describe, expect, it } from 'vitest';
import { TemplateField } from '../types/template';
import {
  getImageLinkDescendants,
  getImageLinkGroups,
  getImageLinkRootId,
  getLinkedImageIds,
  getSharedImageSource,
  isImageSourceEditableInCard,
  wouldCreateImageLinkCycle,
} from './imageLinks';

function image(id: string, overrides: Partial<TemplateField> = {}): TemplateField {
  return {
    id,
    label: id,
    type: 'image',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...overrides,
  };
}

describe('image links', () => {
  const fields = [
    image('main', { defaultValue: 'idb:shared' }),
    image('copy', { linkedTo: 'main' }),
    image('copy-2', { linkedTo: 'copy' }),
    image('other', { defaultValue: 'idb:other', editableInCard: false }),
  ];

  it('resolves transitive links to one source and groups linked images', () => {
    expect(getImageLinkRootId('copy-2', fields)).toBe('main');
    expect(getSharedImageSource(image('copy-2'), fields, {})).toBe('idb:shared');
    expect(getSharedImageSource(image('copy-2'), fields, { main: 'idb:card' })).toBe('idb:card');
    expect(getSharedImageSource(image('copy-2'), fields, { copy: 'idb:legacy' })).toBe(
      'idb:legacy',
    );

    const groups = getImageLinkGroups(fields);
    expect(groups.map((group) => group.root.id)).toEqual(['main', 'other']);
    expect(groups[0].members.map((member) => member.id)).toEqual(['main', 'copy', 'copy-2']);
    expect(Array.from(getLinkedImageIds(fields))).toEqual(['main', 'copy', 'copy-2']);
  });

  it('detects descendants and prevents cycles', () => {
    expect(getImageLinkDescendants('copy', fields).map((field) => field.id)).toEqual(['copy-2']);
    expect(wouldCreateImageLinkCycle('main', 'copy-2', fields)).toBe(true);
    expect(wouldCreateImageLinkCycle('copy-2', 'main', fields)).toBe(false);
    expect(wouldCreateImageLinkCycle('other', 'main', fields)).toBe(false);
    expect(wouldCreateImageLinkCycle('main', 'main', fields)).toBe(true);
  });

  it('keeps a shared source editable when only a linked child is editable', () => {
    const bundle = [
      image('title-art', { defaultValue: 'idb:shared', editableInCard: false }),
      image('icon', { linkedTo: 'title-art' }),
    ];
    expect(isImageSourceEditableInCard(bundle[0], bundle)).toBe(true);

    const decorative = bundle.map((field) => ({ ...field, editableInCard: false }));
    expect(isImageSourceEditableInCard(decorative[0], decorative)).toBe(false);
  });

  it('ignores broken links and resolves cycles to a stable root', () => {
    const broken = [image('alone', { linkedTo: 'missing' })];
    expect(getImageLinkRootId('alone', broken)).toBe('alone');

    const cycle = [image('a', { linkedTo: 'b' }), image('b', { linkedTo: 'a' })];
    expect(getImageLinkRootId('a', cycle)).toBe('a');
    expect(getImageLinkRootId('b', cycle)).toBe('a');
  });
});
