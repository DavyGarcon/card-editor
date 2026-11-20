export type FieldType = 'text' | 'box' | 'select' | 'image' | 'richtext';

export interface SelectOption {
  value: string;
  label: string;
}

export interface TemplateField {
  id: string;
  label: string;
  type: FieldType;
  x: number;
  y: number;
  width: number;
  height: number;
  z?: number;
  /** Local override that changes only the stacking order of an inherited field. */
  zOnly?: boolean;
  /** For "richtext" fields this holds an HTML string (bold/italic/underline/lists). */
  defaultValue?: string;
  // Text & Select styling
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
  letterSpacing?: number;
  stroke?: string;
  strokeWidth?: number;
  // Transform (applied to every field type)
  /** Rotation in degrees around the field's top-left origin. */
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  // Box styling
  fill?: string;
  // Select options
  options?: SelectOption[];
  // Image options
  opacity?: number;
  /** For image fields: id of another image field whose source is shared. */
  linkedTo?: string;
  // Editable in card mode (default: true)
  editableInCard?: boolean;
  // Custom JS rendering script
  script?: string;
}

export interface CardStyleDefinition {
  key: string;
  name: string;
  basedOn?: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
  borderColor?: string;
  fields: TemplateField[];
}

export interface CardTemplatePack {
  name: string;
  activeStyleKey?: string;
  styles: CardStyleDefinition[];
}

export interface ResolvedCardStyle {
  key: string;
  name: string;
  basedOn?: string;
  width: number;
  height: number;
  backgroundColor: string;
  borderColor: string;
  fields: TemplateField[];
}

export interface CardData {
  id: string;
  styleKey: string;
  values: Record<string, string>;
}
