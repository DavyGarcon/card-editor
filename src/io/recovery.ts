import { downloadJsonFile } from './fileIO';

export type SessionKind = 'template' | 'deck';

const KEYS: Record<SessionKind, string> = {
  template: 'modern-geckos-template-recovery-v1',
  deck: 'modern-geckos-deck-recovery-v1',
};

export function recoveryKey(kind: SessionKind): string {
  return KEYS[kind];
}

/** Keeps an incompatible/corrupt autosave so it cannot be silently lost. */
export function storeRecovery(kind: SessionKind, raw: string): void {
  try {
    localStorage.setItem(KEYS[kind], raw);
  } catch {
    // Storage may be disabled; nothing more we can do here.
  }
}

export function clearRecovery(kind: SessionKind): void {
  try {
    localStorage.removeItem(KEYS[kind]);
  } catch {
    // Ignore.
  }
}

export function downloadRecovery(kind: SessionKind): void {
  try {
    const raw = localStorage.getItem(KEYS[kind]);
    if (raw) downloadJsonFile(`modern-geckos-${kind}-recovery.json`, raw);
  } catch {
    // Ignore.
  }
}
