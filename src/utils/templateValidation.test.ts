import { describe, expect, it } from 'vitest';
import { validateDeck, validateTemplatePack } from './templateValidation';

const pack = {
  name: 'Pack test',
  styles: [
    {
      key: 'base',
      name: 'Base',
      width: 375,
      height: 525,
      backgroundColor: '#1e293b',
      borderColor: '#f59e0b',
      fields: [
        { id: 'rules', label: 'Rules', type: 'richtext', x: 0, y: 0, width: 100, height: 100 },
      ],
    },
  ],
};

describe('validateTemplatePack', () => {
  it('accepts a valid pack', () => {
    expect(validateTemplatePack(pack).styles[0].fields[0].type).toBe('richtext');
  });

  it('rejects unknown inheritance targets', () => {
    expect(() =>
      validateTemplatePack({ ...pack, styles: [{ ...pack.styles[0], basedOn: 'nope' }] }),
    ).toThrow(/inexistant/);
  });

  it('rejects duplicate style keys', () => {
    expect(() =>
      validateTemplatePack({ ...pack, styles: [pack.styles[0], pack.styles[0]] }),
    ).toThrow(/dupliquée/);
  });

  it('sanitizes rich text HTML', () => {
    const result = validateTemplatePack({
      ...pack,
      styles: [
        {
          ...pack.styles[0],
          fields: [
            { ...pack.styles[0].fields[0], defaultValue: '<b>Ok</b><img src=x onerror=alert(1)>' },
          ],
        },
      ],
    });
    expect(result.styles[0].fields[0].defaultValue).toBe('<b>Ok</b>');
  });
});

describe('validateDeck', () => {
  it('validates cards and sanitizes rich text values', () => {
    const styles = validateTemplatePack(pack).styles;
    const cards = validateDeck(
      {
        cards: [
          { id: '1', styleKey: 'base', values: { rules: '<u>Safe</u><script>x()</script>' } },
        ],
      },
      styles,
    );
    expect(cards[0].values.rules).toBe('<u>Safe</u>');
  });

  it('rejects non-string values', () => {
    expect(() =>
      validateDeck({ cards: [{ id: '1', styleKey: 'base', values: { rules: 42 } }] }, []),
    ).toThrow();
  });
});
