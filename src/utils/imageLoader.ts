/**
 * Shared image helpers used by the live canvas, the cropper and detached
 * exports. A single implementation keeps timeout / CORS behaviour consistent.
 */

export function loadImage(
  src: string,
  timeoutMs = 8000,
  crossOrigin: string | null = 'anonymous',
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new window.Image();
    let settled = false;
    const finish = (result: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
      resolve(result);
    };
    const timeout = window.setTimeout(() => finish(null), timeoutMs);
    if (crossOrigin !== null) img.crossOrigin = crossOrigin;
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = src;
  });
}

/** Converts a Data URL into a Blob without keeping the huge base64 string around. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const separator = dataUrl.indexOf(',');
  if (separator === -1) throw new Error('Image Data URL invalide.');
  const header = dataUrl.slice(0, separator);
  const payload = dataUrl.slice(separator + 1);
  const mime = /^data:([^;]+)/.exec(header)?.[1] ?? 'image/png';

  if (/;base64$/i.test(header)) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(payload)], { type: mime });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Impossible de lire le fichier image.'));
    reader.readAsDataURL(blob);
  });
}

const MAX_IMAGE_EDGE = 1600;
const MAX_INLINE_BYTES = 300_000;
const TARGET_MIME = 'image/webp';
const TARGET_QUALITY = 0.82;

/**
 * Downscales and re-encodes artwork so a deck cannot silently exhaust the
 * browser's storage quota. Images that are already small are returned as-is.
 */
export async function compressImageBlob(blob: Blob): Promise<Blob> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await loadImage(objectUrl, 10_000, null);
    if (!img) return blob;
    const longestEdge = Math.max(img.naturalWidth, img.naturalHeight);
    if (!Number.isFinite(longestEdge) || longestEdge <= 0) return blob;
    const scale = Math.min(1, MAX_IMAGE_EDGE / longestEdge);
    if (scale === 1 && blob.size <= MAX_INLINE_BYTES) return blob;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const encoded = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, TARGET_MIME, TARGET_QUALITY),
    );
    return encoded ?? blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
