import { useState } from 'react';
import { AlertCircle, HelpCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { STRINGS } from '../i18n/strings';
import { clampNumber } from '../utils/numbers';
import { PAPER_FORMATS, type PaperOrientation, type PaperSize } from '../utils/paperFormats';
import {
  inputStyle,
  labelStyle,
  modalBackdropStyle,
  modalStyle,
  smallBtnStyle,
  toolBtnStyle,
} from './uiStyles';

/** Error strip displayed above the preview. */
export interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: '#7f1d1d',
        color: '#fecaca',
        padding: '8px 14px',
        borderRadius: '6px',
        fontSize: '13px',
      }}
    >
      <AlertCircle size={16} />
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onDismiss}
        aria-label={STRINGS.closeMessage}
        style={{
          background: 'none',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        ×
      </button>
    </div>
  );
}

export interface ZoomToolbarProps {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomChange: (zoom: number) => void;
}

export function ZoomToolbar({
  zoom,
  minZoom,
  maxZoom,
  onZoomIn,
  onZoomOut,
  onZoomChange,
}: ZoomToolbarProps) {
  // `draft` is only set while the user is typing; otherwise the value is
  // derived from the zoom prop so external zoom changes stay in sync.
  const [draft, setDraft] = useState<string | null>(null);
  const displayed = draft ?? String(Math.round(zoom * 100));

  const commit = (raw: string) => {
    const parsed = Number(raw);
    const percent =
      raw.trim() !== '' && Number.isFinite(parsed)
        ? Math.min(maxZoom * 100, Math.max(minZoom * 100, parsed))
        : zoom * 100;
    setDraft(null);
    onZoomChange(Math.round(percent) / 100);
  };

  const handleChange = (raw: string) => {
    setDraft(raw);
    const parsed = Number(raw);
    if (
      raw.trim() !== '' &&
      Number.isFinite(parsed) &&
      parsed >= minZoom * 100 &&
      parsed <= maxZoom * 100
    ) {
      onZoomChange(Math.round(parsed) / 100);
    }
  };

  return (
    <div className="zoom-toolbar" role="group" aria-label="Zoom de l'aperçu">
      <button
        onClick={onZoomOut}
        disabled={zoom <= minZoom}
        title={STRINGS.zoomOut}
        aria-label={STRINGS.zoomOut}
        className="io-button"
      >
        <ZoomOut size={15} />
      </button>
      <input
        type="number"
        className="zoom-value"
        aria-label={STRINGS.zoomLevel}
        title={STRINGS.zoomLevel}
        min={minZoom * 100}
        max={maxZoom * 100}
        step={1}
        value={displayed}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(event.currentTarget.value);
        }}
      />
      <span className="zoom-value-suffix" aria-hidden="true">
        %
      </span>
      <button
        onClick={onZoomIn}
        disabled={zoom >= maxZoom}
        title={STRINGS.zoomIn}
        aria-label={STRINGS.zoomIn}
        className="io-button"
      >
        <ZoomIn size={15} />
      </button>
    </div>
  );
}

/** Inline help for the restricted render-script interpreter. */
export function ScriptHelpPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={labelStyle}>{STRINGS.script}</label>
        <button
          type="button"
          onClick={onToggle}
          style={smallBtnStyle}
          aria-expanded={open}
          title={STRINGS.scriptHelp}
        >
          <HelpCircle size={12} /> {STRINGS.scriptHelp}
        </button>
      </div>
      {open && (
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '10px',
            marginBottom: '8px',
            fontSize: '11px',
            lineHeight: 1.5,
            color: '#cbd5e1',
          }}
        >
          Variables&nbsp;: <code>card</code> (valeurs), <code>style</code>, <code>field</code>.
          <br />
          Retournez un objet avec <code>text</code>, <code>color</code>, <code>visible</code>,{' '}
          <code>src</code>, <code>x</code>, <code>y</code>, <code>width</code>, <code>height</code>,{' '}
          <code>fontSize</code>, <code>opacity</code>, <code>rotation</code>, <code>flipX</code>,{' '}
          <code>flipY</code>.<br />
          Supporte <code>const</code>/<code>let</code>, <code>if</code>/<code>else</code>,{' '}
          <code>return</code>, les littéraux de gabarit et les helpers <code>Math</code> /{' '}
          <code>String</code>.<br />
          Exemple&nbsp;:
          <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>
            {`if (card.hp > 5) { return { color: '#22c55e' }; }
return { color: '#ef4444' };`}
          </pre>
        </div>
      )}
    </div>
  );
}

export interface PdfPrintOptions {
  paperSize: PaperSize;
  orientation: PaperOrientation;
  gapMm: number;
  drawCropMarks: boolean;
}

export interface PdfOptionsDialogProps {
  options: PdfPrintOptions;
  /** Read-only print width derived from the active template (150 DPI). */
  cardWidthMm: number;
  onChange: (options: PdfPrintOptions) => void;
  onCancel: () => void;
  onGenerate: () => void;
}

/** Modal for the PDF page layout settings. */
export function PdfOptionsDialog({
  options,
  cardWidthMm,
  onChange,
  onCancel,
  onGenerate,
}: PdfOptionsDialogProps) {
  return (
    <div style={modalBackdropStyle} onMouseDown={onCancel} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-options-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel();
        }}
        style={modalStyle}
      >
        <h3 id="pdf-options-title" style={{ marginTop: 0, fontSize: '16px' }}>
          {STRINGS.pdfOptions}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ ...labelStyle, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {STRINGS.paperSize}
            <select
              autoFocus
              value={options.paperSize}
              onChange={(event) =>
                onChange({ ...options, paperSize: event.target.value as PaperSize })
              }
              style={inputStyle}
            >
              {PAPER_FORMATS.map((format) => (
                <option key={format.id} value={format.id}>
                  {format.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ ...labelStyle, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {STRINGS.orientation}
            <select
              value={options.orientation}
              onChange={(event) =>
                onChange({ ...options, orientation: event.target.value as PaperOrientation })
              }
              style={inputStyle}
            >
              <option value="portrait">{STRINGS.portrait}</option>
              <option value="landscape">{STRINGS.landscape}</option>
            </select>
          </label>
          <div>
            <span style={labelStyle}>{STRINGS.cardWidth}</span>
            <div style={{ fontSize: '13px', color: '#f8fafc' }}>
              {cardWidthMm.toFixed(1)} mm{' '}
              <span style={{ color: '#94a3b8' }}>(déduite du modèle, 150 DPI)</span>
            </div>
          </div>
          <label style={{ ...labelStyle, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {STRINGS.gap}
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={options.gapMm}
              onChange={(event) =>
                onChange({ ...options, gapMm: clampNumber(event.target.value, 2, 0, 20) })
              }
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={options.drawCropMarks}
              onChange={(event) => onChange({ ...options, drawCropMarks: event.target.checked })}
            />
            {STRINGS.cropMarks}
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
          <button onClick={onCancel} style={smallBtnStyle}>
            {STRINGS.cancel}
          </button>
          <button onClick={onGenerate} style={toolBtnStyle}>
            {STRINGS.generate}
          </button>
        </div>
      </div>
    </div>
  );
}
