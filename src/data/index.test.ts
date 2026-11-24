import { describe, expect, it } from 'vitest';
import { BUILT_IN_TEMPLATES } from './index';

describe('built-in templates', () => {
  it('discovers every JSON template in src/data, alphabetically by pack name', () => {
    expect(BUILT_IN_TEMPLATES.map((template) => template.id)).toEqual([
      'jdr-pack-template',
      'examplePack',
    ]);
    const names = BUILT_IN_TEMPLATES.map((template) => template.pack.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'fr')));
  });

  it('validates and loads JSON template session files', () => {
    const jsonTemplate = BUILT_IN_TEMPLATES.find((template) => template.id === 'examplePack')!;
    expect(jsonTemplate.pack.name).toBe('Template Pack Example');
    expect(jsonTemplate.pack.styles.length).toBeGreaterThan(1);
    expect(jsonTemplate.pack.styles[0].fields.map((field) => field.id)).toContain('rarity');
  });

  it('ships no default card content in the packs', () => {
    for (const template of BUILT_IN_TEMPLATES) {
      expect(template.pack.styles.length).toBeGreaterThan(0);
      for (const style of template.pack.styles) {
        for (const field of style.fields) {
          // A select's default choice is template configuration, not card content.
          if (field.type !== 'select') expect(field.defaultValue).toBeUndefined();
        }
      }
    }
  });
});
