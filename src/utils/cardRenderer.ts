import Konva from 'konva';
import { CardData, ResolvedCardStyle } from '../types/template';
import { evaluateFieldScript } from './scriptEvaluator';
import { parseRichTextToSegments } from '../components/RichTextEditor';
import { layoutRichText } from './richTextLayout';
import { resolveImageRef } from '../io/imageStore';
import { loadImage } from './imageLoader';
import {
  getImageLinkMembers,
  getLinkedImageIds,
  getSharedImageSource,
  isImageSourceEditableInCard,
  resolveImageLinkRoot,
} from './imageLinks';

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
  try {
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
    const linkedImageIds = getLinkedImageIds(style.fields);

    for (const { field } of ordered) {
      // Hidden layers are Template-mode only and must never reach PNG/PDF output.
      if (field.hidden) continue;
      const sourceField =
        field.type === 'image' ? resolveImageLinkRoot(field, style.fields) : field;
      const editable =
        field.type === 'image'
          ? isImageSourceEditableInCard(field, style.fields)
          : field.editableInCard !== false;
      const rawValue = editable
        ? field.type === 'image'
          ? getSharedImageSource(field, style.fields, card.values)
          : (card.values[field.id] ?? field.defaultValue ?? '')
        : (sourceField.defaultValue ?? '');
      // Scripts see the same source for every image in a link group.
      const sharedValues =
        field.type === 'image'
          ? Object.fromEntries(
              getImageLinkMembers(sourceField.id, style.fields).map((member) => [
                member.id,
                rawValue,
              ]),
            )
          : {};
      const cardValues = editable
        ? { ...card.values, ...sharedValues }
        : { ...card.values, [field.id]: sourceField.defaultValue ?? '', ...sharedValues };
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
      const rotation = computed.rotation ?? field.rotation ?? 0;
      const flipX = computed.flipX ?? field.flipX ?? false;
      const flipY = computed.flipY ?? field.flipY ?? false;
      const transform = {
        rotation,
        scaleX: flipX ? -1 : 1,
        scaleY: flipY ? -1 : 1,
      };

      // rawValue already falls back to the default; `||` would resurrect a
      // default after the user intentionally cleared the field.
      let displayText = rawValue;
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
            strokeWidth: field.strokeWidth ?? 2,
            cornerRadius: 6,
            ...transform,
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
            verticalAlign: field.verticalAlign ?? 'top',
            lineHeight: field.lineHeight,
            letterSpacing: field.letterSpacing,
            stroke: field.stroke,
            strokeWidth: field.strokeWidth,
            ...transform,
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
          height,
          lineHeight: field.lineHeight,
          verticalAlign: field.verticalAlign,
          letterSpacing: field.letterSpacing,
        });
        const group = new Konva.Group({ x, y, width, height, ...transform, opacity });
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
              lineHeight: field.lineHeight,
              letterSpacing: field.letterSpacing,
              stroke: field.stroke,
              strokeWidth: field.strokeWidth,
            }),
          );
        }
        layer.add(group);
        continue;
      }

      if (field.type === 'image') {
        const src = linkedImageIds.has(field.id) ? rawValue : (computed.src ?? rawValue ?? '');
        const group = new Konva.Group({ x, y, width, height, ...transform, opacity });
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
            resolveImageRef(String(src))
              .then((resolved) => loadImage(resolved))
              .then((img) => {
                if (img) group.add(new Konva.Image({ image: img, width, height }));
                else placeholder();
              }),
          );
        } else {
          placeholder();
        }
      }
    }

    await Promise.all(imageLoads);
    return stage.toDataURL({ pixelRatio });
  } finally {
    stage.destroy();
  }
}
