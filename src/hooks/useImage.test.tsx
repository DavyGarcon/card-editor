import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const image = {} as HTMLImageElement;
const loadImageMock = vi.hoisted(() => vi.fn());
const resolveImageRefMock = vi.hoisted(() => vi.fn());

vi.mock('../io/imageStore', () => ({
  resolveImageRef: resolveImageRefMock,
}));

vi.mock('../utils/imageLoader', () => ({
  loadImage: loadImageMock,
}));

import { useImage } from './useImage';

describe('useImage', () => {
  beforeEach(() => {
    loadImageMock.mockReset().mockResolvedValue(image);
    resolveImageRefMock.mockReset().mockImplementation(async (ref: string) => `resolved:${ref}`);
  });

  it('loads preview images without CORS mode so external URLs can render', async () => {
    const { result } = renderHook(() => useImage('https://example.com/art.png'));

    await waitFor(() => expect(result.current).toBe(image));
    expect(resolveImageRefMock).toHaveBeenCalledWith('https://example.com/art.png');
    expect(loadImageMock).toHaveBeenCalledWith('resolved:https://example.com/art.png', 8000, null);
  });
});
