import React, { useRef, useEffect, useCallback } from 'react';

export interface RichTextEditorProps {
  /** HTML string stored in card.values[field.id] */
  value: string;
  /** Callback fired whenever formatted content changes */
  onChange: (htmlValue: string) => void;
  /** Optional inline game icons/tokens (e.g. ['⚔️', '🛡️', '❤️', '{M}', '{T}']) */
  symbols?: string[];
  placeholder?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  symbols = ['⚔️', '🛡️', '❤️', '⚡', '🎲', '★'],
  placeholder = 'Enter formatted card text...',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync external value changes without breaking cursor position during active typing
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const execFormat = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    handleInput();
  };

  const insertSymbol = (symbol: string) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, symbol);
    handleInput();
  };

  return (
    <div className="rich-text-editor" style={styles.container}>
      {/* Formatting Toolbar */}
      <div style={styles.toolbar}>
        <button
          type="button"
          title="Bold"
          onClick={() => execFormat('bold')}
          style={styles.button}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          title="Italic"
          onClick={() => execFormat('italic')}
          style={styles.button}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          title="Underline"
          onClick={() => execFormat('underline')}
          style={styles.button}
        >
          <u>U</u>
        </button>
        <button
          type="button"
          title="Bullet List"
          onClick={() => execFormat('insertUnorderedList')}
          style={styles.button}
        >
          • List
        </button>
        <button
          type="button"
          title="Clear Formatting"
          onClick={() => execFormat('removeFormat')}
          style={styles.button}
        >
          ✕
        </button>

        {/* Inline Symbol Bar */}
        {symbols.length > 0 && (
          <div style={styles.symbolGroup}>
            {symbols.map((sym) => (
              <button
                key={sym}
                type="button"
                title={`Insert ${sym}`}
                onClick={() => insertSymbol(sym)}
                style={styles.symbolButton}
              >
                {sym}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ContentEditable Area */}
      <div
        ref={editorRef}
        className="rich-text-editor-content"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        style={styles.editor}
      />
    </div>
  );
};

/**
 * Helper utility to parse HTML from RichTextEditor into styled runs
 * for rendering on a Konva Canvas layer.
 */
export interface StyledTextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export function parseRichTextToSegments(html: string): StyledTextSegment[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '', 'text/html');
  const segments: StyledTextSegment[] = [];

  const traverse = (
    node: Node,
    style: { bold: boolean; italic: boolean; underline: boolean }
  ) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.length > 0) {
        segments.push({ text, ...style });
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'br') {
        segments.push({ text: '\n', ...style });
        return;
      }

      if (tag === 'li') {
        segments.push({ text: '\n• ', ...style });
      } else if ((tag === 'div' || tag === 'p') && segments.length > 0) {
        segments.push({ text: '\n', ...style });
      }

      const nextStyle = {
        bold: style.bold || tag === 'b' || tag === 'strong',
        italic: style.italic || tag === 'i' || tag === 'em',
        underline: style.underline || tag === 'u',
      };

      el.childNodes.forEach((child) => traverse(child, nextStyle));
    }
  };

  doc.body.childNodes.forEach((child) =>
    traverse(child, { bold: false, italic: false, underline: false })
  );

  return segments;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    border: '1px solid #334155',
    borderRadius: '6px',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    overflow: 'hidden',
    fontFamily: 'inherit',
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    padding: '6px',
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
    alignItems: 'center',
  },
  button: {
    background: '#334155',
    color: '#f8fafc',
    border: 'none',
    borderRadius: '4px',
    padding: '3px 8px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  symbolGroup: {
    display: 'flex',
    gap: '3px',
    marginLeft: 'auto',
    borderLeft: '1px solid #475569',
    paddingLeft: '6px',
  },
  symbolButton: {
    background: 'transparent',
    color: '#f8fafc',
    border: '1px solid #475569',
    borderRadius: '4px',
    padding: '2px 5px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  editor: {
    minHeight: '90px',
    maxHeight: '200px',
    overflowY: 'auto',
    padding: '8px 10px',
    fontSize: '14px',
    lineHeight: 1.4,
    outline: 'none',
  },
};

export default RichTextEditor;
