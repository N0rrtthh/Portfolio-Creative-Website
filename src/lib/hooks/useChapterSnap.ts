"use client";

import { useEffect } from "react";
import { useLenis } from "@/components/providers/SmoothScrollProvider";
import { prefersReducedMotion } from "@/lib/performance";

/**
 * Chapter snapping — magnetic stop points at the top of each chapter.
 *
 * CSS `scroll-snap` can't be used here because Lenis virtualizes the wheel
 * and the sections are wildly different heights (the Experience timeline
 * runs several viewport-heights). Instead this watches Lenis' scroll
 * stream: once the reader comes to rest, if they stopped WITHIN a snap
 * radius of a chapter top, the page gently completes the move and parks
 * exactly on that chapter. Landings deep inside a tall chapter stay free
 * so long sections remain fully scrollable.
 *
 * Guards:
 *  - Never pulls away from the very top/bottom of the document.
 *  - Tall sections (> TALL_RATIO × viewport) only magnetise at their top
 *    edge; once the reader is inside one, scrolling stays free so they're
 *    never trapped.
 *  - A safety timeout releases the `programmatic` flag even if a snap is
 *    interrupted mid-flight (user scrolls again), so snapping never locks.
 */

const IDLE_MS = 170; // how long "at rest" before we consider snapping
const SNAP_RADIUS_VH = 0.33; // snap when within 33% of a viewport of a chapter top
const MIN_DELTA = 4; // ignore sub-pixel corrections
const TALL_RATIO = 1.3; // sections taller than this × viewport are "tall"
const TALL_ENTRY_VH = 0.25; // free-scroll buffer once this far into a tall section
const EDGE_EPSILON = 2; // don't snap when already at a document edge
const PROGRAMMATIC_TIMEOUT_MS = 1400; // safety net for the in-flight flag

export function useChapterSnap(ids: readonly string[]) {
  const lenis = useLenis();
  const key = ids.join(",");

  useEffect(() => {
    if (!lenis || prefersReducedMotion()) return;

    let timer: number | null = null;
    let flagTimer: number | null = null;
    let programmatic = false;

    const releaseFlag = () => {
      programmatic = false;
      if (flagTimer !== null) {
        window.clearTimeout(flagTimer);
        flagTimer = null;
      }
    };

    const settle = () => {
      // Don't fight a snap (or nav jump) that's already in flight.
      if (programmatic) return;

      const y = window.scrollY;
      const vh = window.innerHeight;
      const radius = vh * SNAP_RADIUS_VH;
      const maxDoc = document.documentElement.scrollHeight - vh;

      // Document edges are natural rest points — never pull away from them.
      if (y <= EDGE_EPSILON || y >= maxDoc - EDGE_EPSILON) return;

      let best: { top: number; dist: number; tall: boolean } | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top + y;
        const dist = top - y;
        if (Math.abs(dist) <= radius && (!best || Math.abs(dist) < Math.abs(best.dist))) {
          best = { top, dist, tall: el.offsetHeight > vh * TALL_RATIO };
        }
      }

      if (!best || Math.abs(best.dist) < MIN_DELTA) return;

      // Inside a tall section (past its entry buffer) → keep scrolling free.
      // Only the top edge of a tall chapter magnetises.
      if (best.tall && best.dist < 0 && Math.abs(best.dist) > vh * TALL_ENTRY_VH) {
        return;
      }

      programmatic = true;
      lenis.scrollTo(best.top, {
        // Short hops feel like a magnet click, long ones stay graceful.
        duration: Math.min(1.1, 0.35 + Math.abs(best.dist) / vh),
        onComplete: releaseFlag,
      });
      // Safety net: release the flag even if the animation is interrupted.
      if (flagTimer !== null) window.clearTimeout(flagTimer);
      flagTimer = window.setTimeout(releaseFlag, PROGRAMMATIC_TIMEOUT_MS);
    };

    const onScroll = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(settle, IDLE_MS);
    };

    lenis.on("scroll", onScroll);
    return () => {
      lenis.off("scroll", onScroll);
      if (timer !== null) window.clearTimeout(timer);
      if (flagTimer !== null) window.clearTimeout(flagTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lenis, key]);
}