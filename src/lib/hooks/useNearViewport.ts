"use client";

import { useEffect, useRef, useState } from "react";
import { observeVisibility } from "@/lib/performance";

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/**
 * Latches `true` once a heavy below-the-fold child should mount, and never
 * flips back. Gate WebGL scenes and big data chunks on it so they stay out
 * of the first paint.
 *
 * Two triggers, whichever comes first:
 *  - the element comes within `margin` of the viewport, or
 *  - the page has been loaded for `idleAfterMs` and the main thread is idle.
 *
 * The idle path matters as much as the proximity one: mounting only on
 * approach meant a WebGL context + chunk evaluation landing in the middle
 * of a scroll — a hitch exactly where the reader is looking. Warming the
 * scene during idle time after the intro has settled usually has it ready
 * long before anyone scrolls down to it.
 */
export function useNearViewport<T extends Element>(
  margin = "120% 0px",
  idleAfterMs = 4500
) {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;

    const stop = observeVisibility(
      el,
      (v) => {
        if (v) setNear(true);
      },
      margin
    );

    const w = window as IdleWindow;
    let idleId: number | null = null;
    const timer = window.setTimeout(() => {
      if (w.requestIdleCallback) {
        idleId = w.requestIdleCallback(() => setNear(true), { timeout: 4000 });
      } else {
        setNear(true);
      }
    }, idleAfterMs);

    return () => {
      stop();
      window.clearTimeout(timer);
      if (idleId !== null) w.cancelIdleCallback?.(idleId);
    };
  }, [margin, idleAfterMs, near]);

  return [ref, near] as const;
}
