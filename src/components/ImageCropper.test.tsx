import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadImage = vi.fn();

vi.mock('../utils/imageLoader', () => ({ loadImage: (...args: unknown[]) => loadImage(...args) }));

import { ImageCropper } from './ImageCropper';

describe('ImageCropper', () => {
  beforeEach(() => {
    loadImage.mockReset();
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      lineWidth: 1,
      strokeStyle: '',
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
  });

  it('shows a clear error when the image cannot be loaded', async () => {
    loadImage.mockResolvedValue(null);
    render(<ImageCropper imageSrc="bad" onCropComplete={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/Impossible de charger l'image/)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /Appliquer le recadrage/i })).toBeDisabled();
  });

  it('cancels on Escape and returns focus via the cancel button', async () => {
    const onCancel = vi.fn();
    loadImage.mockResolvedValue({
      naturalWidth: 600,
      naturalHeight: 400,
    });
    render(<ImageCropper imageSrc="ok" onCropComplete={vi.fn()} onCancel={onCancel} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('exposes an export resolution control to the user', async () => {
    loadImage.mockResolvedValue({ naturalWidth: 600, naturalHeight: 400 });
    render(<ImageCropper imageSrc="ok" onCropComplete={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());
    const resolution = screen.getByLabelText(/Résolution/i);
    fireEvent.change(resolution, { target: { value: '900' } });
    expect(resolution).toHaveValue(900);
  });
});
