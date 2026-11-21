import { beforeEach, describe, expect, it, vi } from 'vitest';

const { isImageRef, readImageDataUrl } = vi.hoisted(() => ({
  isImageRef: vi.fn((value: unknown) => typeof value === 'string' && value.startsWith('idb:')),
  readImageDataUrl: vi.fn(),
}));

vi.mock('./imageStore', () => ({ isImageRef, readImageDataUrl }));

import { embedImageRefs } from './imageEmbedding';

describe('embedImageRefs', () => {
  beforeEach(() => {
    isImageRef.mockClear();
    readImageDataUrl.mockReset();
    readImageDataUrl.mockImplementation(async (ref: string) => `data:image/webp;base64,${ref}`);
  });

  it('replaces local refs with inline Data URLs and keeps other strings', async () => {
    const result = await embedImageRefs({
      title: 'Carte',
      src: 'idb:one',
      url: 'https://example.test/a.png',
      inline: 'data:image/png;base64,AAAA',
      nested: [{ src: 'idb:two' }],
    });

    expect(result).toEqual({
      title: 'Carte',
      src: 'data:image/webp;base64,idb:one',
      url: 'https://example.test/a.png',
      inline: 'data:image/png;base64,AAAA',
      nested: [{ src: 'data:image/webp;base64,idb:two' }],
    });
  });

  it('reads a shared ref only once per export', async () => {
    await embedImageRefs({ a: 'idb:shared', b: 'idb:shared' });
    expect(readImageDataUrl).toHaveBeenCalledTimes(1);
  });

  it('keeps the original ref when its Blob is unavailable', async () => {
    readImageDataUrl.mockResolvedValueOnce('idb:missing');
    const result = await embedImageRefs({ src: 'idb:missing' });
    expect(result.src).toBe('idb:missing');
  });
});
