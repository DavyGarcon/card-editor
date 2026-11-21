import { isImageRef, readImageDataUrl } from './imageStore';

/**
 * Returns a JSON-safe copy of a document with every local `idb:` image ref
 * replaced by its inline Data URL, so exported files stay portable.
 * Already inline Data URLs and normal URLs are left untouched. A per-call
 * cache avoids reading the same Blob once per card for linked/shared images.
 */
export async function embedImageRefs<T>(value: T): Promise<T> {
  const cache = new Map<string, Promise<string>>();

  const walk = async (input: unknown): Promise<unknown> => {
    if (typeof input === 'string') {
      if (!isImageRef(input)) return input;
      if (!cache.has(input)) cache.set(input, readImageDataUrl(input));
      return cache.get(input);
    }
    if (Array.isArray(input)) return Promise.all(input.map(walk));
    if (input !== null && typeof input === 'object') {
      const entries = await Promise.all(
        Object.entries(input).map(async ([key, item]) => [key, await walk(item)] as const),
      );
      return Object.fromEntries(entries);
    }
    return input;
  };

  return walk(value) as Promise<T>;
}
