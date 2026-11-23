import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadImage = vi.fn();

vi.mock('../utils/imageLoader', () => ({ loadImage: (...args: unknown[]) => loadImage(...args) }));

import { ImageCropper } from './ImageCropper';

describe('ImageCropper', () => {
  let drawImage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    loadImage.mockReset();
    drawImage = vi.fn();
    const context = {
      clearRect: vi.fn(),
      drawImage,
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
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,AAAA',
    );
    Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
  });

  const stubCanvasRect = (canvas: HTMLElement) => {
    canvas.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 360,
        height: 360,
        right: 360,
        bottom: 360,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
  };

  const renderLoadedCropper = async (onCropComplete = vi.fn()) => {
    loadImage.mockResolvedValue({ naturalWidth: 600, naturalHeight: 400 });
    render(<ImageCropper imageSrc="ok" onCropComplete={onCropComplete} onCancel={vi.fn()} />);
    // The canvas is present while loading; wait until the loaded image enables Apply.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Appliquer le recadrage/i })).toBeEnabled(),
    );
    return screen.getByRole('img');
  };

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
    await renderLoadedCropper();
    const resolution = screen.getByLabelText(/Résolution/i);
    fireEvent.change(resolution, { target: { value: '900' } });
    expect(resolution).toHaveValue(900);
  });

  it('zooms in and out with the mouse wheel over the preview', async () => {
    const canvas = await renderLoadedCropper();

    fireEvent.wheel(canvas, { deltaY: -100 });
    expect(screen.getByRole('slider')).toHaveValue('1.1');

    fireEvent.wheel(canvas, { deltaY: 100 });
    expect(screen.getByRole('slider')).toHaveValue('1');

    fireEvent.wheel(canvas, { deltaY: 100 });
    expect(screen.getByRole('slider')).toHaveValue('0.91');
  });

  it('can zoom out below 100% with the slider and the zoom buttons', async () => {
    await renderLoadedCropper();
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '0.25');

    fireEvent.click(screen.getByRole('button', { name: 'Dézoomer' }));
    expect(slider).toHaveValue('0.83');

    fireEvent.click(screen.getByRole('button', { name: 'Zoomer' }));
    expect(slider).toHaveValue('1');

    fireEvent.change(slider, { target: { value: '0.5' } });
    expect(slider).toHaveValue('0.5');
  });

  it('pans the image even when zoomed below 100%', async () => {
    const canvas = await renderLoadedCropper();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.5' } });
    const before = Number(drawImage.mock.calls[drawImage.mock.calls.length - 1]?.[1]);

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 180, clientY: 180 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 200, clientY: 195 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });

    const after = Number(drawImage.mock.calls[drawImage.mock.calls.length - 1]?.[1]);
    expect(after - before).toBeCloseTo(20, 0);
  });

  it('anchors wheel zoom at the pointer instead of the frame center', async () => {
    const canvas = await renderLoadedCropper();
    stubCanvasRect(canvas);

    fireEvent.wheel(canvas, { deltaY: -100, clientX: 270, clientY: 180 });

    // 600x400 image in a 360x360 frame: cover scale at 1.1x is 594 px wide,
    // centered at -117; anchoring at x=270 shifts the image 9 px left.
    expect(Number(drawImage.mock.calls[drawImage.mock.calls.length - 1]?.[1])).toBeCloseTo(-126, 0);
  });

  it('uses the last hovered point when zooming out with the slider', async () => {
    const canvas = await renderLoadedCropper();
    stubCanvasRect(canvas);
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 270, clientY: 180 });

    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.5' } });

    // At 0.5x the 270 px-wide image is centered at x=45; the right-side anchor
    // pushes it to x=90, where its right edge touches the frame.
    expect(Number(drawImage.mock.calls[drawImage.mock.calls.length - 1]?.[1])).toBeCloseTo(90, 0);
  });

  it('uses the zoomed-out view when exporting the crop', async () => {
    const onCropComplete = vi.fn();
    await renderLoadedCropper(onCropComplete);

    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.5' } });
    fireEvent.click(screen.getByRole('button', { name: /Appliquer le recadrage/i }));

    // 600 px wide image in a 360 px frame at 0.5x, exported at 600 px.
    const calls = drawImage.mock.calls;
    expect(calls[calls.length - 1][3]).toBeCloseTo(450, 0);
    expect(onCropComplete).toHaveBeenCalledWith('data:image/png;base64,AAAA');
  });
});
