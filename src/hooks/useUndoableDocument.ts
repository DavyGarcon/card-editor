import { useCallback, useReducer } from 'react';
import { CardData, CardTemplatePack } from '../types/template';

export type EditorMode = 'card' | 'template';

/** Everything needed to restore the editor exactly as the user left it. */
export interface DocumentSnapshot {
  pack: CardTemplatePack;
  cards: CardData[];
  activeStyleKey: string;
  activeCardId: string;
  selectedFieldId: string | null;
  mode: EditorMode;
}

export type DocumentInit = Partial<DocumentSnapshot> & Pick<DocumentSnapshot, 'pack' | 'cards'>;

type UiFields = Pick<
  DocumentSnapshot,
  'activeStyleKey' | 'activeCardId' | 'selectedFieldId' | 'mode'
>;

const MAX_HISTORY = 50;
const COALESCE_WINDOW_MS = 800;

interface HistoryState extends DocumentSnapshot {
  past: DocumentSnapshot[];
  future: DocumentSnapshot[];
  lastEditKey?: string;
  lastEditAt?: number;
}

type Setter<T> = T | ((previous: T) => T);

type Action =
  | { type: 'setPack'; value: Setter<CardTemplatePack>; coalesceKey?: string }
  | { type: 'setCards'; value: Setter<CardData[]>; coalesceKey?: string }
  | { type: 'setDocument'; value: DocumentSnapshot }
  | { type: 'setUi'; value: Partial<UiFields> }
  | { type: 'resetDocument'; value: DocumentSnapshot }
  | { type: 'undo' }
  | { type: 'redo' };

function snapshot(state: HistoryState): DocumentSnapshot {
  return {
    pack: state.pack,
    cards: state.cards,
    activeStyleKey: state.activeStyleKey,
    activeCardId: state.activeCardId,
    selectedFieldId: state.selectedFieldId,
    mode: state.mode,
  };
}

function sameDocument(a: HistoryState, b: DocumentSnapshot): boolean {
  return (
    a.pack === b.pack &&
    a.cards === b.cards &&
    a.activeStyleKey === b.activeStyleKey &&
    a.activeCardId === b.activeCardId &&
    a.selectedFieldId === b.selectedFieldId &&
    a.mode === b.mode
  );
}

function commit(state: HistoryState, next: DocumentSnapshot, coalesceKey?: string): HistoryState {
  if (sameDocument(state, next)) return state;
  const now = Date.now();
  const canCoalesce = Boolean(
    coalesceKey &&
    state.lastEditKey === coalesceKey &&
    now - (state.lastEditAt ?? 0) < COALESCE_WINDOW_MS &&
    state.past.length > 0,
  );
  return {
    ...next,
    past: canCoalesce ? state.past : [...state.past.slice(-(MAX_HISTORY - 1)), snapshot(state)],
    future: [],
    lastEditKey: coalesceKey,
    lastEditAt: coalesceKey ? now : undefined,
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
      return commit(state, { ...snapshot(state), pack }, action.coalesceKey);
    }
    case 'setCards': {
      const value = action.value;
      const cards =
        typeof value === 'function'
          ? (value as (previous: CardData[]) => CardData[])(state.cards)
          : value;
      return commit(state, { ...snapshot(state), cards }, action.coalesceKey);
    }
    case 'setDocument':
      return commit(state, action.value);
    case 'setUi':
      return { ...state, ...action.value, lastEditKey: undefined, lastEditAt: undefined };
    case 'resetDocument':
      return { ...action.value, past: [], future: [], lastEditKey: undefined };
    case 'undo': {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        ...previous,
        past: state.past.slice(0, -1),
        future: [...state.future, snapshot(state)],
        lastEditKey: undefined,
      };
    }
    case 'redo': {
      const next = state.future[state.future.length - 1];
      if (!next) return state;
      return {
        ...next,
        past: [...state.past, snapshot(state)],
        future: state.future.slice(0, -1),
        lastEditKey: undefined,
      };
    }
  }
}

/** Keeps the whole editor session in a single undo/redo timeline. */
export function useUndoableDocument(initial: DocumentInit) {
  const [state, dispatch] = useReducer(reducer, initial, (value): HistoryState => {
    const base: DocumentSnapshot = {
      pack: value.pack,
      cards: value.cards,
      activeStyleKey:
        value.activeStyleKey ?? value.pack.activeStyleKey ?? value.pack.styles[0]?.key ?? '',
      activeCardId: value.activeCardId ?? value.cards[0]?.id ?? '',
      selectedFieldId: value.selectedFieldId ?? null,
      mode: value.mode ?? 'card',
    };
    return { ...base, past: [], future: [] };
  });

  const setPack = useCallback(
    (value: Setter<CardTemplatePack>, coalesceKey?: string) =>
      dispatch({ type: 'setPack', value, coalesceKey }),
    [],
  );
  const setCards = useCallback(
    (value: Setter<CardData[]>, coalesceKey?: string) =>
      dispatch({ type: 'setCards', value, coalesceKey }),
    [],
  );
  const setDocument = useCallback(
    (value: DocumentSnapshot) => dispatch({ type: 'setDocument', value }),
    [],
  );
  const setUi = useCallback((value: Partial<UiFields>) => dispatch({ type: 'setUi', value }), []);
  const resetDocument = useCallback(
    (value: DocumentSnapshot) => dispatch({ type: 'resetDocument', value }),
    [],
  );
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);

  return {
    pack: state.pack,
    setPack,
    cards: state.cards,
    setCards,
    activeStyleKey: state.activeStyleKey,
    activeCardId: state.activeCardId,
    selectedFieldId: state.selectedFieldId,
    mode: state.mode,
    snapshot: useCallback(() => snapshot(state), [state]),
    setUi,
    setDocument,
    resetDocument,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
