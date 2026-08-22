"use client";

import { useSyncExternalStore } from "react";
import { getAdaptiveQuality, prefersReducedMotion } from "@/lib/performance";

/* ══════════════════════════════════════════════════════════
   Client-only booleans, read safely
   ──────────────────────────────────────────────────────────
   Both of these facts (does the user want reduced motion? is this a
   weak device?) live in browser APIs, so they cannot be read during
   render without SSR and hydration disagreeing.

   The usual workaround is `useState(false)` + `useEffect(() => setX(...))`,
   but that is a cascading render on every mount — the component paints
   once with the wrong value and immediately re-renders. `useSyncExternalStore`
   is built for exactly this: it takes a server snapshot and a client
   snapshot, so the very first client render already has the real value.
   ══════════════════════════════════════════════════════════ */

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(REDUCED_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Effective reduced-motion state, honouring the `?motion=full|reduced`
 * URL param and the `motion-override` localStorage key. See
 * `lib/performance.ts` for why: Windows' "Animation effects" toggle feeds
 * this media query, and when it's off the site disables almost every
 * effect even on fast hardware.
 */
function getReducedMotion() {
  return prefersReducedMotion();
}

/**
 * Reactive `prefers-reduced-motion`. Unlike the one-shot helper in
 * `lib/motion`, this updates if the user changes the OS setting while
 * the page is open.
 */
export function useReducedMotionPref(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false // server: assume motion is fine, then correct on the client
  );
}

/** Device tier never changes for the lifetime of the page. */
const noopSubscribe = () => () => {};

function getLowEnd() {
  return getAdaptiveQuality().tier === "low";
}

/** True when the adaptive-quality probe classifies this device as low tier. */
export function useLowEndDevice(): boolean {
  return useSyncExternalStore(noopSubscribe, getLowEnd, () => false);
}
