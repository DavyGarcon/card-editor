import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { STRINGS } from '../i18n/strings';
import { ErrorBanner, PdfOptionsDialog, ScriptHelpPanel, ZoomToolbar } from './editorPanels';

describe('ErrorBanner', () => {
  it('shows the message and a single dismiss action', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner message="Fichier invalide" onDismiss={onDismiss} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Fichier invalide');
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('ZoomToolbar', () => {
  it('reports the zoom percentage and clamps at the limits', () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onZoomChange = vi.fn();
    const { rerender } = render(
      <ZoomToolbar
        zoom={1}
        minZoom={0.25}
        maxZoom={2}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onZoomChange={onZoomChange}
      />,
    );
    expect(screen.getByRole('spinbutton', { name: STRINGS.zoomLevel })).toHaveValue(100);
    expect(screen.queryByRole('button', { name: '100%' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: STRINGS.zoomIn }));
    expect(onZoomIn).toHaveBeenCalledTimes(1);

    rerender(
      <ZoomToolbar
        zoom={0.25}
        minZoom={0.25}
        maxZoom={2}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onZoomChange={onZoomChange}
      />,
    );
    expect(screen.getByRole('button', { name: STRINGS.zoomOut })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: STRINGS.zoomLevel })).toHaveValue(25);
  });

  it('sets the zoom from a typed percentage and clamps out-of-range values', () => {
    const onZoomChange = vi.fn();
    render(
      <ZoomToolbar
        zoom={1}
        minZoom={0.25}
        maxZoom={2}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onZoomChange={onZoomChange}
      />,
    );
    const input = screen.getByRole('spinbutton', { name: STRINGS.zoomLevel });

    fireEvent.change(input, { target: { value: '150' } });
    expect(onZoomChange).toHaveBeenLastCalledWith(1.5);

    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.blur(input);
    expect(onZoomChange).toHaveBeenLastCalledWith(2);

    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onZoomChange).toHaveBeenLastCalledWith(0.25);
  });
});

describe('ScriptHelpPanel', () => {
  it('toggles the inline interpreter documentation', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<ScriptHelpPanel open={false} onToggle={onToggle} />);
    expect(screen.queryByText(/Variables/)).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: STRINGS.scriptHelp });
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    rerender(<ScriptHelpPanel open onToggle={onToggle} />);
    expect(screen.getByText(/Variables/)).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('PdfOptionsDialog', () => {
  const options = {
    paperSize: 'a4' as const,
    cardWidthMm: 63.5,
    gapMm: 2,
    drawCropMarks: true,
  };

  it('reports changes and cancel/generate actions', () => {
    const onChange = vi.fn();
    const onCancel = vi.fn();
    const onGenerate = vi.fn();
    render(
      <PdfOptionsDialog
        options={options}
        onChange={onChange}
        onCancel={onCancel}
        onGenerate={onGenerate}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    fireEvent.change(screen.getByLabelText(STRINGS.paperSize), { target: { value: 'letter' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...options, paperSize: 'letter' });

    fireEvent.change(screen.getByLabelText(STRINGS.cardWidth), { target: { value: '70' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...options, cardWidthMm: 70 });

    fireEvent.click(screen.getByLabelText(STRINGS.cropMarks));
    expect(onChange).toHaveBeenLastCalledWith({ ...options, drawCropMarks: false });

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: STRINGS.generate }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});
