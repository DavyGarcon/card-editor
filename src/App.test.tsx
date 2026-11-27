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
const { renderCardToDataUrlMock, exportDeckToPdfMock } = vi.hoisted(() => ({
  renderCardToDataUrlMock: vi.fn(async () => 'data:image/png;base64,AAAA'),
  exportDeckToPdfMock: vi.fn(async () => undefined),
}));

vi.mock('./utils/cardRenderer', () => ({ renderCardToDataUrl: renderCardToDataUrlMock }));
vi.mock('./utils/pdfExporter', () => ({ exportDeckToPdf: exportDeckToPdfMock }));

vi.mock('./io/deckIO', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./io/deckIO')>();
  return { ...actual, saveDeckFile: (...args: unknown[]) => saveDeckFile(...args) };
});
vi.mock('./io/templateIO', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./io/templateIO')>();
  return { ...actual, saveTemplateFile: (...args: unknown[]) => saveTemplateFile(...args) };
});

import App from './App';
import { BUILT_IN_TEMPLATES } from './data';
import { WORKSPACE_FORMAT, WORKSPACE_STORAGE_KEY } from './io/workspaceStorage';

/** Load a built-in pack through the same selector + refresh flow as a user. */
function loadBuiltInTemplate(id: string) {
  const picker = screen.getByRole('combobox', { name: 'Template intégré' }) as HTMLSelectElement;
  fireEvent.change(picker, { target: { value: id } });
  fireEvent.click(screen.getByRole('button', { name: 'Recharger le template intégré' }));
}

