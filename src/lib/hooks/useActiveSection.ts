"use client";

/**
 * useActiveSection — which section the reader is currently in, plus the
 * "page has scrolled" flag both navbars use for their condensed state.
 *
 * WHY THIS EXISTS AS A HOOK
 * -------------------------
 * Classic and EVA each had their own copy of this, and each copy had the
 * same bug: one IntersectionObserver per section, every one of them calling
 * `setActive(itsOwnHref)` while it intersected a tall band. On most scroll
 * positions two sections satisfy that band at once, so the winner was
 * decided by the order the observer callbacks happened to fire — which is
 * neither document order nor "what is on screen". That is the navbar
 * highlighting the section above or below the one being read.
 *
 * A single reading line is deterministic: the active section is the last one
 * whose top has crossed a line 35% down the viewport. Exactly one section
 * can satisfy that at any scroll position, so there is nothing left to race.
 *
 * Everything runs in one rAF-throttled scroll pass — one listener for both
 * outputs, rather than a listener plus N observers.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Fraction of the viewport height where "you are reading this" is decided. */
const LINE = 0.35;
/** How long a clicked destination stays authoritative, ms. */
const CLICK_LOCK = 1400;

export function useActiveSection(hrefs: string[]) {
  const [active, setActive] = useState(hrefs[0] ?? "");
  const [scrolled, setScrolled] = useState(false);

  /* A click-driven scroll passes THROUGH every section between here and the
     target, so without a lock the highlight flickers across the whole nav on
     the way and can settle wherever the last update landed. */
  const lockUntil = useRef(0);

  // Kept in a ref so the effect isn't re-run by a new array identity on every
  // render of the parent.
  const hrefsRef = useRef(hrefs);

  useEffect(() => {
    hrefsRef.current = hrefs;
  }, [hrefs]);

  /** Call on nav click: takes the highlight immediately and holds it. */
  const lockTo = useCallback((href: string, ms = CLICK_LOCK) => {
    setActive(href);
    lockUntil.current = Date.now() + ms;
  }, []);

  useEffect(() => {
    let ticking = false;
    let lastScrolled: boolean | null = null;

    const pick = () => {
      const line = window.innerHeight * LINE;
      const list = hrefsRef.current;

      // At the very top of the page, always use the first section.
      if (window.scrollY < 10) return list[0] ?? "";

      // If any expected section hasn't mounted yet, don't guess. A partial
      // DOM makes the "last section past the line" check land on the wrong
      // item — this was the load-time "starts at Projects" bug: the sections
      // above Projects are dynamic and were not yet in the DOM, so Projects
      // was the first element found past the reading line.
      for (const href of list) {
        if (!document.querySelector(href)) return list[0] ?? "";
      }

      let best = list[0] ?? "";
      let bestTop = -Infinity;

      for (const href of list) {
        const el = document.querySelector(href);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        // Closest section that has already crossed the line.
        if (top <= line && top > bestTop) {
          bestTop = top;
          best = href;
        }
      }

      /* At the document's end a short final section may never reach the line
         — the page runs out of scroll first. Without this, Contact can never
         be highlighted, and that is the item a visitor is most likely to be
         looking at when they get there. */
      const atEnd =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
      if (atEnd && list.length) best = list[list.length - 1];

      return best;
    };

    const update = () => {
      const nextScrolled = window.scrollY > 40;
      if (nextScrolled !== lastScrolled) {
        lastScrolled = nextScrolled;
        setScrolled(nextScrolled);
      }
      if (Date.now() >= lockUntil.current) {
        const next = pick();
        setActive((prev) => (prev === next ? prev : next));
      }
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    // Run the first pick only once every section has mounted. Dynamic
    // sections (github-activity, techstack, certifications) render after
    // first paint; picking before they exist lands on the wrong item (the
    // "starts at Projects" load bug). Poll each frame until they're present.
    let pollFrame = 0;
    const waitForSections = () => {
      const ready = hrefsRef.current.every((href) =>
        document.querySelector(href)
      );
      if (ready) update();
      else pollFrame = requestAnimationFrame(waitForSections);
    };
    pollFrame = requestAnimationFrame(waitForSections);

    return () => {
      cancelAnimationFrame(pollFrame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return { active, scrolled, lockTo };
}

/**
 * Dismissal behaviour for a header-anchored mobile menu.
 *
 * The panels had no way out except picking an item or pressing the toggle
 * again: Escape did nothing, tapping the page behind did nothing, and
 * scrolling left the panel hanging over the content being scrolled. Each is
 * a separate expectation, so each is handled here once for both navbars.
 */
export function useMenuDismiss(
  open: boolean,
  close: () => void,
  /* The width at which the panel is hidden by CSS. It differs per navbar —
     Classic hides it at `md`, EVA at `lg` — and using the wrong one closes a
     menu that is still on screen. */
  desktopMinWidth = 768
) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointerDown = (e: PointerEvent) => {
      // The header holds both the panel and the toggle, so "outside the
      // header" is outside — and the toggle keeps owning its own click
      // instead of this closing the menu a moment before it reopens.
      if (!(e.target as HTMLElement)?.closest("header")) close();
    };
    const onScroll = () => close();
    // Crossing to the desktop breakpoint hides the panel in CSS but leaves it
    // "open", so the toggle's next press would appear to do nothing.
    const mq = window.matchMedia(`(min-width: ${desktopMinWidth}px)`);
    const onMq = () => {
      if (mq.matches) close();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    mq.addEventListener("change", onMq);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll);
      mq.removeEventListener("change", onMq);
    };
  }, [open, close, desktopMinWidth]);
}
