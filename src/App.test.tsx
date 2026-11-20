import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

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
  Stage: ({
    children,
    width,
    height,
    scaleX,
    scaleY,
  }: {
    children?: ReactNode;
    width?: number;
    height?: number;
    scaleX?: number;
    scaleY?: number;
  }) =>
    createElement(
      'div',
      {
        'data-testid': 'stage',
        'data-stage-width': width,
        'data-stage-height': height,
        'data-stage-scale-x': scaleX,
        'data-stage-scale-y': scaleY,
      },
      children,
    ),
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

    expect(screen.queryByRole('group', { name: 'Sauvegarde du template' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Sauvegarde du deck' })).toBeInTheDocument();
    const saveLoadGroups = screen
      .getAllByRole('group')
      .filter((group) => group.getAttribute('aria-label')?.startsWith('Sauvegarde'));
    expect(saveLoadGroups).toHaveLength(1);

    const deckGroup = screen.getByRole('group', { name: 'Sauvegarde du deck' });
    expect(within(deckGroup).getByRole('button', { name: 'Sauvegarder le deck' }).textContent).toBe(
      '',
    );
    expect(within(deckGroup).getByLabelText('Charger un deck').textContent).toBe('');

    expect(screen.getByText('Deck (0)')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nom du Sort' })).toHaveValue('');
    const addCardButton = screen.getByRole('button', { name: /Ajouter une Carte/i });
    const cardGroup = screen.getByRole('group', { name: 'Card' });
    expect(within(cardGroup).getByText('Card')).toBeInTheDocument();
    expect(within(cardGroup).getAllByRole('button')).toHaveLength(2);
    expect(
      within(cardGroup).getByRole('button', { name: /Ajouter une Carte/i }),
    ).toBeInTheDocument();
    const duplicateCardButton = within(cardGroup).getByRole('button', { name: /Dupliquer/i });
    expect(duplicateCardButton).toBeInTheDocument();
    const cardActionButtons = within(cardGroup).getAllByRole('button');
    for (const button of cardActionButtons) {
      expect(button.textContent).toBe('');
      expect(button.getAttribute('aria-label')).toBeTruthy();
      expect(button.querySelector('svg')).toHaveAttribute('width', '16');
      expect(button.querySelector('svg')).toHaveAttribute('height', '16');
    }
    expect(addCardButton).toBe(
      within(cardGroup).getByRole('button', { name: /Ajouter une Carte/i }),
    );
    const exportGroup = screen.getByRole('group', { name: /Rendu des cartes/i });
    expect(
      exportGroup.compareDocumentPosition(addCardButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      deckGroup.compareDocumentPosition(addCardButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const exportButtons = within(exportGroup).getAllByRole('button');
    expect(exportButtons).toHaveLength(3);
    for (const button of exportButtons) {
      expect(button.textContent).toBe('');
      expect(button.getAttribute('aria-label')).toBeTruthy();
    }
    // Export / save / load / card buttons sit in a right-aligned actions container.
    for (const group of [deckGroup, exportGroup, cardGroup]) {
      expect(group.querySelector('.io-group-actions')).not.toBeNull();
    }

    // Card actions use the same base style/size as the export buttons.
    const pdfOptionsButton = within(exportGroup).getByRole('button', { name: 'Options PDF' });
    for (const button of cardActionButtons) {
      expect(button.getAttribute('style')).toBe(pdfOptionsButton.getAttribute('style'));
    }
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
    fireEvent.click(screen.getByRole('button', { name: 'Template' }));
    expect(screen.getByText(/Éditeur de Template/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ajouter une Carte/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Rendu des cartes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Sauvegarde du deck' })).not.toBeInTheDocument();

    const templateGroup = screen.getByRole('group', { name: 'Sauvegarde du template' });
    expect(
      within(templateGroup).getByRole('button', { name: 'Sauvegarder le template' }).textContent,
    ).toBe('');
    expect(within(templateGroup).getByLabelText('Charger un template').textContent).toBe('');
    expect(templateGroup.querySelector('.io-group-actions')).not.toBeNull();
  });

  it('edits the card width and height in template mode', () => {
    render(<App />);
    expect(
      screen.queryByRole('spinbutton', { name: 'Largeur carte (px)' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Template' }));
    const width = screen.getByRole('spinbutton', { name: 'Largeur carte (px)' });
    const height = screen.getByRole('spinbutton', { name: 'Hauteur carte (px)' });
    expect(width).toHaveValue(375);
    expect(height).toHaveValue(525);

    fireEvent.change(width, { target: { value: '500' } });
    fireEvent.change(height, { target: { value: '700' } });
    expect(width).toHaveValue(500);
    expect(height).toHaveValue(700);
  });

  it('stacks the border color control below the background color control in template mode', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Template' }));

    const background = screen.getByText('Fond');
    const border = screen.getByText('Bordure');
    expect(
      background.compareDocumentPosition(border) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const container = background.parentElement?.parentElement as HTMLElement;
    expect(container.style.flexDirection).toBe('column');
  });

  it('scales the whole card instead of clipping it when zoomed out', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Zoom (%)' }), {
      target: { value: '50' },
    });

    const stage = screen.getByTestId('stage');
    expect(stage).toHaveAttribute('data-stage-width', '187.5');
    expect(stage).toHaveAttribute('data-stage-height', '262.5');
    expect(stage).toHaveAttribute('data-stage-scale-x', '0.5');
    expect(stage).toHaveAttribute('data-stage-scale-y', '0.5');

    const wrapper = stage.parentElement as HTMLElement;
    expect(wrapper.style.transform).toBe('');
    expect(wrapper.style.width).toBe('187.5px');
    expect(wrapper.style.height).toBe('262.5px');
  });

  it('keeps the zoom toolbar pinned above the scrollable preview in template mode', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Template' }));

    const zoomGroup = screen.getByRole('group', { name: "Zoom de l'aperçu" });
    const pinnedToolbar = document.querySelector('.stage-toolbar');
    const scrollArea = document.querySelector('.stage-scroll');
    const stage = screen.getByTestId('stage');

    expect(pinnedToolbar).not.toBeNull();
    expect(scrollArea).not.toBeNull();
    expect(pinnedToolbar).toContainElement(zoomGroup);
    expect(scrollArea).toContainElement(stage);
    expect(pinnedToolbar).not.toContainElement(stage);
  });

  it('Ctrl+S saves the deck in card mode and the template in template mode', async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(saveDeckFile).toHaveBeenCalledTimes(1));
    expect(saveTemplateFile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Template' }));
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
