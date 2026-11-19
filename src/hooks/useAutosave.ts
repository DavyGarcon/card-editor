import { useCallback, useEffect, useRef, useState } from 'react';
import { saveDeckSession, type DeckSession } from '../io/deckIO';
import { saveTemplateSession, type TemplateSession } from '../io/templateIO';

export type SaveStatus = 'saved' | 'saving' | 'error';

/**
 * Debounced autosave for the two independent slots. The latest sessions are
 * kept in a ref so pagehide/visibilitychange can flush pending edits without
 * waiting for the 400 ms timer.
 */
export function useAutosave(template: TemplateSession, deck: DeckSession) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const latest = useRef({ template, deck });

  useEffect(() => {
    latest.current = { template, deck };
  }, [template, deck]);

  const saveNow = useCallback(() => {
    const templateOk = saveTemplateSession(latest.current.template);
    const deckOk = saveDeckSession(latest.current.deck);
    setStatus(templateOk && deckOk ? 'saved' : 'error');
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStatus('saving');
      saveNow();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [template, deck, saveNow]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', saveNow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [saveNow]);

  return { status, saveNow };
}
