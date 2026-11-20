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
      // The live preview only paints the image; it does not read canvas pixels,
      // so avoid CORS mode here or ordinary external URLs would fail to render.
      loadImage(src, timeoutMs, null).then((loaded) => {
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
