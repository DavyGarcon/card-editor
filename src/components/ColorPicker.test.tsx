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

  it('allows transparent values when enabled', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#ffffff" onChange={onChange} allowTransparent />);
    fireEvent.change(screen.getByLabelText('Couleur hexadécimale'), {
      target: { value: 'transparent' },
    });
    expect(onChange).toHaveBeenLastCalledWith('transparent');
  });
});
