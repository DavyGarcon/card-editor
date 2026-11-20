import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// Konva's node build requires the native `canvas` package, which is not needed
// for these DOM-level integration checks.
vi.mock('konva', () => ({
  default: {
    Layer: class {},
    Stage: class {},
    Rect: class {},
    Text: class {},
    Image: class {},
    Group: class {},
    Transformer: class {},
  },
}));

vi.mock('react-konva', () => ({
  Stage: ({ children }: { children?: ReactNode }) =>
    createElement('div', { 'data-testid': 'stage' }, children),
  Layer: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  Group: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  Rect: () => null,
  Text: () => null,
  Image: () => null,
  Line: () => null,
  Transformer: () => null,
}));

const saveDeckFile = vi.fn();
const saveTemplateFile = vi.fn();

vi.mock('./io/deckIO', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./io/deckIO')>();
  return { ...actual, saveDeckFile: (...args: unknown[]) => saveDeckFile(...args) };
});
vi.mock('./io/templateIO', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./io/templateIO')>();
  return { ...actual, saveTemplateFile: (...args: unknown[]) => saveTemplateFile(...args) };
});

import App from './App';

describe('App integration', () => {
  beforeEach(() => {
    localStorage.clear();
    saveDeckFile.mockClear();
    saveTemplateFile.mockClear();
  });

  it('starts with the built-in templates and an empty deck', () => {
    render(<App />);
    const picker = screen.getByRole('combobox', { name: 'Template intégré' }) as HTMLSelectElement;
    expect(Array.from(picker.options).map((option) => option.textContent)).toEqual([
      'Pack Example',
    ]);
    // Alphabetically first template is the one loaded by default.
    expect(picker.value).toBe(picker.options[0].value);

    expect(screen.getByText('Deck (0)')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nom du Sort' })).toHaveValue('');
    expect(screen.getByRole('button', { name: /Ajouter une Carte/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Rendu des cartes/i })).toBeInTheDocument();
    expect(screen.queryByText(/Éditeur de Template/i)).not.toBeInTheDocument();
  });

  it('ignores stored sessions on refresh: no deck and only built-in templates', () => {
    localStorage.setItem(
      'modern-geckos-deck-v1',
      JSON.stringify({
        format: 'modern-geckos-deck',
        cards: [{ id: 'x', styleKey: 'spell_fire', values: {} }],
      }),
    );
    localStorage.setItem(
      'modern-geckos-template-v1',
      JSON.stringify({ format: 'modern-geckos-template', pack: { name: 'Ancien', styles: [] } }),
    );
    render(<App />);
    expect(screen.getByText('Deck (0)')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Ancien' })).not.toBeInTheDocument();
  });

  it('shows template-only controls after switching mode', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Template/i }));
    expect(screen.getByText(/Éditeur de Template/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ajouter une Carte/i })).not.toBeInTheDocument();
  });

  it('Ctrl+S saves the deck in card mode and the template in template mode', async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(saveDeckFile).toHaveBeenCalledTimes(1));
    expect(saveTemplateFile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Template/i }));
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(saveTemplateFile).toHaveBeenCalledTimes(1));
  });

  it('does not hijack Ctrl+Z while typing in a field', () => {
    render(<App />);
    const input = screen.getByRole('textbox', { name: 'Nom du Sort' }) as HTMLTextAreaElement;
    const before = input.value;
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true });
    expect(input.value).toBe(before);
  });
});
