import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUndoableDocument, type DocumentSnapshot } from './useUndoableDocument';
import { CardData, CardTemplatePack } from '../types/template';

const pack: CardTemplatePack = {
  name: 'Pack',
  activeStyleKey: 'base',
  styles: [{ key: 'base', name: 'Base', width: 100, height: 100, fields: [] }],
};
const cards: CardData[] = [{ id: '1', styleKey: 'base', values: { title: 'A' } }];

function doc(overrides: Partial<DocumentSnapshot> = {}): DocumentSnapshot {
  return {
    pack,
    cards,
    activeStyleKey: 'base',
    activeCardId: '1',
    selectedFieldId: 'title',
    mode: 'card',
    ...overrides,
  };
}

describe('useUndoableDocument', () => {
  it('tracks pack and deck changes in one timeline', () => {
    const { result } = renderHook(() => useUndoableDocument({ pack, cards }));

    expect(result.current.canUndo).toBe(false);
    act(() => result.current.setCards([{ id: '1', styleKey: 'base', values: { title: 'B' } }]));
    expect(result.current.cards[0].values.title).toBe('B');
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.cards[0].values.title).toBe('A');
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.cards[0].values.title).toBe('B');
  });

  it('records a setDocument replacement as a single history step', () => {
    const { result } = renderHook(() => useUndoableDocument({ pack, cards }));
    const next = doc({
      pack: { ...pack, name: 'Autre pack' },
      cards: [{ id: '2', styleKey: 'base', values: {} }],
      activeCardId: '2',
    });

    act(() => result.current.setDocument(next));
    expect(result.current.pack.name).toBe('Autre pack');
    expect(result.current.cards[0].id).toBe('2');
    expect(result.current.activeCardId).toBe('2');

    act(() => result.current.undo());
    expect(result.current.pack).toBe(pack);
    expect(result.current.cards).toBe(cards);
    expect(result.current.activeCardId).toBe('1');
  });

  it('includes UI selection and mode in undo/redo', () => {
    const { result } = renderHook(() =>
      useUndoableDocument({
        ...doc(),
        activeStyleKey: 'base',
        selectedFieldId: 'title',
        mode: 'card',
      }),
    );

    act(() =>
      result.current.setDocument(
        doc({ activeStyleKey: 'variant', selectedFieldId: 'body', mode: 'template' }),
      ),
    );
    expect(result.current.mode).toBe('template');
    expect(result.current.activeStyleKey).toBe('variant');

    act(() => result.current.undo());
    expect(result.current.mode).toBe('card');
    expect(result.current.activeStyleKey).toBe('base');
    expect(result.current.selectedFieldId).toBe('title');

    act(() => result.current.redo());
    expect(result.current.mode).toBe('template');
    expect(result.current.selectedFieldId).toBe('body');
  });

  it('hard-reset clears history so previous sessions cannot be undone', () => {
    const { result } = renderHook(() => useUndoableDocument({ pack, cards }));
    act(() => result.current.setCards([]));
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.resetDocument(doc()));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.cards).toBe(cards);
  });

  it('caps history at 50 steps', () => {
    const { result } = renderHook(() => useUndoableDocument({ pack, cards }));
    for (let i = 0; i < 70; i += 1) {
      act(() => result.current.setCards([{ id: '1', styleKey: 'base', values: { n: String(i) } }]));
    }
    for (let i = 0; i < 50; i += 1) act(() => result.current.undo());
    // After exhausting the capped timeline we are at the first retained state.
    expect(result.current.cards[0].values.n).toBe('19');
    expect(result.current.canUndo).toBe(false);
  });

  it('coalesces rapid edits that share a key into one history step', () => {
    const { result } = renderHook(() => useUndoableDocument({ pack, cards }));
    act(() =>
      result.current.setCards([{ id: '1', styleKey: 'base', values: { title: 'A' } }], 'typing'),
    );
    act(() =>
      result.current.setCards([{ id: '1', styleKey: 'base', values: { title: 'AB' } }], 'typing'),
    );
    expect(result.current.cards[0].values.title).toBe('AB');

    act(() => result.current.undo());
    expect(result.current.cards[0].values.title).toBe('A');
  });

  it('drops the redo stack after a new edit', () => {
    const { result } = renderHook(() => useUndoableDocument({ pack, cards }));
    act(() => result.current.setPack({ ...pack, name: 'Un' }));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.setCards([]));
    expect(result.current.canRedo).toBe(false);
  });
});
