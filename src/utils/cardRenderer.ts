import Konva from 'konva';
import { CardData, ResolvedCardStyle } from '../types/template';
import { evaluateFieldScript } from './scriptEvaluator';
import { parseRichTextToSegments } from '../components/RichTextEditor';
import { layoutRichText } from './richTextLayout';

/** Renders a card into a detached Konva stage — no live UI state is touched. */
export async function renderCardToDataUrl(
  card: CardData,
  style: ResolvedCardStyle,
  pixelRatio = 2,
): Promise<string> {
  const container = document.createElement('div');
  const stage = new Konva.Stage({
    container,
    width: style.width,
    height: style.height,
  });
  const layer = new Konva.Layer();
  stage.add(layer);

  layer.add(
    new Konva.Rect({
      x: 0,
      y: 0,
      width: style.width,
      height: style.height,
      fill: style.backgroundColor,
      stroke: style.borderColor,
      strokeWidth: 12,
    }),
  );

  const ordered = style.fields
    .map((field, index) => ({ field, index }))
    .sort((a, b) => (a.field.z ?? a.index) - (b.field.z ?? b.index) || a.index - b.index);

  const imageLoads: Array<Promise<void>> = [];

  for (const { field } of ordered) {
    const editable = field.editableInCard !== false;
    const rawValue = editable
      ? (card.values[field.id] ?? field.defaultValue ?? '')
      : (field.defaultValue ?? '');
    const cardValues = editable
      ? card.values
      : { ...card.values, [field.id]: field.defaultValue ?? '' };
    const computed = evaluateFieldScript(field.script, {
      card: cardValues,
      style: style as unknown as Record<string, unknown>,
      field: field as unknown as Record<string, unknown>,
    });

    if (computed.visible === false) continue;

    const x = computed.x ?? field.x;
    const y = computed.y ?? field.y;
    const width = computed.width ?? field.width;
    const height = computed.height ?? field.height;
    const color = computed.color ?? field.color ?? '#ffffff';
    const fill = computed.fill ?? field.fill ?? '#0f172a';
    const fontSize = computed.fontSize ?? field.fontSize ?? 16;
    const opacity = computed.opacity ?? field.opacity ?? 1;

    let displayText = rawValue || field.defaultValue || '';
    if (field.type === 'select' && field.options?.length) {
      displayText =
        field.options.find((option) => option.value === displayText)?.label || displayText;
    }
    if (computed.text !== undefined) displayText = String(computed.text);

    if (field.type === 'box') {
      layer.add(
        new Konva.Rect({
          x,
          y,
          width,
          height,
          fill,
          stroke: color,
          strokeWidth: 2,
          cornerRadius: 6,
          opacity,
        }),
      );
      continue;
    }

    if (field.type === 'text' || field.type === 'select') {
      layer.add(
        new Konva.Text({
          x,
          y,
          width,
          height,
          text: displayText,
          fontSize,
          fontFamily: field.fontFamily || 'Arial',
          fontStyle: field.id === 'title' ? 'bold' : 'normal',
          fill: color,
          align: field.align || 'left',
          opacity,
        }),
      );
      continue;
    }

    if (field.type === 'richtext') {
      const runs = layoutRichText(parseRichTextToSegments(displayText), {
        width,
        fontSize,
        align: field.align || 'left',
        fontFamily: field.fontFamily || 'Arial',
      });
      const group = new Konva.Group({ x, y, width, height, opacity });
      for (const run of runs) {
        group.add(
          new Konva.Text({
            x: run.x,
            y: run.y,
            text: run.text,
            fontFamily: field.fontFamily || 'Arial',
            fontSize,
            fontStyle:
              run.bold && run.italic
                ? 'bold italic'
                : run.bold
                  ? 'bold'
                  : run.italic
                    ? 'italic'
                    : 'normal',
            textDecoration: run.underline ? 'underline' : '',
            fill: color,
          }),
        );
      }
      layer.add(group);
      continue;
    }

    if (field.type === 'image') {
      const src = computed.src ?? rawValue ?? '';
      const group = new Konva.Group({ x, y, width, height, opacity });
      const placeholder = () => {
        group.add(
          new Konva.Rect({
            width,
            height,
            fill: '#0f172a',
            stroke: '#475569',
            strokeWidth: 2,
            dash: [6, 4],
            cornerRadius: 6,
          }),
        );
        group.add(
          new Konva.Text({
            width,
            height,
            text: `[Image : ${field.label}]`,
            fill: '#94a3b8',
            fontSize: 13,
            align: 'center',
            verticalAlign: 'middle',
          }),
        );
      };
      layer.add(group);

      if (src) {
        imageLoads.push(
          new Promise<void>((resolve) => {
            const img = new window.Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              group.add(new Konva.Image({ image: img, width, height }));
              resolve();
            };
            // A CORS-blocked image falls back to a placeholder instead of
            // tainting the canvas and breaking every export.
            img.onerror = () => {
              placeholder();
              resolve();
            };
            img.src = src;
          }),
        );
      } else {
        placeholder();
      }
    }
  }

  await Promise.all(imageLoads);
  try {
    return stage.toDataURL({ pixelRatio });
  } finally {
    stage.destroy();
  }
}
