import { useEffect, useState } from 'react';
import { resolveImageRef } from '../io/imageStore';
import { loadImage } from '../utils/imageLoader';

/** Resolves an `idb:` ref (or URL) and loads the image with a timeout. */
export function useImage(ref: string | undefined, timeoutMs = 8000): HTMLImageElement | null {
  const [state, setState] = useState<{
    ref: string | undefined;
    image: HTMLImageElement | null;
  }>({ ref: undefined, image: null });

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    resolveImageRef(ref).then((src) => {
      if (cancelled || !src) return;
      loadImage(src, timeoutMs).then((loaded) => {
        if (!cancelled) setState({ ref, image: loaded });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [ref, timeoutMs]);

  // Deriving the current value avoids an extra render when the ref changes.
  return state.ref === ref ? state.image : null;
}
