import type { StyledTextSegment } from '../components/RichTextEditor';

export interface StyledRichRun {
  text: string;
  x: number;
  y: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

interface Token extends StyledTextSegment {
  kind: 'word' | 'space' | 'newline';
  measuredWidth: number;
}

interface LayoutOptions {
  width: number;
  fontSize: number;
  align?: 'left' | 'center' | 'right';
  fontFamily?: string;
}

const DEFAULT_FONT_FAMILY = 'Arial';
const LINE_HEIGHT_FACTOR = 1.25;

let measureContext: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (!measureContext) {
    measureContext = document.createElement('canvas').getContext('2d');
  }
  return measureContext;
}

/** Builds the same font shorthand Konva.Text uses, so measurements match the canvas. */
function toFontStyle(bold: boolean, italic: boolean): string {
  if (bold && italic) return 'bold italic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'normal';
}

function measure(
  text: string,
  bold: boolean,
  italic: boolean,
  fontSize: number,
  fontFamily: string,
): number {
  const ctx = getMeasureContext();
  if (!ctx) return text.length * fontSize * 0.5;
  ctx.font = `${toFontStyle(bold, italic)} normal ${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

/** Splits parsed HTML segments into words, spaces and explicit line breaks. */
function tokenize(segments: StyledTextSegment[], fontSize: number, fontFamily: string): Token[] {
  const tokens: Token[] = [];

  for (const segment of segments) {
    const chunks = segment.text.split(/(\n)/);
    for (const chunk of chunks) {
      if (chunk === '\n') {
        tokens.push({ ...segment, text: '\n', kind: 'newline', measuredWidth: 0 });
        continue;
      }
      if (!chunk) continue;
      for (const piece of chunk.split(/(\s+)/).filter(Boolean)) {
        tokens.push({
          ...segment,
          text: piece,
          kind: /^\s+$/.test(piece) ? 'space' : 'word',
          measuredWidth: measure(piece, segment.bold, segment.italic, fontSize, fontFamily),
        });
      }
    }
  }

  return tokens;
}

/**
 * Lays out rich text (parsed from HTML) into individually styled runs that can be
 * drawn as plain Konva.Text nodes. Handles word wrapping, explicit breaks, bullets
 * and horizontal alignment.
 */
export function layoutRichText(
  segments: StyledTextSegment[],
  { width, fontSize, align = 'left', fontFamily = DEFAULT_FONT_FAMILY }: LayoutOptions,
): StyledRichRun[] {
  const tokens = tokenize(segments, fontSize, fontFamily);
  if (tokens.length === 0) return [];

  const lines: Token[][] = [[]];
  let lineWidth = 0;

  const newLine = () => {
    // Trailing spaces don't affect the visible width of a line.
    const current = lines[lines.length - 1];
    while (current.length > 0 && current[current.length - 1].kind === 'space') current.pop();
    lines.push([]);
    lineWidth = 0;
  };

  for (const token of tokens) {
    if (token.kind === 'newline') {
      newLine();
      continue;
    }
    // Ignore spaces that would start a fresh wrapped line.
    if (token.kind === 'space' && lineWidth === 0) continue;

    if (token.kind === 'word' && lineWidth > 0 && lineWidth + token.measuredWidth > width) {
      newLine();
    }

    lines[lines.length - 1].push(token);
    lineWidth += token.measuredWidth;
  }

  const lineHeight = fontSize * LINE_HEIGHT_FACTOR;
  const runs: StyledRichRun[] = [];

  lines.forEach((line, lineIndex) => {
    if (line.length === 0) return;
    const totalWidth = line.reduce((sum, token) => sum + token.measuredWidth, 0);
    let cursor =
      align === 'center'
        ? Math.max(0, (width - totalWidth) / 2)
        : align === 'right'
          ? Math.max(0, width - totalWidth)
          : 0;

    for (const token of line) {
      if (token.kind !== 'space' || token.text.trim().length > 0) {
        runs.push({
          text: token.text,
          x: cursor,
          y: lineIndex * lineHeight,
          bold: token.bold,
          italic: token.italic,
          underline: token.underline,
        });
      }
      cursor += token.measuredWidth;
    }
  });

  return runs;
}
