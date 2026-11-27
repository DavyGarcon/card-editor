import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { STRINGS } from '../i18n/strings';
import { TEMPLATE_DPI } from '../utils/printSize';
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
    const onFit = vi.fn();
    const { rerender } = render(
      <ZoomToolbar
        zoom={1}
        minZoom={0.25}
        maxZoom={2}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onZoomChange={onZoomChange}
        onFit={onFit}
      />,
    );
    expect(screen.getByRole('spinbutton', { name: STRINGS.zoomLevel })).toHaveValue(100);
    expect(screen.queryByRole('button', { name: '100%' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: STRINGS.zoomIn }));
    expect(onZoomIn).toHaveBeenCalledTimes(1);

    const fitButton = screen.getByRole('button', { name: STRINGS.zoomFit });
    expect(fitButton.previousElementSibling).toBe(
      screen.getByRole('button', { name: STRINGS.zoomIn }),
    );
    fireEvent.click(fitButton);
    expect(onFit).toHaveBeenCalledTimes(1);

    rerender(
      <ZoomToolbar
        zoom={0.25}
        minZoom={0.25}
        maxZoom={2}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onZoomChange={onZoomChange}
        onFit={onFit}
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
        onFit={vi.fn()}
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
    orientation: 'portrait' as const,
    dpi: TEMPLATE_DPI,
    gapMm: 2,
    marginMm: 10,
    drawCropMarks: true,
  };

  it('reports changes and cancel/generate actions', () => {
    const onChange = vi.fn();
    const onCancel = vi.fn();
    const onGenerate = vi.fn();
    render(
      <PdfOptionsDialog
        options={options}
        cardWidthMm={63.5}
        onChange={onChange}
        onCancel={onCancel}
        onGenerate={onGenerate}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const paperSelect = screen.getByLabelText(STRINGS.paperSize);
    const formats = Array.from((paperSelect as HTMLSelectElement).options).map((option) => ({
      value: option.value,
      label: option.textContent,
    }));
    expect(formats.map((format) => format.value)).toEqual([
      'a0',
      'a1',
      'a2',
      'a3',
      'a4',
      'a5',
      'a6',
      'a7',
      'a8',
      'a9',
      'a10',
      'letter',
      'legal',
      'tabloid',
    ]);
    expect(formats.find((format) => format.value === 'a3')?.label).toContain('A3');
    expect(formats.find((format) => format.value === 'a5')?.label).toContain('A5');

    fireEvent.change(paperSelect, { target: { value: 'a3' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...options, paperSize: 'a3' });

    const orientationSelect = screen.getByLabelText(STRINGS.orientation) as HTMLSelectElement;
    expect(Array.from(orientationSelect.options).map((option) => option.value)).toEqual([
      'portrait',
      'landscape',
    ]);
    fireEvent.change(orientationSelect, { target: { value: 'landscape' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...options, orientation: 'landscape' });

    // Card width is displayed but cannot be edited in the dialog.
    expect(screen.getByText(/63\.5 mm/)).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: STRINGS.cardWidth })).not.toBeInTheDocument();

    const dpiInput = screen.getByLabelText(STRINGS.dpi);
    expect(dpiInput).toHaveValue(276.4);
    fireEvent.change(dpiInput, { target: { value: '300' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...options, dpi: 300 });

    fireEvent.change(screen.getByLabelText(STRINGS.margin), { target: { value: '25' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...options, marginMm: 25 });

    fireEvent.click(screen.getByLabelText(STRINGS.cropMarks));
    expect(onChange).toHaveBeenLastCalledWith({ ...options, drawCropMarks: false });

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: STRINGS.generate }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});
