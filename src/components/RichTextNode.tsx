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
  color: string;
  align: 'left' | 'center' | 'right';
  opacity: number;
  isDesignMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updated: Partial<TemplateField>) => void;
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
  color,
  align,
  opacity,
  isDesignMode,
  isSelected,
  onSelect,
  onChange,
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const runs = useMemo(
    () => layoutRichText(parseRichTextToSegments(html || ''), { width, fontSize, align }),
    [html, width, fontSize, align]
  );

  useEffect(() => {
    if (isSelected && isDesignMode && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, isDesignMode, runs]);

  const handleTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    onChange({
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      width: Math.max(20, Math.round(node.width() * scaleX)),
      height: Math.max(20, Math.round(node.height() * scaleY)),
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
        draggable={isDesignMode}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) =>
          onChange({ x: Math.round(e.target.x()), y: Math.round(e.target.y()), width, height })
        }
        onTransformEnd={handleTransformEnd}
      >
        {runs.length === 0 ? (
          <Text
            text={`[${label}]`}
            fontSize={fontSize}
            fontFamily="Arial"
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
              fontFamily="Arial"
              fontSize={fontSize}
              fontStyle={toKonvaFontStyle(run.bold, run.italic)}
              textDecoration={run.underline ? 'underline' : ''}
              fill={color}
              listening={false}
            />
          ))
        )}
      </Group>

      {isSelected && isDesignMode && (
        <Transformer
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
