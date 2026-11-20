import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColorPicker } from './ColorPicker';

describe('ColorPicker', () => {
  it('labels the native and hex inputs', () => {
    render(<ColorPicker label="Fond" value="#ffffff" onChange={vi.fn()} />);
    expect(screen.getByText('Fond')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Fond').length).toBeGreaterThanOrEqual(2);
  });

  it('normalizes a 3-digit hex value to 6 digits', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#ffffff" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Couleur hexadécimale'), {
      target: { value: '#abc' },
    });
    expect(onChange).toHaveBeenLastCalledWith('#aabbcc');
  });

  it('exposes the palette with accessible buttons', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#ffffff" onChange={onChange} presets={['#123456']} />);
    const toggle = screen.getByRole('button', { name: /palette de couleurs/i });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByTitle('#123456'));
    expect(onChange).toHaveBeenLastCalledWith('#123456');
  });

  it('allows transparent values by default', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#ffffff" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Couleur hexadécimale'), {
      target: { value: 'transparent' },
    });
    expect(onChange).toHaveBeenLastCalledWith('transparent');
  });

  it('offers a transparent swatch in the palette by default', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#ffffff" onChange={onChange} presets={['#123456']} />);
    fireEvent.click(screen.getByRole('button', { name: /palette de couleurs/i }));
    fireEvent.click(screen.getByTitle('Transparent'));
    expect(onChange).toHaveBeenLastCalledWith('transparent');
  });

  it('accepts 8-digit hex colors for partial transparency', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#ffffff" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Couleur hexadécimale'), {
      target: { value: '#ff000080' },
    });
    expect(onChange).toHaveBeenLastCalledWith('#ff000080');
  });
});
