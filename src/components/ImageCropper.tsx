import React, { useState, useRef, useEffect, useCallback } from 'react';
import { loadImage } from '../utils/imageLoader';

export interface ImageCropperProps {
  /** Image source (Data URL or external URL with CORS enabled) */
  imageSrc: string;
  /** Target aspect ratio (field.width / field.height) */
  aspectRatio?: number;
  /** Output resolution width in pixels (defaults to 600 for crisp 2x export) */
  outputWidth?: number;
  /** Callback fired with the cropped image Data URL */
  onCropComplete: (croppedDataUrl: string) => void;
  /** Callback to close the modal without saving */
  onCancel: () => void;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
  imageSrc,
  aspectRatio = 1,
  outputWidth = 600,
  onCropComplete,
  onCancel,
}) => {
  const [loadedImage, setLoadedImage] = useState<{
    src: string;
    image: HTMLImageElement;
  } | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [error, setError] = useState<{ src: string; message: string } | null>(null);
  const [exportWidth, setExportWidth] = useState<number>(outputWidth);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Modal semantics: focus is trapped inside, Escape cancels, focus returns to
  // the trigger when the dialog closes.
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onCancel]);

  // Viewport preview dimensions constrained within a 360x360 box
  const maxViewport = 360;
  const viewportWidth = aspectRatio >= 1 ? maxViewport : Math.round(maxViewport * aspectRatio);
  const viewportHeight = aspectRatio >= 1 ? Math.round(maxViewport / aspectRatio) : maxViewport;

  const imageEl = loadedImage?.src === imageSrc ? loadedImage.image : null;
  const errorMessage = error?.src === imageSrc ? error.message : null;

  // Load image safely through the shared loader (timeout + CORS handling).
  useEffect(() => {
    let cancelled = false;
    loadImage(imageSrc, 8000).then((img) => {
      if (cancelled) return;
      if (!img) {
        setError({
          src: imageSrc,
          message: "Impossible de charger l'image (fichier invalide, expiration ou droits CORS).",
        });
        return;
      }
      setLoadedImage({ src: imageSrc, image: img });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    });
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  // Compute cover scale so the image always fills the crop box at zoom = 1
  const getBaseScale = useCallback(
    (img: HTMLImageElement) => {
      const scaleX = viewportWidth / img.naturalWidth;
      const scaleY = viewportHeight / img.naturalHeight;
      return Math.max(scaleX, scaleY);
    },
    [viewportWidth, viewportHeight],
  );

  // Clamp pan offset so empty borders never appear inside the crop frame
  const clampOffset = useCallback(
    (rawX: number, rawY: number, currentZoom: number, img: HTMLImageElement) => {
      const scale = getBaseScale(img) * currentZoom;
      const scaledW = img.naturalWidth * scale;
      const scaledH = img.naturalHeight * scale;
      const maxX = Math.max(0, (scaledW - viewportWidth) / 2);
      const maxY = Math.max(0, (scaledH - viewportHeight) / 2);

      return {
        x: Math.min(maxX, Math.max(-maxX, rawX)),
        y: Math.min(maxY, Math.max(-maxY, rawY)),
      };
    },
    [getBaseScale, viewportWidth, viewportHeight],
  );

  // Draw live preview onto the interactive canvas
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !imageEl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, viewportWidth, viewportHeight);

    const scale = getBaseScale(imageEl) * zoom;
    const drawW = imageEl.naturalWidth * scale;
    const drawH = imageEl.naturalHeight * scale;
    const drawX = (viewportWidth - drawW) / 2 + offset.x;
    const drawY = (viewportHeight - drawH) / 2 + offset.y;

    ctx.drawImage(imageEl, drawX, drawY, drawW, drawH);

    // Draw rule-of-thirds alignment grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(viewportWidth / 3, 0);
    ctx.lineTo(viewportWidth / 3, viewportHeight);
    ctx.moveTo((viewportWidth * 2) / 3, 0);
    ctx.lineTo((viewportWidth * 2) / 3, viewportHeight);
    ctx.moveTo(0, viewportHeight / 3);
    ctx.lineTo(viewportWidth, viewportHeight / 3);
    ctx.moveTo(0, (viewportHeight * 2) / 3);
    ctx.lineTo(viewportWidth, (viewportHeight * 2) / 3);
    ctx.stroke();
  }, [imageEl, zoom, offset, viewportWidth, viewportHeight, getBaseScale]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || !imageEl) return;
    const nextOffset = clampOffset(e.clientX - dragStart.x, e.clientY - dragStart.y, zoom, imageEl);
    setOffset(nextOffset);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleCanvasKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!imageEl) return;
    const step = 12;
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowLeft') dx = -step;
    else if (event.key === 'ArrowRight') dx = step;
    else if (event.key === 'ArrowUp') dy = -step;
    else if (event.key === 'ArrowDown') dy = step;
    else return;
    event.preventDefault();
    setOffset((prev) => clampOffset(prev.x + dx, prev.y + dy, zoom, imageEl));
  };

  const handleZoomChange = (nextZoom: number) => {
    setZoom(nextZoom);
    if (imageEl) {
      setOffset((prev) => clampOffset(prev.x, prev.y, nextZoom, imageEl));
    }
  };

  const handleConfirm = () => {
    if (!imageEl) return;

    const width = Math.min(4000, Math.max(16, Math.round(exportWidth) || outputWidth));
    const exportHeight = Math.round(width / aspectRatio);
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = exportHeight;

    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    const ratioFactor = width / viewportWidth;
    const scale = getBaseScale(imageEl) * zoom * ratioFactor;
    const drawW = imageEl.naturalWidth * scale;
    const drawH = imageEl.naturalHeight * scale;
    const drawX = (width - drawW) / 2 + offset.x * ratioFactor;
    const drawY = (exportHeight - drawH) / 2 + offset.y * ratioFactor;

    ctx.drawImage(imageEl, drawX, drawY, drawW, drawH);

    try {
      const dataUrl = exportCanvas.toDataURL('image/png');
      onCropComplete(dataUrl);
    } catch {
      setError({
        src: imageSrc,
        message: "Export impossible : l'image externe bloque la lecture du canevas (CORS).",
      });
    }
  };

  return (
    <div style={styles.backdrop}>
      <div
        ref={modalRef}
        style={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-cropper-title"
      >
        <h3 id="image-cropper-title" style={styles.title}>
          Recadrer l'illustration
        </h3>

        {errorMessage ? (
          <div style={styles.errorBox}>{errorMessage}</div>
        ) : (
          <>
            <div style={styles.canvasWrapper}>
              <canvas
                ref={previewCanvasRef}
                width={viewportWidth}
                height={viewportHeight}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onKeyDown={handleCanvasKeyDown}
                tabIndex={0}
                role="img"
                aria-label="Aperçu du recadrage — utilisez les flèches du clavier pour déplacer l'image"
                style={{
                  ...styles.canvas,
                  cursor: isDragging ? 'grabbing' : 'grab',
                }}
              />
            </div>

            <div style={styles.controls}>
              <label style={styles.zoomLabel}>
                Zoom ({Math.round(zoom * 100)}%)
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => handleZoomChange(Number(e.target.value))}
                  style={styles.slider}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
                style={styles.secondaryButton}
              >
                Réinitialiser
              </button>
              <label style={styles.zoomLabel}>
                Résolution (px)
                <input
                  type="number"
                  min={16}
                  max={4000}
                  value={exportWidth}
                  onChange={(e) => setExportWidth(Number(e.target.value))}
                  style={styles.numberInput}
                />
              </label>
            </div>
          </>
        )}

        <div style={styles.actions}>
          <button type="button" onClick={onCancel} style={styles.secondaryButton}>
            Annuler
          </button>
          <button
            type="button"
            disabled={!imageEl || Boolean(errorMessage)}
            onClick={handleConfirm}
            style={styles.primaryButton}
          >
            Appliquer le recadrage
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '10px',
    padding: '20px',
    width: '420px',
    maxWidth: '95vw',
    color: '#f8fafc',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
  },
  title: {
    margin: '0 0 14px 0',
    fontSize: '16px',
    fontWeight: 600,
  },
  canvasWrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #334155',
  },
  canvas: {
    border: '2px solid #f59e0b',
    borderRadius: '4px',
    touchAction: 'none',
    display: 'block',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '14px',
  },
  zoomLabel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '12px',
    color: '#cbd5e1',
  },
  slider: {
    width: '100%',
    accentColor: '#f59e0b',
  },
  numberInput: {
    width: '100%',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    border: '1px solid #334155',
    borderRadius: '4px',
    padding: '5px 7px',
    fontSize: '13px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '18px',
  },
  primaryButton: {
    backgroundColor: '#f59e0b',
    color: '#0f172a',
    border: 'none',
    borderRadius: '6px',
    padding: '7px 14px',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
  },
  secondaryButton: {
    backgroundColor: '#334155',
    color: '#f8fafc',
    border: 'none',
    borderRadius: '6px',
    padding: '7px 12px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  errorBox: {
    padding: '12px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    color: '#fca5a5',
    fontSize: '13px',
  },
};

export default ImageCropper;
