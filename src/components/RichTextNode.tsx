import React, { useEffect, useMemo, useRef } from 'react';
import { Group, Text, Transformer } from 'react-konva';
import Konva from 'konva';
import { TemplateField } from '../types/template';
import { parseRichTextToSegments } from './RichTextEditor';
import { layoutRichText } from '../utils/richTextLayout';

export interface RichTextNodeProps {
  /** HTML produced by RichTextEditor (or by a script override). */
  html: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  align: 'left' | 'center' | 'right';
  opacity: number;
  verticalAlign?: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
  letterSpacing?: number;
  stroke?: string;
  strokeWidth?: number;
  isDesignMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updated: Partial<TemplateField>) => void;
  canDrag?: boolean;
  canResize?: boolean;
}

function toKonvaFontStyle(bold: boolean, italic: boolean): string {
  if (bold && italic) return 'bold italic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'normal';
}

/** Konva canvas node that draws an HTML-backed rich-text field as styled runs. */
export const RichTextNode: React.FC<RichTextNodeProps> = ({
  html,
  label,
  x,
  y,
  width,
  height,
  fontSize,
  fontFamily,
  color,
  align,
  opacity,
  verticalAlign,
  lineHeight,
  letterSpacing,
  stroke,
  strokeWidth,
  isDesignMode,
  isSelected,
  onSelect,
  onChange,
  canDrag = true,
  canResize = true,
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const runs = useMemo(
    () =>
      layoutRichText(parseRichTextToSegments(html || ''), {
        width,
        fontSize,
        align,
        fontFamily,
        height,
        lineHeight,
        verticalAlign,
        letterSpacing,
      }),
    [html, width, height, fontSize, align, fontFamily, lineHeight, verticalAlign, letterSpacing],
  );

  useEffect(() => {
    if (isSelected && isDesignMode && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, isDesignMode, runs]);

  const handleTransformEnd = () => {
    const node = groupRef.current;
    if (!node || (!canDrag && !canResize)) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    onChange({
      x: canDrag ? Math.round(node.x()) : x,
      y: canDrag ? Math.round(node.y()) : y,
      width: canResize ? Math.max(20, Math.round(node.width() * scaleX)) : width,
      height: canResize ? Math.max(20, Math.round(node.height() * scaleY)) : height,
    });
  };

  return (
    <>
      <Group
        ref={groupRef}
        name="template-field"
        x={x}
        y={y}
        width={width}
        height={height}
        opacity={opacity}
        draggable={isDesignMode && canDrag}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          if (canDrag) onChange({ x: Math.round(e.target.x()), y: Math.round(e.target.y()) });
        }}
        onTransformEnd={handleTransformEnd}
      >
        {runs.length === 0 ? (
          <Text
            text={`[${label}]`}
            fontSize={fontSize}
            fontFamily={fontFamily}
            fill="#64748b"
            listening={false}
          />
        ) : (
          runs.map((run, index) => (
            <Text
              key={index}
              x={run.x}
              y={run.y}
              text={run.text}
              fontFamily={fontFamily}
              fontSize={fontSize}
              fontStyle={toKonvaFontStyle(run.bold, run.italic)}
              textDecoration={run.underline ? 'underline' : ''}
              fill={color}
              lineHeight={lineHeight}
              letterSpacing={letterSpacing}
              stroke={stroke}
              strokeWidth={strokeWidth}
              listening={false}
            />
          ))
        )}
      </Group>

      {isSelected && isDesignMode && (
        <Transformer
          name="template-transformer"
          enabledAnchors={canResize ? undefined : []}
          ref={transformerRef}
          rotateEnabled={false}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 20 || newBox.height < 20 ? oldBox : newBox
          }
        />
      )}
    </>
  );
};
