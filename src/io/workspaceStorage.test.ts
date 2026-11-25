import { beforeEach, describe, expect, it } from 'vitest';
import { BUILT_IN_TEMPLATES } from '../data';
import type { DocumentSnapshot } from '../hooks/useUndoableDocument';
import {
  loadWorkspace,
  saveWorkspace,
  WORKSPACE_FORMAT,
  WORKSPACE_STORAGE_KEY,
} from './workspaceStorage';

function exampleSnapshot(): DocumentSnapshot {
  const pack = structuredClone(BUILT_IN_TEMPLATES.find((item) => item.id === 'examplePack')!.pack);
  return {
    pack,
    cards: [{ id: 'card-1', styleKey: pack.styles[0].key, values: { title: 'Feu' } }],
    activeStyleKey: pack.styles[0].key,
    activeCardId: 'card-1',
    selectedFieldId: 'title',
    mode: 'card',
  };
}

describe('workspaceStorage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips the whole document', () => {
    const snapshot = exampleSnapshot();
    saveWorkspace(snapshot);

    expect(JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? '{}').format).toBe(
      WORKSPACE_FORMAT,
    );
    expect(loadWorkspace()).toEqual(snapshot);
  });

  it('returns null for missing, corrupt or foreign payloads', () => {
    expect(loadWorkspace()).toBeNull();

    localStorage.setItem(WORKSPACE_STORAGE_KEY, '{not json');
    expect(loadWorkspace()).toBeNull();

    localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({ format: 'modern-geckos-deck', cards: [] }),
    );
    expect(loadWorkspace()).toBeNull();

    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ format: WORKSPACE_FORMAT }));
    expect(loadWorkspace()).toBeNull();
  });

  it('repairs stale selections and unknown card styles', () => {
    const snapshot = exampleSnapshot();
    localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({
        format: WORKSPACE_FORMAT,
        pack: snapshot.pack,
        cards: [{ id: 'card-1', styleKey: 'deleted-style', values: {} }],
        activeStyleKey: 'deleted-style',
        activeCardId: 'missing-card',
        selectedFieldId: 'missing-field',
        mode: 'unknown',
      }),
    );

    const expectedStyleKey = snapshot.pack.activeStyleKey ?? snapshot.pack.styles[0].key;
    const restored = loadWorkspace();
    expect(restored).not.toBeNull();
    expect(restored!.activeStyleKey).toBe(expectedStyleKey);
    expect(restored!.cards[0].styleKey).toBe(expectedStyleKey);
    expect(restored!.activeCardId).toBe('card-1');
    expect(restored!.selectedFieldId).toBeNull();
    expect(restored!.mode).toBe('card');
  });

  it('keeps a valid pack when the stored deck is broken', () => {
    const snapshot = exampleSnapshot();
    localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({ format: WORKSPACE_FORMAT, pack: snapshot.pack, cards: [{ id: 3 }] }),
    );

    const restored = loadWorkspace();
    expect(restored?.pack).toEqual(snapshot.pack);
    expect(restored?.cards).toEqual([]);
  });
});
