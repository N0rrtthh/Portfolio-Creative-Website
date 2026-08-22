/* ══════════════════════════════════════════════════════════
   MOTION SYSTEM — single source of truth for timing + easing
   ──────────────────────────────────────────────────────────
   Every animation in the portfolio pulls its duration and easing
   from here. That is what makes motion read as *authored* instead
   of a pile of one-off magic numbers.

   Rules of thumb used throughout:
     · exit is always faster than enter (user already decided)
     · UI feedback  → instant/fast
     · panels/modal → base with `out`
     · narrative reveals → reveal with `outExpo`
   ══════════════════════════════════════════════════════════ */

type Cubic = [number, number, number, number];

/** Durations in seconds (framer-motion units). */
export const DUR = {
  /** pressed-state / colour feedback */
  instant: 0.12,
  /** hover, small chrome, exits */
  fast: 0.2,
  /** the default: panel open, tab switch, card enter */
  base: 0.34,
  /** larger surfaces travelling further */
  slow: 0.55,
  /** hero / section narrative reveals */
  reveal: 0.85,
} as const;

/** Easing curves. Mirrors the CSS custom props in globals.css. */
export const EASE = {
  /** decelerate — the workhorse for anything entering */
  out: [0.22, 1, 0.36, 1] as Cubic,
  /** stronger decelerate — long travel, big surfaces */
  outExpo: [0.16, 1, 0.3, 1] as Cubic,
  /** accelerate — anything leaving the screen */
  in: [0.5, 0, 0.75, 0] as Cubic,
  /** symmetric — position swaps, garage doors, wipes */
  inOut: [0.76, 0, 0.24, 1] as Cubic,
} as const;

/** Springs, for anything the user is physically manipulating. */
export const SPRING = {
  /** buttons, toggles, small chrome */
  snappy: { type: "spring", stiffness: 520, damping: 32, mass: 0.6 },
  /** cards, popovers */
  soft: { type: "spring", stiffness: 320, damping: 28 },
  /** full panels / modals */
  panel: { type: "spring", stiffness: 260, damping: 26, mass: 0.9 },
} as const;

/** Stagger steps — deliberately small; long cascades feel sluggish. */
export const STAGGER = { tight: 0.03, base: 0.05, loose: 0.08 } as const;

/**
 * Reads the effective reduced-motion preference. Safe during SSR (returns
 * false). Honours the `?motion=full|reduced` URL param and the
 * `motion-override` localStorage key (see lib/performance.ts).
 * Prefer the reactive `useReducedMotionPref` for anything rendered.
 */
export { prefersReducedMotion } from "@/lib/performance";

/**
 * A transition that collapses to "effectively instant" when the user has
 * asked for reduced motion, without removing the state change itself.
 */
export function reduceable(
  transition: Record<string, unknown>,
  reduced: boolean
): Record<string, unknown> {
  return reduced ? { duration: 0.01 } : transition;
}
