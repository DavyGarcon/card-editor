import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('konva', () => ({
  default: {
    Group: class {},
    Rect: class {},
    Text: class {},
    Transformer: class {},
  },
}));

/** Shared mock state, created before vi.mock factories are evaluated. */
const mock = vi.hoisted(() => ({
  groupProps: null as Record<string, unknown> | null,
  groupNode: null as unknown,
  rects: [] as Array<Record<string, unknown>>,
  texts: [] as Array<Record<string, unknown>>,
}));

function createFakeNode() {
  const attrs: Record<string, number> = {
    x: 0,
    y: 0,
    width: 260,
    height: 120,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
  };
  const accessor = (key: string) => (value?: number) => {
    if (value === undefined) return attrs[key];
    attrs[key] = value;
    return undefined;
  };
  return {
    attrs,
    x: accessor('x'),
    y: accessor('y'),
    width: accessor('width'),
    height: accessor('height'),
    scaleX: accessor('scaleX'),
    scaleY: accessor('scaleY'),
    rotation: accessor('rotation'),
  };
}

vi.mock('react-konva', () => ({
  Group: ({ children, ref, ...props }: { children?: ReactNode; ref?: { current: unknown } }) => {
    mock.groupProps = props;
    mock.groupNode = createFakeNode();
    if (ref) ref.current = mock.groupNode;
    return createElement('div', { 'data-testid': 'richtext-group' }, children);
  },
  Rect: (props: Record<string, unknown>) => {
    mock.rects.push(props);
    return null;
  },
  Text: (props: { text?: string; x?: number; y?: number }) => {
    mock.texts.push(props);
    return null;
  },
  Transformer: () => null,
}));

import { RichTextNode } from './RichTextNode';

describe('RichTextNode', () => {
  const richHtml = '<p>Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu</p>';

  const baseProps = {
    html: richHtml,
    label: 'Texte Riche',
    x: 10,
    y: 20,
    height: 120,
    fontSize: 20,
    fontFamily: 'Arial',
    color: '#ffffff',
    align: 'left' as const,
    opacity: 1,
    isDesignMode: true,
    isSelected: true,
    onSelect: () => {},
    onChange: () => {},
  };

  beforeEach(() => {
    mock.groupProps = null;
    mock.groupNode = null;
    mock.rects = [];
    mock.texts = [];
  });

  it('lays out the text again when the width changes', () => {
    const { rerender } = render(<RichTextNode {...baseProps} width={100} />);
    const before = mock.texts.map((text) => `${text.text}@${text.x},${text.y}`);
    expect(before.length).toBeGreaterThan(1);

    mock.texts = [];
    rerender(<RichTextNode {...baseProps} width={400} />);
    const after = mock.texts.map((text) => `${text.text}@${text.x},${text.y}`);
    expect(after).not.toEqual(before);
  });

  it('lays out the text again when the font size changes', () => {
    const { rerender } = render(<RichTextNode {...baseProps} width={200} fontSize={12} />);
    const before = mock.texts.map((text) => `${text.text}@${text.x},${text.y}`);

    mock.texts = [];
    rerender(<RichTextNode {...baseProps} width={200} fontSize={36} />);
    const after = mock.texts.map((text) => `${text.text}@${text.x},${text.y}`);
    expect(after).not.toEqual(before);
  });

  it('gives the transformer a full-size box so resizes reflow the text', () => {
    const onChange = vi.fn();
    render(<RichTextNode {...baseProps} width={260} onChange={onChange} />);

    // Konva ignores a Group's own width/height when computing its client rect.
    // The backing rect makes the transformer measure the field box, not the runs.
    expect(mock.rects.some((r) => r.width === 260 && r.height === 120)).toBe(true);

    // Simulate the transformer dragging the right anchor from 260px to 320px:
    // it scales the group by 320/260, then transformend commits the new size.
    const node = mock.groupNode as ReturnType<typeof createFakeNode>;
    node.scaleX(320 / 260);
    node.scaleY(1);
    (mock.groupProps?.onTransformEnd as () => void)();

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ width: 320, height: 120, flipX: false, flipY: false }),
    );
    // The live node is synced immediately so the transformer does not re-apply
    // the stale scale before React commits the new width.
    expect(node.width()).toBe(320);
    expect(node.scaleX()).toBe(1);
  });
});
