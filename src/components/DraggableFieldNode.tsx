import React, { useRef, useEffect } from 'react';
import { Rect, Text, Image as KonvaImage, Group, Transformer } from 'react-konva';
import Konva from 'konva';
import { ResolvedCardStyle, TemplateField } from '../types/template';
import { evaluateFieldScript } from '../utils/scriptEvaluator';
import { useImage } from '../hooks/useImage';
import { RichTextNode } from './RichTextNode';

interface DraggableNodeProps {
  field: TemplateField;
  rawValue: string;
  allCardValues: Record<string, string>;
  resolvedStyle: ResolvedCardStyle;
  isDesignMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updated: Partial<TemplateField>) => void;
  onScriptError?: (fieldId: string, error: string | null) => void;
}

export const DraggableFieldNode: React.FC<DraggableNodeProps> = ({
  field,
  rawValue,
  allCardValues,
  resolvedStyle,
  isDesignMode,
  isSelected,
  onSelect,
  onChange,
  onScriptError,
}) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const computed = evaluateFieldScript(field.script, {
    card: allCardValues,
    style: resolvedStyle as unknown as Record<string, unknown>,
    field: field as unknown as Record<string, unknown>,
  });

  const isVisible = computed.visible !== undefined ? computed.visible : true;

  const effectiveX = computed.x ?? field.x;
  const effectiveY = computed.y ?? field.y;
  const effectiveWidth = computed.width ?? field.width;
  const effectiveHeight = computed.height ?? field.height;
  const effectiveColor = computed.color ?? field.color ?? '#ffffff';
  const effectiveFill = computed.fill ?? field.fill ?? '#0f172a';
  const effectiveFontSize = computed.fontSize ?? field.fontSize ?? 16;
  const effectiveFontFamily = field.fontFamily || 'Arial';
  const effectiveOpacity =
    (computed.opacity ?? field.opacity ?? 1) * (!isVisible && isDesignMode ? 0.3 : 1);

  // Script-controlled geometry cannot be dragged/resized — the computed value
  // would immediately overwrite the edit on the next render.
  const scriptControlsPosition = computed.x !== undefined || computed.y !== undefined;
  const scriptControlsSize = computed.width !== undefined || computed.height !== undefined;

  useEffect(() => {
    onScriptError?.(field.id, computed.error ?? null);
  }, [field.id, computed.error, onScriptError]);

  // Resolve display text for text & select fields. rawValue already contains
  // the fallback default, so an intentionally empty value stays empty.
  let displayText = rawValue;
  if (field.type === 'select' && field.options && field.options.length > 0) {
    const matched = field.options.find((opt) => opt.value === rawValue);
    displayText = matched ? matched.label : displayText;
  }
  if (computed.text !== undefined) {
    displayText = computed.text;
  }

  // Image loading for image fields
  const imageSrc = computed.src ?? rawValue ?? field.defaultValue ?? '';
  // Pending, failed or timed-out loads show the placeholder instead of a stale image.
  const loadedImg = useImage(field.type === 'image' ? imageSrc : undefined);

  useEffect(() => {
    if (isSelected && isDesignMode && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, isDesignMode, field.type, loadedImg]);

  if (!isVisible && !isDesignMode) {
    return null;
  }

  if (field.type === 'richtext') {
    return (
      <RichTextNode
        html={displayText}
        label={field.label}
        x={effectiveX}
        y={effectiveY}
        width={effectiveWidth}
        height={effectiveHeight}
        fontSize={effectiveFontSize}
        fontFamily={effectiveFontFamily}
        color={effectiveColor}
        align={field.align || 'left'}
        opacity={effectiveOpacity}
        verticalAlign={field.verticalAlign}
        lineHeight={field.lineHeight}
        letterSpacing={field.letterSpacing}
        stroke={field.stroke}
        strokeWidth={field.strokeWidth}
        isDesignMode={isDesignMode}
        isSelected={isSelected}
        onSelect={onSelect}
        onChange={onChange}
        canDrag={!scriptControlsPosition}
        canResize={!scriptControlsSize}
      />
    );
  }

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    onChange({
      x: scriptControlsPosition ? field.x : Math.round(node.x()),
      y: scriptControlsPosition ? field.y : Math.round(node.y()),
      width: scriptControlsSize ? field.width : Math.max(20, Math.round(node.width() * scaleX)),
      height: scriptControlsSize ? field.height : Math.max(20, Math.round(node.height() * scaleY)),
    });
  };

  return (
    <>
      {field.type === 'box' && (
        <Rect
          name="template-field"
          ref={shapeRef}
          x={effectiveX}
          y={effectiveY}
          width={effectiveWidth}
          height={effectiveHeight}
          fill={effectiveFill}
          stroke={effectiveColor}
          strokeWidth={2}
          cornerRadius={6}
          opacity={effectiveOpacity}
          draggable={isDesignMode && !scriptControlsPosition}
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={(e) => onChange({ x: Math.round(e.target.x()), y: Math.round(e.target.y()) })}
          onTransformEnd={handleTransformEnd}
        />
      )}

      {(field.type === 'text' || field.type === 'select') && (
        <Text
          name="template-field"
          ref={shapeRef}
          x={effectiveX}
          y={effectiveY}
          width={effectiveWidth}
          height={effectiveHeight}
          text={displayText || `[${field.label}]`}
          fontSize={effectiveFontSize}
          fontFamily={effectiveFontFamily}
          fontStyle={field.id === 'title' ? 'bold' : 'normal'}
          fill={effectiveColor}
          align={field.align || 'left'}
          opacity={effectiveOpacity}
          verticalAlign={field.verticalAlign ?? 'top'}
          lineHeight={field.lineHeight}
          letterSpacing={field.letterSpacing}
          stroke={field.stroke}
          strokeWidth={field.strokeWidth}
          draggable={isDesignMode && !scriptControlsPosition}
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={(e) => onChange({ x: Math.round(e.target.x()), y: Math.round(e.target.y()) })}
          onTransformEnd={handleTransformEnd}
        />
      )}

      {field.type === 'image' && (
        <Group
          name="template-field"
          ref={shapeRef}
          x={effectiveX}
          y={effectiveY}
          width={effectiveWidth}
          height={effectiveHeight}
          opacity={effectiveOpacity}
          draggable={isDesignMode && !scriptControlsPosition}
          onClick={onSelect}
          onTap={onSelect}
          onDragEnd={(e) => onChange({ x: Math.round(e.target.x()), y: Math.round(e.target.y()) })}
          onTransformEnd={handleTransformEnd}
        >
          {loadedImg ? (
            <KonvaImage image={loadedImg} width={effectiveWidth} height={effectiveHeight} />
          ) : (
            <>
              <Rect
                width={effectiveWidth}
                height={effectiveHeight}
                fill="#0f172a"
                stroke="#475569"
                strokeWidth={2}
                dash={[6, 4]}
                cornerRadius={6}
              />
              <Text
                width={effectiveWidth}
                height={effectiveHeight}
                text={`[Image : ${field.label}]`}
                fill="#94a3b8"
                fontSize={13}
                align="center"
                verticalAlign="middle"
              />
            </>
          )}
        </Group>
      )}

      {isSelected && isDesignMode && (
        <Transformer
          name="template-transformer"
          ref={trRef}
          enabledAnchors={scriptControlsSize ? [] : undefined}
          rotateEnabled={false}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 20 || newBox.height < 20 ? oldBox : newBox
          }
        />
      )}
    </>
  );
};
