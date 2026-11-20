import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blobToDataUrl, compressImageBlob, dataUrlToBlob, loadImage } from './imageLoader';

/** Minimal Image stand-in: `bad` fails, `never` hangs, everything else loads. */
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin: string | null = null;
  naturalWidth = 100;
  naturalHeight = 100;
  private source = '';

  get src(): string {
    return this.source;
  }

  set src(value: string) {
    this.source = value;
    if (value === 'never') return;
    queueMicrotask(() => {
      if (value === 'bad') this.onerror?.();
      else this.onload?.();
    });
  }
}

describe('imageLoader', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', FakeImage as unknown as typeof Image);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('loadImage', () => {
    it('resolves null for an empty source without creating an image', async () => {
      expect(await loadImage('')).toBeNull();
    });

    it('loads an image and sets CORS by default', async () => {
      const image = await loadImage('good');
      expect(image).not.toBeNull();
      expect(image?.crossOrigin).toBe('anonymous');
    });

    it('can load without CORS mode for the live preview', async () => {
      const image = await loadImage('good', 8000, null);
      expect(image).not.toBeNull();
      expect(image?.crossOrigin).toBeNull();
    });

    it('resolves null on image error', async () => {
      expect(await loadImage('bad')).toBeNull();
    });

    it('resolves null after the timeout', async () => {
      vi.useFakeTimers();
      const pending = loadImage('never', 100);
      await vi.advanceTimersByTimeAsync(100);
      expect(await pending).toBeNull();
    });
  });

  it('round-trips a base64 Data URL through a Blob', async () => {
    const dataUrl = 'data:text/plain;base64,aGVsbG8=';
    const blob = dataUrlToBlob(dataUrl);
    expect(blob.type).toBe('text/plain');
    expect(await blobToDataUrl(blob)).toBe(dataUrl);
  });

  it('decodes a non-base64 Data URL and rejects invalid ones', () => {
    const blob = dataUrlToBlob('data:text/plain,hello%20world');
    expect(blob.type).toBe('text/plain');
    expect(() => dataUrlToBlob('not-a-data-url')).toThrow(/Data URL invalide/);
  });

  it('leaves small, loadable images untouched', async () => {
    const blob = new Blob(['small'], { type: 'image/png' });
    expect(await compressImageBlob(blob)).toBe(blob);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('leaves an image untouched when it cannot be decoded', async () => {
    vi.stubGlobal(
      'Image',
      class {
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.());
        }
      } as unknown as typeof Image,
    );
    const blob = new Blob(['broken'], { type: 'image/png' });
    expect(await compressImageBlob(blob)).toBe(blob);
  });
});
