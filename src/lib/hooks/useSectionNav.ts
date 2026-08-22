"use client";

import { useCallback, useEffect, useRef } from "react";
import { useLenis } from "@/components/providers/SmoothScrollProvider";
import { prefersReducedMotion } from "@/lib/performance";

/* ══════════════════════════════════════════════════════════
   useSectionNav — the ONE code path for every in-page jump
   ──────────────────────────────────────────────────────────
   Two separate root causes made the hero CTAs ("INITIATE LINK",
   "VIEW PILOT DATA") feel like they needed a second click:

   1. A plain `<a href="#projects">` performs a *native* hash jump.
      Lenis owns scroll position from its own rAF loop, so on the next
      frame it writes its internal target back and the page snaps
      home. Reads as "nothing happened".

   2. Even routed through `lenis.scrollTo(element)`, the destination
      is resolved ONCE, at click time. Between that moment and the end
      of the 1.2s animation the document reflows:
        · `min-h-svh` on the hero shrinks when the mobile URL bar
          collapses (which the scroll itself causes),
        · `content-visibility: auto` sections swap their
          `contain-intrinsic-size` guess for real height as they near
          the viewport,
        · below-fold images and `ssr:false` dynamic sections mount.
      The animation lands at a stale pixel offset, so the section is
      off-screen — and a *second* click, now measured against settled
      layout, works. That is the "needs two clicks" report.

   The fix for (2) is not a delay or a retry: the destination is
   re-measured every frame from live layout, so the animation converges
   on where the section actually IS, not where it was. `force: true`
   also means a stale `isStopped` flag on Lenis (left behind by a
   closing overlay) can never silently swallow the first click.
   ══════════════════════════════════════════════════════════ */

const NAV_OFFSET = -72; // clears the fixed navbar
const DEFAULT_DURATION = 1100;

/** easeOutQuart — fast commit, long settle. Matches EASE.out in lib/motion. */
const ease = (t: number) => 1 - Math.pow(1 - t, 4);

/** Live absolute document offset of the target, re-read every frame. */
function measure(el: HTMLElement, offset: number) {
  const raw = el.getBoundingClientRect().top + window.scrollY + offset;
  const max = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight
  );
  return Math.min(Math.max(raw, 0), max);
}

export function useSectionNav() {
  const lenis = useLenis();
  const rafRef = useRef<number | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // Never leave a rAF loop or an interrupt listener behind.
  useEffect(() => () => abortRef.current?.(), []);

  const scrollToId = useCallback(
    (hash: string, duration = DEFAULT_DURATION) => {
      const el = document.querySelector(hash) as HTMLElement | null;
      if (!el) return;

      abortRef.current?.();

      // Override-aware: `?motion=full` restores animated navigation even
      // when the OS asks for reduced motion.
      const prefersReduced = prefersReducedMotion();

      const write = (y: number) => {
        // `immediate` keeps Lenis' internal animatedScroll/targetScroll in
        // sync with what we just painted, so releasing control never jumps.
        // `force` bypasses a stale stopped/locked state.
        if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
        else window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
      };

      if (prefersReduced) {
        write(measure(el, NAV_OFFSET));
        return;
      }

      const startY = window.scrollY;
      const startTime = performance.now();
      let cancelled = false;

      // Any real scroll intent from the user wins immediately — an
      // in-flight programmatic scroll must never fight the wheel.
      const onInterrupt = () => stop();
      const stop = () => {
        if (cancelled) return;
        cancelled = true;
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        window.removeEventListener("wheel", onInterrupt);
        window.removeEventListener("touchstart", onInterrupt);
        abortRef.current = null;
      };
      abortRef.current = stop;

      window.addEventListener("wheel", onInterrupt, { passive: true });
      window.addEventListener("touchstart", onInterrupt, { passive: true });

      const step = (now: number) => {
        if (cancelled) return;
        const t = Math.min((now - startTime) / duration, 1);
        // Re-measured every frame: if the section moves mid-flight the
        // curve retargets instead of landing on a stale pixel.
        const targetY = measure(el, NAV_OFFSET);
        write(startY + (targetY - startY) * ease(t));
        if (t < 1) rafRef.current = requestAnimationFrame(step);
        else stop();
      };

      rafRef.current = requestAnimationFrame(step);
    },
    [lenis]
  );

  /** Drop-in onClick for any anchor that points at an in-page section. */
  const navigate = useCallback(
    (e: React.MouseEvent, hash: string) => {
      e.preventDefault();
      scrollToId(hash);
    },
    [scrollToId]
  );

  return { scrollToId, navigate };
}

export default useSectionNav;
