import { useCallback, useReducer } from 'react';
import { CardData, CardTemplatePack } from '../types/template';

export interface DocumentSnapshot {
  pack: CardTemplatePack;
  cards: CardData[];
}

const MAX_HISTORY = 50;

interface HistoryState extends DocumentSnapshot {
  past: DocumentSnapshot[];
  future: DocumentSnapshot[];
}

type Setter<T> = T | ((previous: T) => T);

type Action =
  | { type: 'setPack'; value: Setter<CardTemplatePack> }
  | { type: 'setCards'; value: Setter<CardData[]> }
  | { type: 'setDocument'; value: DocumentSnapshot }
  | { type: 'undo' }
  | { type: 'redo' };

function snapshot(state: HistoryState): DocumentSnapshot {
  return { pack: state.pack, cards: state.cards };
}

function commit(state: HistoryState, next: DocumentSnapshot): HistoryState {
  if (next.pack === state.pack && next.cards === state.cards) return state;
  return {
    ...next,
    past: [...state.past.slice(-(MAX_HISTORY - 1)), snapshot(state)],
    future: [],
  };
}

function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case 'setPack': {
      const value = action.value;
      const pack =
        typeof value === 'function'
          ? (value as (previous: CardTemplatePack) => CardTemplatePack)(state.pack)
          : value;
      return commit(state, { pack, cards: state.cards });
    }
    case 'setCards': {
      const value = action.value;
      const cards =
        typeof value === 'function'
          ? (value as (previous: CardData[]) => CardData[])(state.cards)
          : value;
      return commit(state, { pack: state.pack, cards });
    }
    case 'setDocument':
      return commit(state, action.value);
    case 'undo': {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        ...previous,
        past: state.past.slice(0, -1),
        future: [...state.future, snapshot(state)],
      };
    }
    case 'redo': {
      const next = state.future[state.future.length - 1];
      if (!next) return state;
      return {
        ...next,
        past: [...state.past, snapshot(state)],
        future: state.future.slice(0, -1),
      };
    }
  }
}

/** Keeps pack + deck changes in a single undo/redo timeline. */
export function useUndoableDocument(initial: DocumentSnapshot) {
  const [state, dispatch] = useReducer(reducer, initial, (value): HistoryState => ({
    ...value,
    past: [],
    future: [],
  }));

  const setPack = useCallback(
    (value: Setter<CardTemplatePack>) => dispatch({ type: 'setPack', value }),
    [],
  );
  const setCards = useCallback(
    (value: Setter<CardData[]>) => dispatch({ type: 'setCards', value }),
    [],
  );
  const setDocument = useCallback(
    (value: DocumentSnapshot) => dispatch({ type: 'setDocument', value }),
    [],
  );
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);

  return {
    pack: state.pack,
    setPack,
    cards: state.cards,
    setCards,
    setDocument,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
