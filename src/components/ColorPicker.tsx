import React, { useState } from 'react';

export interface ColorPickerProps {
  /** Optional field label */
  label?: string;
  /** Current CSS/Hex color value (e.g. "#f59e0b") */
  value: string;
  /** Callback fired whenever a valid color is selected or entered */
  onChange: (hexColor: string) => void;
  /** Preset palette swatches for quick tabletop/card styling */
  presets?: string[];
  /** Allow clearing/resetting to transparent (enabled by default) */
  allowTransparent?: boolean;
}

export const DEFAULT_CARD_SWATCHES: string[] = [
  '#ffffff', // White
  '#f8fafc', // Slate 50
  '#94a3b8', // Slate 400
  '#1e293b', // Slate 800
  '#0f172a', // Slate 900
  '#000000', // Black
  '#ef4444', // Crimson Red
  '#f97316', // Flame Orange
  '#f59e0b', // Legendary Gold
  '#eab308', // Yellow
  '#22c55e', // Nature Green
  '#14b8a6', // Teal
  '#38bdf8', // Arcane Sky
  '#3b82f6', // Royal Blue
  '#8b5cf6', // Mystic Violet
  '#a855f7', // Rare Purple
  '#ec4899', // Rose
  '#78350f', // Leather Brown
];

const HEX_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

/** Native <input type="color"> only accepts 6-digit hex, so normalize everything else. */
function toNativeHex(value: string): string {
  const short = /^#([0-9A-Fa-f]{3})$/.exec(value);
  if (short) {
    const [, r, g, b] = /^#([0-9A-Fa-f])([0-9A-Fa-f])([0-9A-Fa-f])$/.exec(value)!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toLowerCase() : '#1e293b';
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  label,
  value,
  onChange,
  presets = DEFAULT_CARD_SWATCHES,
  allowTransparent = true,
}) => {
  // `draft` is only set while the user types; the prop stays the source of truth.
  const [draft, setDraft] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputId = React.useId();

  const handleTextChange = (raw: string) => {
    setDraft(raw);
    const normalized = raw.startsWith('#') ? raw : `#${raw}`;
    if (HEX_REGEX.test(normalized)) {
      const hex = normalized.toLowerCase();
      onChange(hex.length === 4 ? toNativeHex(hex) : hex);
    } else if (allowTransparent && raw.trim().toLowerCase() === 'transparent') {
      onChange('transparent');
    }
  };

  const safeNativeHex = toNativeHex(value);

  return (
    <div style={styles.wrapper}>
      {label && (
        <label htmlFor={inputId} style={styles.label}>
          {label}
        </label>
      )}

      <div style={styles.controlRow}>
        {/* Native Spectrum Color Wheel */}
        <input
          type="color"
          aria-label={label || 'Select color'}
          value={safeNativeHex}
          onChange={(e) => {
            const next = e.target.value.toLowerCase();
            setDraft(next);
            onChange(next);
          }}
          style={styles.nativeSwatch}
        />

        {/* Hex Text Input */}
        <input
          id={inputId}
          type="text"
          value={draft ?? value ?? '#ffffff'}
          onChange={(e) => handleTextChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            setDraft(null);
          }}
          aria-label={label || 'Couleur hexadécimale'}
          placeholder="#f59e0b"
          maxLength={11}
          style={{ ...styles.hexInput, ...(isFocused ? styles.hexInputFocused : {}) }}
        />

        {/* Toggle Swatch Popover */}
        <button
          type="button"
          title="Afficher la palette de couleurs"
          aria-label="Afficher la palette de couleurs"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          style={styles.paletteToggle}
        >
          🎨
        </button>
      </div>

      {/* Quick Swatch Palette */}
      {isOpen && (
        <div style={styles.popover}>
          <div style={styles.swatchGrid}>
            {presets.map((swatch) => {
              const isSelected = value?.toLowerCase() === swatch.toLowerCase();
              return (
                <button
                  key={swatch}
                  type="button"
                  title={swatch}
                  onClick={() => {
                    setDraft(swatch);
                    onChange(swatch);
                  }}
                  style={{
                    ...styles.swatchButton,
                    backgroundColor: swatch,
                    outline: isSelected ? '2px solid #f59e0b' : '1px solid #475569',
                  }}
                />
              );
            })}

            {allowTransparent && (
              <button
                type="button"
                title="Transparent"
                onClick={() => {
                  setDraft('transparent');
                  onChange('transparent');
                }}
                style={{
                  ...styles.swatchButton,
                  ...styles.transparentSwatch,
                  outline: value === 'transparent' ? '2px solid #f59e0b' : '1px solid #475569',
                }}
              >
                ∅
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '12px',
    color: '#cbd5e1',
    fontWeight: 500,
  },
  controlRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '4px 6px',
  },
  nativeSwatch: {
    width: '26px',
    height: '26px',
    padding: 0,
    border: 'none',
    borderRadius: '4px',
    backgroundColor: 'transparent',
    cursor: 'pointer',
  },
  hexInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'transparent',
    border: 'none',
    color: '#f8fafc',
    fontSize: '13px',
    fontFamily: 'monospace',
    outline: 'none',
  },
  hexInputFocused: {
    outline: '2px solid #f59e0b',
    outlineOffset: '2px',
    borderRadius: '3px',
  },
  paletteToggle: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '12px',
    cursor: 'pointer',
    color: '#f8fafc',
  },
  popover: {
    marginTop: '4px',
    padding: '8px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '6px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
  },
  swatchGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '6px',
  },
  swatchButton: {
    width: '22px',
    height: '22px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    padding: 0,
  },
  transparentSwatch: {
    backgroundColor: '#0f172a',
    color: '#94a3b8',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

export default ColorPicker;