describe('App integration', () => {
  beforeEach(() => {
    localStorage.clear();
    saveDeckFile.mockClear();
    saveTemplateFile.mockClear();
    renderCardToDataUrlMock.mockClear();
    exportDeckToPdfMock.mockClear();
  });

  it('starts with the built-in templates and an empty deck', () => {
    render(<App />);
    const picker = screen.getByRole('combobox', { name: 'Template intégré' }) as HTMLSelectElement;
    expect(Array.from(picker.options).map((option) => option.textContent)).toEqual([
      'JDR Pack',
      'Template Pack Example',
    ]);
    // Alphabetically first template is the one loaded by default.
    expect(picker.value).toBe(picker.options[0].value);

    // The checks below rely on the example pack's fields (e.g. `title`), so
    // load it explicitly instead of relying on the default pick.
    loadBuiltInTemplate('examplePack');

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
    expect(screen.getByRole('textbox', { name: 'Titre' })).toHaveValue('');
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
    expect(exportButtons).toHaveLength(2);
    for (const button of exportButtons) {
      expect(button.textContent).toBe('');
      expect(button.getAttribute('aria-label')).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: 'Options PDF' })).not.toBeInTheDocument();
    // Export / save / load / card buttons sit in a right-aligned actions container.
    for (const group of [deckGroup, exportGroup, cardGroup]) {
      expect(group.querySelector('.io-group-actions')).not.toBeNull();
    }

    // Card actions use the shared tool-button style and icon-only layout.
    for (const button of cardActionButtons) {
      const style = button.getAttribute('style') ?? '';
      expect(style).toContain('display: flex');
      expect(style).toContain('align-items: center');
      expect(style).toContain('border-radius: 6px');
    }
    expect(screen.queryByText(/Éditeur de Template/i)).not.toBeInTheDocument();
  });

  it('restores the autosaved workspace on refresh', () => {
    const template = BUILT_IN_TEMPLATES.find((item) => item.id === 'examplePack');
    expect(template).toBeDefined();
    const pack = structuredClone(template!.pack);
    localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({
        format: WORKSPACE_FORMAT,
        version: 1,
        pack,
        cards: [
          {
            id: 'restored-card',
            styleKey: pack.styles[0].key,
            values: { title: 'Carte restaurée' },
          },
        ],
        activeStyleKey: pack.styles[0].key,
        activeCardId: 'restored-card',
        selectedFieldId: 'title',
        mode: 'card',
      }),
    );
    render(<App />);
    expect(screen.getByText('Deck (1)')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Titre' })).toHaveValue('Carte restaurée');
  });

  it('autosaves pack/style and card changes to localStorage', async () => {
    render(<App />);
    loadBuiltInTemplate('examplePack');
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une Carte/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Titre' }), {
      target: { value: 'Autosave' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Template' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Largeur carte (px)' }), {
      target: { value: '500' },
    });

    await waitFor(() => expect(localStorage.getItem(WORKSPACE_STORAGE_KEY)).not.toBeNull());
    const stored = JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? '{}');
    expect(stored.format).toBe(WORKSPACE_FORMAT);
    expect(stored.cards).toHaveLength(1);
    expect(stored.cards[0].values.title).toBe('Autosave');
    expect(stored.mode).toBe('template');
    expect(stored.pack.styles.some((style: { width?: number }) => style.width === 500)).toBe(true);
  });

  it('loads a built-in pack with all its styles only via the refresh button next to the select', () => {
    render(<App />);
    loadBuiltInTemplate('examplePack');
    fireEvent.click(screen.getByRole('button', { name: 'Template' }));

    const picker = screen.getByRole('combobox', { name: 'Template intégré' }) as HTMLSelectElement;
    const refresh = screen.getByRole('button', { name: 'Recharger le template intégré' });
    expect(picker.compareDocumentPosition(refresh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const examplePackValue = picker.value;

    // Selecting a pack only changes the choice; the loaded pack is untouched.
    const width = screen.getByRole('spinbutton', { name: 'Largeur carte (px)' });
    fireEvent.change(width, { target: { value: '500' } });
    fireEvent.change(picker, { target: { value: picker.options[0].value } });
    expect(screen.getByRole('spinbutton', { name: 'Largeur carte (px)' })).toHaveValue(500);
    expect(screen.getByText('Style actif (3)')).toBeInTheDocument();

    // Editing the pack (new style) is also left alone until refresh is clicked.
    fireEvent.click(screen.getByRole('button', { name: /\+ Nouveau Style/ }));
    expect(screen.getByText('Style actif (4)')).toBeInTheDocument();

    // Select the example pack again so the refresh restores it (and its 375 px card).
    fireEvent.change(picker, { target: { value: examplePackValue } });
    fireEvent.click(refresh);
    expect(screen.getByRole('spinbutton', { name: 'Largeur carte (px)' })).toHaveValue(375);
    expect(screen.getByText('Style actif (3)')).toBeInTheDocument();
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

  it('opens the PDF options dialog from the PDF export button in card mode', () => {
    render(<App />);
    loadBuiltInTemplate('examplePack');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const exportGroup = screen.getByRole('group', { name: /Rendu des cartes/i });
    fireEvent.click(within(exportGroup).getByRole('button', { name: /Planche PDF/ }));

    const dialog = screen.getByRole('dialog', { name: 'Options PDF' });
    expect(within(dialog).getByRole('combobox', { name: 'Format de papier' })).toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: 'Orientation' })).toBeInTheDocument();
    expect(within(dialog).getByText(/34\.5 mm/)).toBeInTheDocument();
    const dpiInput = within(dialog).getByRole('spinbutton', { name: 'DPI du modèle' });
    expect(dpiInput).toHaveValue(276.4);
    fireEvent.change(dpiInput, { target: { value: '300' } });
    expect(within(dialog).getByText(/^31\.8 mm/)).toBeInTheDocument();
    expect(within(dialog).getByRole('spinbutton', { name: 'Marges (mm)' })).toHaveValue(10);
    expect(
      within(dialog).queryByRole('spinbutton', { name: 'Largeur carte (mm)' }),
    ).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('exports mixed-style cards with each card own template style and print width', async () => {
    render(<App />);
    const templatePicker = screen.getByRole('combobox', {
      name: 'Template intégré',
    }) as HTMLSelectElement;
    const jdrPack = Array.from(templatePicker.options).find((option) =>
      option.textContent?.includes('JDR Pack'),
    );
    expect(jdrPack).toBeDefined();
    fireEvent.change(templatePicker, { target: { value: jdrPack!.value } });
    fireEvent.click(screen.getByRole('button', { name: 'Recharger le template intégré' }));

    fireEvent.click(screen.getByRole('button', { name: /Ajouter une Carte/i }));

    const styleSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement;
    const smallStyle = styleSelect.options[0].value;
    const bigStyle = styleSelect.options[1].value;
    // Switching style in Card mode re-keys the active card, then adding a card
    // gives it the new style: the deck ends up with one card of each size.
    fireEvent.change(styleSelect, { target: { value: smallStyle } });
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une Carte/i }));
    fireEvent.change(styleSelect, { target: { value: bigStyle } });

    const exportGroup = screen.getByRole('group', { name: /Rendu des cartes/i });
    fireEvent.click(within(exportGroup).getByRole('button', { name: /Planche PDF/ }));
    const dialog = screen.getByRole('dialog', { name: 'Options PDF' });
    expect(within(dialog).getByText(/45\.9 – 102\.5 mm \(2 tailles\)/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Générer' }));

    await waitFor(() => expect(exportDeckToPdfMock).toHaveBeenCalledTimes(1));
    const renderCalls = renderCardToDataUrlMock.mock.calls as unknown as Array<
      [{ styleKey: string }, { key: string }]
    >;
    expect(renderCalls.map(([card, style]) => [card.styleKey, style.key])).toEqual([
      [smallStyle, smallStyle],
      [bigStyle, bigStyle],
    ]);
    const exportOptions = (
      exportDeckToPdfMock.mock.calls[0] as unknown as [string[], unknown, { cardWidthMm: number[] }]
    )[2];
    const widths = exportOptions.cardWidthMm;
    expect(widths).toHaveLength(2);
    expect(widths[0]).toBeCloseTo(45.9, 1);
    expect(widths[1]).toBeCloseTo(102.5, 1);
  });

  it('edits the card width and height in template mode', () => {
    render(<App />);
    loadBuiltInTemplate('examplePack');
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

  it('links image sources in template mode and edits them once in card mode', async () => {
    render(<App />);
    loadBuiltInTemplate('examplePack');
    fireEvent.click(screen.getByRole('button', { name: 'Template' }));
    fireEvent.click(screen.getByRole('button', { name: /\+ Image$/ }));

    const tree = screen.getByRole('listbox', { name: 'Arborescence des composants' });
    expect(
      within(tree)
        .getAllByRole('option')
        .filter((option) => option.textContent?.includes('Illustration')),
    ).toHaveLength(3);

    const link = screen.getByRole('combobox', { name: 'Image liée à' }) as HTMLSelectElement;
    const target = Array.from(link.options).find((option) =>
      option.textContent?.includes('(image)'),
    );
    expect(target).toBeDefined();
    fireEvent.change(link, { target: { value: target!.value } });
    // The example pack's active style already has two linked images; the new
    // layer joins that group, making it three members with a single source.
    expect(screen.getByText(/Source partagée — 3 images/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cartes' }));
    expect(screen.queryByRole('combobox', { name: 'Image liée à' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une Carte/i }));
    const sharedInput = document.getElementById('card-field-image') as HTMLInputElement;
    expect(sharedInput).toBeInTheDocument();
    expect(sharedInput.closest('div')?.parentElement).toHaveTextContent('Source partagée (3)');
    fireEvent.change(sharedInput, { target: { value: 'https://example.com/shared.png' } });

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(saveDeckFile).toHaveBeenCalledTimes(1));
    const deck = saveDeckFile.mock.calls[0][0] as {
      cards: Array<{ values: Record<string, string> }>;
    };
    expect(deck.cards[0].values).toMatchObject({
      title: 'Nouvelle Carte',
      image: 'https://example.com/shared.png',
    });
    expect(Object.keys(deck.cards[0].values)).toHaveLength(2);
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

  it('stacks the box contour color control below the fill control in template mode', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Template' }));
    fireEvent.click(screen.getByRole('button', { name: /Cadre/i }));

    const fill = screen.getByText('Remplissage');
    const contour = screen.getByText('Contour');
    expect(fill.compareDocumentPosition(contour) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const container = fill.parentElement?.parentElement as HTMLElement;
    expect(container.style.flexDirection).toBe('column');
  });

  it('rotates and mirrors a field in template mode', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Template' }));
    const tree = screen.getByRole('listbox', { name: 'Arborescence des composants' });
    fireEvent.click(within(tree).getAllByRole('option')[0]);

    const rotation = screen.getByRole('spinbutton', { name: 'Rotation (°)' });
    expect(rotation).toHaveValue(0);
    fireEvent.change(rotation, { target: { value: '45' } });
    expect(rotation).toHaveValue(45);

    const mirrorH = screen.getByRole('button', { name: 'Miroir horizontal' });
    const mirrorV = screen.getByRole('button', { name: 'Miroir vertical' });
    expect(mirrorH).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(mirrorH);
    expect(mirrorH).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(mirrorV);
    expect(mirrorV).toHaveAttribute('aria-pressed', 'true');
  });

  it('duplicates a component from the tree with its current settings', () => {
    render(<App />);
    loadBuiltInTemplate('examplePack');
    fireEvent.click(screen.getByRole('button', { name: 'Template' }));
    const tree = screen.getByRole('listbox', { name: 'Arborescence des composants' });
    const rowsBefore = within(tree).getAllByRole('option');
    const titleRow = rowsBefore.find((option) => option.textContent?.includes('Titre'))!;
    const originalIndex = rowsBefore.indexOf(titleRow);

    // Change an attribute first: the copy must keep this edited value.
    fireEvent.click(titleRow);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Rotation (°)' }), {
      target: { value: '33' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Couleur du texte' }), {
      target: { value: '#123456' },
    });
    fireEvent.click(within(titleRow).getByRole('button', { name: /Dupliquer/ }));

    const rows = within(tree).getAllByRole('option');
    const copyRow = rows.find((option) => option.textContent?.includes('Titre (Copie)'))!;
    expect(rows).toHaveLength(6);
    expect(copyRow).toBeDefined();
    expect(copyRow).toHaveAttribute('aria-selected', 'true');
    expect(rows.indexOf(copyRow)).toBe(originalIndex);
    expect(rows[originalIndex + 1].textContent).toContain('Titre');

    expect(screen.getByDisplayValue('Titre (Copie)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('title_copy')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Rotation (°)' })).toHaveValue(33);
    expect(screen.getByRole('textbox', { name: 'Couleur du texte' })).toHaveValue('#123456');

    // The duplication and its selection form a single undoable step.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(within(tree).getAllByRole('option')).toHaveLength(5);
  });

  it('edits the rectangle border width in template mode', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Template' }));
    fireEvent.click(screen.getByRole('button', { name: /Cadre/i }));

    const borderWidth = screen.getByRole('spinbutton', { name: 'Épaisseur contour' });
    expect(borderWidth).toHaveValue(2);
    fireEvent.change(borderWidth, { target: { value: '8' } });
    expect(borderWidth).toHaveValue(8);
  });

  it('edits the default value of a select field in template mode', () => {
    render(<App />);
    loadBuiltInTemplate('examplePack');
    fireEvent.click(screen.getByRole('button', { name: 'Template' }));

    // A newly added select is editable in card mode, but its default must
    // still be editable from the template inspector.
    fireEvent.click(screen.getByRole('button', { name: /\+ Liste$/ }));
    const defaultValue = screen.getByRole('combobox', { name: 'Valeur par défaut (Template)' });
    expect(defaultValue).toHaveValue('opt1');
    fireEvent.change(defaultValue, { target: { value: 'opt2' } });
    expect(defaultValue).toHaveValue('opt2');

    // The control is also available on inherited/pre-existing select fields.
    const tree = screen.getByRole('listbox', { name: 'Arborescence des composants' });
    const inheritedSelect = within(tree)
      .getAllByRole('option')
      .find(
        (option) =>
          option.textContent?.includes('Liste Déroulante') &&
          option.textContent?.includes('hérité'),
      )!;
    fireEvent.click(inheritedSelect);
    expect(screen.getByRole('combobox', { name: 'Valeur par défaut (Template)' })).toHaveValue('1');
  });

  it('adds a checkbox component, saves it and toggles its value in card mode', async () => {
    render(<App />);
    loadBuiltInTemplate('examplePack');
    fireEvent.click(screen.getByRole('button', { name: 'Template' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Case à cocher' }));

    const tree = screen.getByRole('listbox', { name: 'Arborescence des composants' });
    expect(
      within(tree)
        .getAllByRole('option')
        .filter((option) => option.textContent?.includes('Case à cocher')),
    ).toHaveLength(1);

    const templateToggle = screen.getByRole('checkbox', {
      name: 'État coché par défaut (Template)',
    });
    expect(templateToggle).not.toBeChecked();
    fireEvent.click(templateToggle);
    expect(templateToggle).toBeChecked();

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(saveTemplateFile).toHaveBeenCalledTimes(1));
    const saved = saveTemplateFile.mock.calls[0][0] as {
      pack: { styles: Array<{ fields: Array<{ type: string; defaultValue?: string }> }> };
    };
    expect(
      saved.pack.styles.some((style) => style.fields.some((field) => field.type === 'checkbox')),
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Cartes' }));
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une Carte/i }));
    const cardToggle = screen.getByRole('checkbox', { name: 'Case à cocher' });
    // New cards inherit the template default.
    expect(cardToggle).toBeChecked();
    fireEvent.click(cardToggle);
    expect(cardToggle).not.toBeChecked();
  });

  it('opens the preview at a zoom that shows the whole default card', () => {
    const widthSpy = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(800);
    const heightSpy = vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(600);
    try {
      render(<App />);
      const stage = screen.getByTestId('stage');
      // The default JDR Pack style is 3230x2280, so it must be scaled down to
      // fit the scroll area's 768x568 content box (16px padding on each side).
      expect(Number(stage.getAttribute('data-stage-width'))).toBeLessThanOrEqual(768.01);
      expect(Number(stage.getAttribute('data-stage-height'))).toBeLessThanOrEqual(568.01);
      expect(screen.getByRole('spinbutton', { name: 'Zoom (%)' })).toHaveValue(24);
    } finally {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
    }
  });

  it('keeps a manually chosen zoom instead of re-fitting on resize', () => {
    const widthSpy = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(800);
    const heightSpy = vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(600);
    try {
      render(<App />);
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Zoom (%)' }), {
        target: { value: '50' },
      });
      expect(screen.getByTestId('stage')).toHaveAttribute('data-stage-scale-x', '0.5');

      // No ResizeObserver in jsdom, but a re-render must not restore the fit.
      fireEvent.click(screen.getByRole('button', { name: 'Template' }));
      expect(screen.getByTestId('stage')).toHaveAttribute('data-stage-scale-x', '0.5');
    } finally {
      widthSpy.mockRestore();
      heightSpy.mockRestore();
    }
  });

  it('scales the whole card instead of clipping it when zoomed out', () => {
    render(<App />);
    loadBuiltInTemplate('examplePack');
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

  it('saves a new inheriting style with no local copy of the parent fields', async () => {
    render(<App />);
    loadBuiltInTemplate('examplePack');
    fireEvent.click(screen.getByRole('button', { name: 'Template' }));
    fireEvent.click(screen.getByRole('button', { name: /\+ Nouveau Style/ }));

    const basedOn = screen
      .getAllByRole('combobox')
      .find((element) =>
        Array.from((element as HTMLSelectElement).options).some((option) =>
          option.textContent?.includes('(style_1795270798053)'),
        ),
      ) as HTMLSelectElement;
    expect(basedOn).toBeDefined();
    fireEvent.change(basedOn, { target: { value: 'style_1795270798053' } });

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(saveTemplateFile).toHaveBeenCalledTimes(1));
    const saved = saveTemplateFile.mock.calls[0][0] as {
      pack: { styles: Array<{ key: string; fields: Array<{ id: string }> }> };
    };
    const newStyle = saved.pack.styles[saved.pack.styles.length - 1];
    expect(newStyle.fields).toEqual([]);
  });

  it('saves only edited and added fields in a basedOn style', async () => {
    render(<App />);
    loadBuiltInTemplate('examplePack');
    fireEvent.click(screen.getByRole('button', { name: 'Template' }));
    fireEvent.click(screen.getByRole('button', { name: /\+ Variante \(basedOn\)/ }));

    const tree = screen.getByRole('listbox', { name: 'Arborescence des composants' });
    const effectRow = within(tree)
      .getAllByRole('option')
      .find((option) => option.textContent?.includes('Texte Riche'))!;
    fireEvent.click(effectRow);
    const widthInput = screen.getByText('Largeur').nextElementSibling as HTMLInputElement;
    fireEvent.change(widthInput, { target: { value: '175' } });
    fireEvent.click(within(effectRow).getByRole('button', { name: /Dupliquer/ }));

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(saveTemplateFile).toHaveBeenCalledTimes(1));
    const saved = saveTemplateFile.mock.calls[0][0] as {
      pack: { styles: Array<{ key: string; fields: Array<{ id: string }> }> };
    };
    const newStyle = saved.pack.styles[saved.pack.styles.length - 1];
    expect(newStyle.fields.map((field) => field.id).sort()).toEqual(['effect', 'effect_copy']);
  });

  it('hides a component from the Card preview while keeping its value editable', () => {
    render(<App />);
    loadBuiltInTemplate('examplePack');
    expect(screen.getByRole('textbox', { name: 'Titre' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Template' }));
    const hiddenToggle = screen.getByRole('checkbox', {
      name: 'Masqué (Template uniquement)',
    });
    expect(hiddenToggle).not.toBeChecked();
    fireEvent.click(hiddenToggle);
    expect(hiddenToggle).toBeChecked();

    // The layer stays visible and selectable in Template mode, with a badge.
    const tree = screen.getByRole('listbox', { name: 'Arborescence des composants' });
    const titleRow = within(tree)
      .getAllByRole('option')
      .find((option) => option.textContent?.includes('Titre'))!;
    expect(titleRow).toHaveTextContent('masqué');

    // Hidden layers are absent from the preview but their values stay editable.
    fireEvent.click(screen.getByRole('button', { name: 'Cartes' }));
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une Carte/i }));
    const cardInput = screen.getByRole('textbox', { name: 'Titre' }) as HTMLTextAreaElement;
    fireEvent.change(cardInput, { target: { value: 'Carte secrète' } });
    expect(cardInput).toHaveValue('Carte secrète');

    // They remain editable when back in Template mode.
    fireEvent.click(screen.getByRole('button', { name: 'Template' }));
    expect(screen.getByRole('checkbox', { name: 'Masqué (Template uniquement)' })).toBeChecked();
  });

  it('does not hijack Ctrl+Z while typing in a field', () => {
    render(<App />);
    loadBuiltInTemplate('examplePack');
    const input = screen.getByRole('textbox', { name: 'Titre' }) as HTMLTextAreaElement;
    const before = input.value;
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true });
    expect(input.value).toBe(before);
  });
});
