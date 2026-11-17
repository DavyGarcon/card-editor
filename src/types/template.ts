export type FieldType = 'text' | 'box' | 'select' | 'image';

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
  defaultValue?: string;
  // Text & Select styling
  fontSize?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  // Box styling
  fill?: string;
  // Select options
  options?: SelectOption[];
  // Image options
  opacity?: number;
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
