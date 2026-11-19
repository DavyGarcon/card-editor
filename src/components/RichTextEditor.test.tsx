import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { parseRichTextToSegments, RichTextEditor } from './RichTextEditor';

describe('RichTextEditor', () => {
  it('renders sanitized HTML into the editable area', () => {
    const { container } = render(
      <RichTextEditor value="<b>Hello</b><script>alert(1)</script>" onChange={() => {}} />,
    );
    const editable = container.querySelector('.rich-text-editor-content');
    expect(editable?.innerHTML).toContain('<b>Hello</b>');
    expect(editable?.innerHTML).not.toContain('<script>');
  });

  it('parses HTML into styled segments', () => {
    const segments = parseRichTextToSegments('<b>Bold</b> and <i>italic</i><br>next');
    expect(segments).toEqual([
      { text: 'Bold', bold: true, italic: false, underline: false },
      { text: ' and ', bold: false, italic: false, underline: false },
      { text: 'italic', bold: false, italic: true, underline: false },
      { text: '\n', bold: false, italic: false, underline: false },
      { text: 'next', bold: false, italic: false, underline: false },
    ]);
  });
});
