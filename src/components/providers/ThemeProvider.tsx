"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { prefersReducedMotion } from "@/lib/performance";

export type ColorMode = "light" | "dark";
export type DesignTheme = "classic" | "eva";
export type EvaLoaderStyle = "side" | "terminal";

interface ThemeContextValue {
  mode: ColorMode;
  design: DesignTheme;
  evaLoaderStyle: EvaLoaderStyle;
  setDesign: (design: DesignTheme, origin?: { x: number; y: number }) => void;
  setEvaLoaderStyle: (style: EvaLoaderStyle) => void;
  toggleEvaLoaderStyle: () => void;
  toggleMode: (origin?: { x: number; y: number }) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const MODE_KEY = "eq-color-mode";
const DESIGN_KEY = "eq-design-theme";
const EVA_LOADER_KEY = "eq-eva-loader-style";

/**
 * Pins the reveal origin used by the `::view-transition-new(root)` clip-path,
 * plus the radius it has to grow to.
 *
 * The radius is measured rather than hard-coded: `circle(150%)` is relative to
 * the viewport's diagonal, so a toggle in the corner of a wide screen finishes
 * its wipe early and then animates nothing for the rest of the duration. The
 * real target is the distance from the origin to the furthest corner.
 */
function setRevealOrigin(origin: { x: number; y: number }) {
  const root = document.documentElement;
  const { innerWidth: w, innerHeight: h } = window;

  const dx = Math.max(origin.x, w - origin.x);
  const dy = Math.max(origin.y, h - origin.y);
  const radius = Math.hypot(dx, dy);

  root.style.setProperty("--vt-x", `${origin.x}px`);
  root.style.setProperty("--vt-y", `${origin.y}px`);
  root.style.setProperty("--vt-r", `${Math.ceil(radius)}px`);
}

/**
 * Read initial state from DOM or localStorage.
 */
function getInitialFromDOM(): { mode: ColorMode; design: DesignTheme; evaLoaderStyle: EvaLoaderStyle } {
  if (typeof document === "undefined") {
    return { mode: "dark", design: "classic", evaLoaderStyle: "side" };
  }
  const root = document.documentElement;
  const mode = (root.getAttribute("data-mode") as ColorMode) || "dark";
  const design = (root.getAttribute("data-design") as DesignTheme) || "eva";
  const evaLoaderStyle = (localStorage.getItem(EVA_LOADER_KEY) as EvaLoaderStyle) || "side";
  return { mode, design, evaLoaderStyle };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ColorMode>(() => getInitialFromDOM().mode);
  const [design, setDesignState] = useState<DesignTheme>(() => getInitialFromDOM().design);
  const [evaLoaderStyle, setEvaLoaderStyleState] = useState<EvaLoaderStyle>(() => getInitialFromDOM().evaLoaderStyle);

  useEffect(() => {
    document.documentElement.setAttribute("data-mode", mode);
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-design", design);
    localStorage.setItem(DESIGN_KEY, design);
  }, [design]);

  useEffect(() => {
    localStorage.setItem(EVA_LOADER_KEY, evaLoaderStyle);
  }, [evaLoaderStyle]);

  /* ══════════════════════════════════════════════════════════
     Light ⇄ dark
     ──────────────────────────────────────────────────────────
     globals.css has always carried the `::view-transition-*` rules for
     this, but nothing ever called `startViewTransition` — so flipping
     `data-mode` re-evaluated every colour variable inside one frame and
     the whole page hard-cut. That snap is the "unpolished" part.

     Two details make it read as deliberate instead:

     1. The swap runs inside a view transition, so the browser holds a
        snapshot of the old palette and the new one wipes in from the
        toggle itself — the change appears to come from the thing you
        pressed, rather than from nowhere.
     2. `flushSync` inside the callback. `startViewTransition` captures
        "before", runs the callback, then captures "after". React would
        normally batch `setMode` past that second capture, and the
        transition would animate two identical frames — i.e. look broken.
        Committing synchronously is what actually makes it work.

     No support / reduced motion → plain state change, same end result.
     ══════════════════════════════════════════════════════════ */
  const commitMode = useCallback((next: ColorMode) => {
    // Written here as well as in the effect below: the effect runs after
    // the transition has already sampled the DOM, which is too late.
    document.documentElement.setAttribute("data-mode", next);
    setMode(next);
  }, []);

  const toggleMode = useCallback(
    (origin?: { x: number; y: number }) => {
      const nextMode: ColorMode = mode === "dark" ? "light" : "dark";

      // Origin of the wipe. Defaults live in the CSS, so an
      // origin-less call still behaves.
      if (origin) setRevealOrigin(origin);

      // Override-aware: `?motion=full` restores the wipe transition even
      // when the OS asks for reduced motion.
      const reduced = prefersReducedMotion();

      const startViewTransition = document.startViewTransition?.bind(document);

      if (!startViewTransition || reduced) {
        commitMode(nextMode);
        return;
      }

      startViewTransition(() => {
        flushSync(() => commitMode(nextMode));
      });
    },
    [mode, commitMode]
  );

  const setDesign = useCallback(
    (nextDesign: DesignTheme, origin?: { x: number; y: number }) => {
      if (origin) setRevealOrigin(origin);
      setDesignState(nextDesign);
    },
    []
  );

  const setEvaLoaderStyle = useCallback((style: EvaLoaderStyle) => {
    setEvaLoaderStyleState(style);
  }, []);

  const toggleEvaLoaderStyle = useCallback(() => {
    setEvaLoaderStyleState((prev) => (prev === "side" ? "terminal" : "side"));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        design,
        evaLoaderStyle,
        setDesign,
        setEvaLoaderStyle,
        toggleEvaLoaderStyle,
        toggleMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

export const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var mode = localStorage.getItem("${MODE_KEY}") || "dark";
    var design = localStorage.getItem("${DESIGN_KEY}") || "eva";
    document.documentElement.setAttribute("data-mode", mode);
    document.documentElement.setAttribute("data-design", design);
  } catch (e) {}
})();
`;
