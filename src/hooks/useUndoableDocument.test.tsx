import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUndoableDocument } from './useUndoableDocument';
import { CardData, CardTemplatePack } from '../types/template';

const pack: CardTemplatePack = {
  name: 'Pack',
  activeStyleKey: 'base',
  styles: [{ key: 'base', name: 'Base', width: 100, height: 100, fields: [] }],
};
const cards: CardData[] = [{ id: '1', styleKey: 'base', values: { title: 'A' } }];

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
    const nextPack = { ...pack, name: 'Autre pack' };
    const nextCards = [{ id: '2', styleKey: 'base', values: {} }];

    act(() => result.current.setDocument({ pack: nextPack, cards: nextCards }));
    expect(result.current.pack.name).toBe('Autre pack');
    expect(result.current.cards[0].id).toBe('2');

    act(() => result.current.undo());
    expect(result.current.pack).toBe(pack);
    expect(result.current.cards).toBe(cards);
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
