import React, { useState, useEffect } from 'react';

export interface ColorPickerProps {
  /** Optional field label */
  label?: string;
  /** Current CSS/Hex color value (e.g. "#f59e0b") */
  value: string;
  /** Callback fired whenever a valid color is selected or entered */
  onChange: (hexColor: string) => void;
  /** Preset palette swatches for quick tabletop/card styling */
  presets?: string[];
  /** Allow clearing/resetting to transparent */
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

export const ColorPicker: React.FC<ColorPickerProps> = ({
  label,
  value,
  onChange,
  presets = DEFAULT_CARD_SWATCHES,
  allowTransparent = false,
}) => {
  const [textInput, setTextInput] = useState<string>(value || '#ffffff');
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    setTextInput(value || '#ffffff');
  }, [value]);

  const handleTextChange = (raw: string) => {
    setTextInput(raw);
    const normalized = raw.startsWith('#') ? raw : `#${raw}`;
    if (HEX_REGEX.test(normalized)) {
      onChange(normalized.toLowerCase());
    } else if (allowTransparent && raw.trim().toLowerCase() === 'transparent') {
      onChange('transparent');
    }
  };

  // Native <input type="color"> requires a strict 6-digit hex string (#rrggbb)
  const safeNativeHex = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#1e293b';

  return (
    <div style={styles.wrapper}>
      {label && <label style={styles.label}>{label}</label>}

      <div style={styles.controlRow}>
        {/* Native Spectrum Color Wheel */}
        <input
          type="color"
          aria-label={label || 'Select color'}
          value={safeNativeHex}
          onChange={(e) => {
            const next = e.target.value.toLowerCase();
            setTextInput(next);
            onChange(next);
          }}
          style={styles.nativeSwatch}
        />

        {/* Hex Text Input */}
        <input
          type="text"
          value={textInput}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="#f59e0b"
          maxLength={11}
          style={styles.hexInput}
        />

        {/* Toggle Swatch Popover */}
        <button
          type="button"
          title="Toggle preset palette"
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
                    setTextInput(swatch);
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
                  setTextInput('transparent');
                  onChange('transparent');
                }}
                style={{
                  ...styles.swatchButton,
                  ...styles.transparentSwatch,
                  outline:
                    value === 'transparent' ? '2px solid #f59e0b' : '1px solid #475569',
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
