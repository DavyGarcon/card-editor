import { describe, expect, it, vi } from 'vitest';

const konvaState = vi.hoisted(() => ({
  images: [] as Array<{ image: { src?: string } }>,
  lines: [] as Array<{ points: number[] }>,
}));

vi.mock('konva', () => {
  class MockNode {
    children: MockNode[] = [];
    constructor(public config: Record<string, unknown> = {}) {}
    add(...nodes: MockNode[]) {
      this.children.push(...nodes);
    }
  }
  class MockImage extends MockNode {
    constructor(config: { image: { src?: string } }) {
      super(config);
      konvaState.images.push(config);
    }
  }
  class MockLine extends MockNode {
    constructor(config: Record<string, unknown>) {
      super(config);
      konvaState.lines.push(config as { points: number[] });
    }
  }
  class MockStage extends MockNode {
    toDataURL() {
      return 'data:image/png;base64,AAAA';
    }
    destroy() {}
  }
  return {
    default: {
      Group: MockNode,
      Image: MockImage,
      Layer: MockNode,
      Line: MockLine,
      Rect: MockNode,
      Stage: MockStage,
      Text: MockNode,
    },
  };
});

vi.mock('../io/imageStore', () => ({
  resolveImageRef: vi.fn(async (src: string) => src),
}));

vi.mock('./imageLoader', () => ({
  loadImage: vi.fn(async (src: string) => ({ src })),
}));

import { CardData, ResolvedCardStyle } from '../types/template';
import { renderCardToDataUrl } from './cardRenderer';

const style = {
  key: 'base',
  name: 'Base',
  width: 100,
  height: 100,
  backgroundColor: '#000000',
  borderColor: '#ffffff',
  fields: [
    {
      id: 'root',
      label: 'Root',
      type: 'image',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      defaultValue: 'idb:template',
    },
    {
      id: 'child',
      label: 'Child',
      type: 'image',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      linkedTo: 'root',
      script: 'return { src: "/override.png" };',
    },
  ],
} as ResolvedCardStyle;

describe('renderCardToDataUrl linked images', () => {
  it('renders every linked image from the shared root source', async () => {
    konvaState.images.length = 0;
    const card = {
      id: 'card-1',
      styleKey: 'base',
      values: { root: 'idb:card' },
    } as CardData;

    await renderCardToDataUrl(card, style);

    expect(konvaState.images).toHaveLength(2);
    expect(konvaState.images.map((config) => config.image.src)).toEqual(['idb:card', 'idb:card']);
  });

  it('does not render hidden layers in exports', async () => {
    konvaState.images.length = 0;
    const withHidden = {
      ...style,
      fields: [
        ...style.fields,
        { ...style.fields[0], id: 'hidden', linkedTo: undefined, hidden: true },
      ],
    } as ResolvedCardStyle;
    const card = {
      id: 'card-1',
      styleKey: 'base',
      values: { root: 'idb:card' },
    } as CardData;

    await renderCardToDataUrl(card, withHidden);

    expect(konvaState.images).toHaveLength(2);
  });
});

describe('renderCardToDataUrl checkbox', () => {
  const checkboxStyle = {
    ...style,
    fields: [
      {
        id: 'accepted',
        label: 'Accepté',
        type: 'checkbox',
        x: 10,
        y: 20,
        width: 120,
        height: 32,
        defaultValue: 'false',
      },
    ],
  } as ResolvedCardStyle;

  it('draws a check mark only when the stored value is "true"', async () => {
    konvaState.lines.length = 0;
    const card = { id: 'card-1', styleKey: 'base', values: { accepted: 'true' } } as CardData;

    await renderCardToDataUrl(card, checkboxStyle);

    expect(konvaState.lines).toHaveLength(1);
    expect(konvaState.lines[0].points).toHaveLength(6);

    konvaState.lines.length = 0;
    await renderCardToDataUrl(
      { ...card, values: { accepted: 'false' } } as CardData,
      checkboxStyle,
    );
    expect(konvaState.lines).toHaveLength(0);

    // Missing card values fall back to the template default (unchecked).
    await renderCardToDataUrl({ ...card, values: {} } as CardData, checkboxStyle);
    expect(konvaState.lines).toHaveLength(0);
  });
});
