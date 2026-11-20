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
  /** Field height, used for vertical alignment of the laid-out text block. */
  height?: number;
  /** Multiplier of fontSize (Konva-compatible). */
  lineHeight?: number;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  letterSpacing?: number;
}

const DEFAULT_FONT_FAMILY = 'Arial';
const LINE_HEIGHT_FACTOR = 1.25;
// Imported cards can contain very large values: never create an unbounded
// number of Konva.Text nodes from a single field.
const MAX_LAYOUT_RUNS = 2000;

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
  letterSpacing = 0,
): number {
  const ctx = getMeasureContext();
  const spacing = Math.max(0, text.length - 1) * letterSpacing;
  if (!ctx) return text.length * fontSize * 0.5 + spacing;
  ctx.font = `${toFontStyle(bold, italic)} normal ${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width + spacing;
}

/** Splits parsed HTML segments into words, spaces and explicit line breaks. */
function tokenize(
  segments: StyledTextSegment[],
  fontSize: number,
  fontFamily: string,
  letterSpacing: number,
): Token[] {
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
          measuredWidth: measure(
            piece,
            segment.bold,
            segment.italic,
            fontSize,
            fontFamily,
            letterSpacing,
          ),
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
  {
    width,
    fontSize,
    align = 'left',
    fontFamily = DEFAULT_FONT_FAMILY,
    height,
    lineHeight,
    verticalAlign = 'top',
    letterSpacing = 0,
  }: LayoutOptions,
): StyledRichRun[] {
  const sourceTokens = tokenize(segments, fontSize, fontFamily, letterSpacing);
  if (sourceTokens.length === 0) return [];

  // A single unbreakable word longer than the field would otherwise be drawn
  // outside the card. Split it into measured chunks that fit the field width.
  const tokens: Token[] = [];
  for (const token of sourceTokens) {
    if (tokens.length >= MAX_LAYOUT_RUNS) break;
    if (token.kind !== 'word' || token.measuredWidth <= width) {
      tokens.push(token);
      continue;
    }
    let start = 0;
    while (start < token.text.length) {
      if (tokens.length >= MAX_LAYOUT_RUNS) {
        tokens.push({ ...token, text: token.text.slice(start), measuredWidth: width });
        break;
      }
      // Binary search keeps the number of canvas measurements logarithmic
      // even for a single extremely long unbroken word.
      let low = start + 1;
      let high = token.text.length;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (
          measure(
            token.text.slice(start, mid),
            token.bold,
            token.italic,
            fontSize,
            fontFamily,
            letterSpacing,
          ) <= width
        ) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }
      const chunk = token.text.slice(start, low);
      tokens.push({
        ...token,
        text: chunk,
        measuredWidth: measure(
          chunk,
          token.bold,
          token.italic,
          fontSize,
          fontFamily,
          letterSpacing,
        ),
      });
      start = low;
    }
  }

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

  // Trailing spaces must not affect the alignment of the final line either.
  const lastLine = lines[lines.length - 1];
  while (lastLine.length > 0 && lastLine[lastLine.length - 1].kind === 'space') lastLine.pop();

  const lineStep = fontSize * (lineHeight ?? LINE_HEIGHT_FACTOR);
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
          y: lineIndex * lineStep,
          bold: token.bold,
          italic: token.italic,
          underline: token.underline,
        });
      }
      cursor += token.measuredWidth;
    }
  });

  if (height === undefined || verticalAlign === 'top' || !Number.isFinite(height)) return runs;
  const visibleLines = lines.filter((line) => line.length > 0).length;
  const contentHeight = Math.max(0, visibleLines - 1) * lineStep + fontSize;
  const free = height - contentHeight;
  if (free <= 0) return runs;
  const offsetY = verticalAlign === 'middle' ? free / 2 : free;
  return runs.map((run) => ({ ...run, y: run.y + offsetY }));
}
