import { blobToDataUrl, compressImageBlob, dataUrlToBlob } from '../utils/imageLoader';
import { IMAGE_STORE, openDb } from './db';

/**
 * Artwork lives in IndexedDB as Blobs; sessions only keep short `idb:` refs.
 * Legacy Data URLs remain fully supported and are returned unchanged.
 */

export const IMAGE_REF_PREFIX = 'idb:';

const objectUrls = new Map<string, string>();

function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
  );
}

export function isImageRef(value: string | undefined): boolean {
  return typeof value === 'string' && value.startsWith(IMAGE_REF_PREFIX);
}

export async function storeImageBlob(blob: Blob): Promise<string> {
  const compressed = await compressImageBlob(blob);
  const db = await openDb();
  if (!db) {
    // IndexedDB unavailable (private mode / tests): fall back to a Data URL so
    // the image still renders, even though storage remains best-effort.
    return blobToDataUrl(compressed);
  }
  const id = newId();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(IMAGE_STORE, 'readwrite');
      transaction.objectStore(IMAGE_STORE).put(compressed, id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB write failed.'));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('IndexedDB write aborted.'));
    });
    return `${IMAGE_REF_PREFIX}${id}`;
  } catch {
    // A dead `idb:` ref would render as a permanent placeholder; keep the
    // image inline instead when the transaction cannot be completed.
    return blobToDataUrl(compressed);
  }
}

export async function storeImageDataUrl(dataUrl: string): Promise<string> {
  return storeImageBlob(dataUrlToBlob(dataUrl));
}

async function readImageBlob(ref: string): Promise<Blob | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise<Blob | undefined>((resolve) => {
    try {
      const transaction = db.transaction(IMAGE_STORE, 'readonly');
      const request = transaction.objectStore(IMAGE_STORE).get(ref.slice(IMAGE_REF_PREFIX.length));
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

/**
 * Reads a stored image as an inline Data URL so it can be embedded in an
 * exported JSON file. Non-refs (already inline Data URLs or normal URLs) pass
 * through; a missing Blob keeps its ref instead of silently dropping the image.
 */
export async function readImageDataUrl(ref: string): Promise<string> {
  if (!isImageRef(ref)) return ref;
  const blob = await readImageBlob(ref);
  return blob ? blobToDataUrl(blob) : ref;
}

/** Resolves a stored ref to an object URL; Data URLs and normal URLs pass through. */
export async function resolveImageRef(ref: string): Promise<string> {
  if (!isImageRef(ref)) return ref;
  const cached = objectUrls.get(ref);
  if (cached) return cached;
  const blob = await readImageBlob(ref);
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  objectUrls.set(ref, url);
  return url;
}

export async function deleteImage(ref: string): Promise<void> {
  if (!isImageRef(ref)) return;
  const url = objectUrls.get(ref);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrls.delete(ref);
  }
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(IMAGE_STORE, 'readwrite');
      transaction.objectStore(IMAGE_STORE).delete(ref.slice(IMAGE_REF_PREFIX.length));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Removes stored blobs that are no longer referenced by any template or card. */
export async function pruneImages(activeRefs: Set<string>): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(IMAGE_STORE, 'readwrite');
      const store = transaction.objectStore(IMAGE_STORE);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const ref = `${IMAGE_REF_PREFIX}${String(cursor.key)}`;
        if (!activeRefs.has(ref)) cursor.delete();
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  for (const ref of [...objectUrls.keys()]) {
    if (!activeRefs.has(ref)) {
      const url = objectUrls.get(ref);
      if (url) URL.revokeObjectURL(url);
      objectUrls.delete(ref);
    }
  }
}
