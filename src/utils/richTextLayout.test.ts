import { describe, expect, it } from 'vitest';
import { layoutRichText } from './richTextLayout';

const segment = (text: string, bold = false, italic = false, underline = false) => ({
  text,
  bold,
  italic,
  underline,
});

describe('layoutRichText', () => {
  it('keeps words on one line when they fit', () => {
    const runs = layoutRichText([segment('Hello world')], { width: 200, fontSize: 16 });
    expect(runs.map((run) => run.text)).toEqual(['Hello', 'world']);
    expect(runs[1].x).toBe(48); // space width is folded into the next run
  });

  it('wraps words and applies line height', () => {
    const runs = layoutRichText([segment('aaa bbb ccc')], { width: 40, fontSize: 16 });
    expect(runs.map((run) => run.y)).toEqual([0, 20, 40]);
  });

  it('preserves inline styles and explicit breaks', () => {
    const runs = layoutRichText(
      [
        segment('Bold ', true),
        segment('italic', false, true),
        segment('\nunder', false, false, true),
      ],
      { width: 200, fontSize: 16 },
    );
    expect(runs[0].bold).toBe(true);
    expect(runs[1].italic).toBe(true);
    expect(runs[2].y).toBe(20);
    expect(runs[2].underline).toBe(true);
  });

  it('centers and right-aligns lines', () => {
    expect(
      layoutRichText([segment('Hi')], { width: 100, fontSize: 16, align: 'center' })[0].x,
    ).toBe(42);
    expect(layoutRichText([segment('Hi')], { width: 100, fontSize: 16, align: 'right' })[0].x).toBe(
      84,
    );
  });
});
