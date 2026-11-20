import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): ReactNode {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('renders its children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>contenu</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('contenu')).toBeInTheDocument();
  });

  it('shows a fallback and offers a reset when a child throws', () => {
    const onReset = vi.fn();
    const { rerender } = render(
      <ErrorBoundary fallbackTitle="Erreur" resetKey="a" onReset={onReset}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Erreur/)).toBeInTheDocument();

    const resetButton = screen.getByRole('button');
    resetButton.click();
    expect(onReset).toHaveBeenCalledTimes(1);

    rerender(
      <ErrorBoundary fallbackTitle="Erreur" resetKey="b" onReset={onReset}>
        <div>réparé</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('réparé')).toBeInTheDocument();
  });
});
