/** Shared IndexedDB connection for artwork blobs. */

const DB_NAME = 'modern-geckos';
const DB_VERSION = 3;

export const IMAGE_STORE = 'images';
const LEGACY_PROJECT_STORE = 'projects';

let dbPromise: Promise<IDBDatabase | null> | null = null;

export function openDb(): Promise<IDBDatabase | null> {
  if (!('indexedDB' in globalThis)) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IMAGE_STORE)) db.createObjectStore(IMAGE_STORE);
        if (db.objectStoreNames.contains(LEGACY_PROJECT_STORE)) {
          db.deleteObjectStore(LEGACY_PROJECT_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}
