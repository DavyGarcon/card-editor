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
  /** For "richtext" fields this holds an HTML string (bold/italic/underline/lists). */
  defaultValue?: string;
  // Text & Select styling
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  // Box styling
  fill?: string;
  // Select options
  options?: SelectOption[];
  // Image options
  opacity?: number;
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
