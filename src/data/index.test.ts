import { describe, expect, it } from 'vitest';
import { BUILT_IN_TEMPLATES } from './index';

describe('built-in templates', () => {
  it('discovers every pack module in src/data, alphabetically by pack name', () => {
    expect(BUILT_IN_TEMPLATES.map((template) => template.id)).toEqual(['examplePack']);
    const names = BUILT_IN_TEMPLATES.map((template) => template.pack.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'fr')));
  });

  it('ships no default card content in the packs', () => {
    for (const template of BUILT_IN_TEMPLATES) {
      expect(template.pack.styles.length).toBeGreaterThan(0);
      for (const style of template.pack.styles) {
        for (const field of style.fields) {
          expect(field.defaultValue).toBeUndefined();
        }
      }
    }
  });
});
