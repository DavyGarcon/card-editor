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

  it('rejects duplicate field ids inside a style', () => {
    expect(() =>
      validateTemplatePack({
        ...pack,
        styles: [
          {
            ...pack.styles[0],
            fields: [pack.styles[0].fields[0], pack.styles[0].fields[0]],
          },
        ],
      }),
    ).toThrow(/deux calques/);
  });

  it('bounds geometry, opacity and scripts', () => {
    const baseField = pack.styles[0].fields[0];
    expect(() =>
      validateTemplatePack({
        ...pack,
        styles: [{ ...pack.styles[0], fields: [{ ...baseField, width: 999999 }] }],
      }),
    ).toThrow(/compris entre/);
    expect(() =>
      validateTemplatePack({
        ...pack,
        styles: [{ ...pack.styles[0], fields: [{ ...baseField, opacity: 3 }] }],
      }),
    ).toThrow(/compris entre/);
    expect(() =>
      validateTemplatePack({
        ...pack,
        styles: [{ ...pack.styles[0], fields: [{ ...baseField, script: 'a'.repeat(20001) }] }],
      }),
    ).toThrow(/longueur maximale/);
  });

  it('bounds names, labels and plain default values', () => {
    expect(() => validateTemplatePack({ ...pack, name: 'a'.repeat(301) })).toThrow(
      /longueur maximale/,
    );
    expect(() =>
      validateTemplatePack({
        ...pack,
        styles: [
          {
            ...pack.styles[0],
            fields: [{ ...pack.styles[0].fields[0], label: 'a'.repeat(201) }],
          },
        ],
      }),
    ).toThrow(/longueur maximale/);
    expect(() =>
      validateTemplatePack({
        ...pack,
        styles: [
          {
            ...pack.styles[0],
            fields: [
              { ...pack.styles[0].fields[0], type: 'text', defaultValue: 'a'.repeat(100001) },
            ],
          },
        ],
      }),
    ).toThrow(/longueur maximale/);
  });

  it('validates the new typography properties', () => {
    const baseField = pack.styles[0].fields[0];
    expect(
      validateTemplatePack({
        ...pack,
        styles: [
          {
            ...pack.styles[0],
            fields: [
              {
                ...baseField,
                verticalAlign: 'middle',
                lineHeight: 1.4,
                letterSpacing: 0.5,
                stroke: '#000',
                strokeWidth: 1,
              },
            ],
          },
        ],
      }).styles[0].fields[0].verticalAlign,
    ).toBe('middle');
    expect(() =>
      validateTemplatePack({
        ...pack,
        styles: [
          {
            ...pack.styles[0],
            fields: [{ ...baseField, verticalAlign: 'sideways' }],
          },
        ],
      }),
    ).toThrow(/top, middle ou bottom/);
  });

  it('validates rotation and mirror properties', () => {
    const baseField = pack.styles[0].fields[0];
    const result = validateTemplatePack({
      ...pack,
      styles: [
        {
          ...pack.styles[0],
          fields: [{ ...baseField, rotation: 45, flipX: true, flipY: false }],
        },
      ],
    });
    expect(result.styles[0].fields[0]).toMatchObject({
      rotation: 45,
      flipX: true,
      flipY: false,
    });
    expect(() =>
      validateTemplatePack({
        ...pack,
        styles: [{ ...pack.styles[0], fields: [{ ...baseField, flipX: 'yes' }] }],
      }),
    ).toThrow(/flipX doit être un booléen/);
    expect(() =>
      validateTemplatePack({
        ...pack,
        styles: [{ ...pack.styles[0], fields: [{ ...baseField, rotation: 400 }] }],
      }),
    ).toThrow(/rotation doit être compris/);
  });

  it('validates linked image sources', () => {
    const artwork = {
      id: 'artwork',
      label: 'Artwork',
      type: 'image',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      defaultValue: 'idb:shared',
    };
    const badge = { ...artwork, id: 'badge', linkedTo: 'artwork' };
    const fields = [artwork, badge];

    expect(
      validateTemplatePack({ ...pack, styles: [{ ...pack.styles[0], fields }] }).styles[0]
        .fields[1],
    ).toMatchObject({ id: 'badge', linkedTo: 'artwork' });
    expect(
      validateTemplatePack({
        ...pack,
        styles: [{ ...pack.styles[0], fields: [artwork, { ...badge, linkedTo: '' }] }],
      }).styles[0].fields[1].linkedTo,
    ).toBe('');
    expect(() =>
      validateTemplatePack({
        ...pack,
        styles: [
          { ...pack.styles[0], fields: [{ ...pack.styles[0].fields[0], linkedTo: 'artwork' }] },
        ],
      }),
    ).toThrow(/uniquement aux images|ne s'applique qu'aux images/);
    expect(() =>
      validateTemplatePack({
        ...pack,
        styles: [{ ...pack.styles[0], fields: [{ ...artwork, linkedTo: 'missing' }] }],
      }),
    ).toThrow(/inexistante/);
    expect(() =>
      validateTemplatePack({
        ...pack,
        styles: [
          {
            ...pack.styles[0],
            fields: [{ ...artwork, linkedTo: 'badge' }, badge],
          },
        ],
      }),
    ).toThrow(/boucle de liens/);
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

  it('rejects duplicate card ids', () => {
    const styles = validateTemplatePack(pack).styles;
    expect(() =>
      validateDeck(
        {
          cards: [
            { id: '1', styleKey: 'base', values: {} },
            { id: '1', styleKey: 'base', values: {} },
          ],
        },
        styles,
      ),
    ).toThrow(/dupliqué/);
  });
});
