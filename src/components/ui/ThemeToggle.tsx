"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DUR, EASE, reduceable } from "@/lib/motion";

/* ══════════════════════════════════════════════════════════
   ThemeToggle
   ──────────────────────────────────────────────────────────
   Light/dark switch, plus the hidden route back to Classic mode
   while in EVA mode.

   THREE BUGS this replaces, all from the same cause — the reveal
   was armed on the *trigger* and the revealed button lived in its
   own hover world:

   1. Stuck visible. `onMouseLeave` only cleared the arming timer;
      nothing ever set `showSecretClassic` back to false, so once
      revealed it stayed on screen forever.
   2. Flicker / unreachable. Had a hide-on-leave been added naively
      to the trigger, moving the pointer toward the button would
      have hidden it mid-travel.
   3. Dead on touch. Coarse pointers have no hover at all, so the
      2s-hover gesture was simply unreachable on phones.

   The fix:
   · One hover region wraps BOTH the trigger and the revealed
     button, so travelling between them never fires leave → no
     flicker, no unreachable target.
   · Leaving that region starts a short, deliberate GRACE window
     before hiding (not a race-condition band-aid — it is the
     affordance: pointers cut corners, and a panel that vanishes
     the instant you clip its edge feels broken).
   · Re-entering cancels the pending hide; a fresh hover re-arms
     from zero, so it can be summoned again and again.
   · Touch gets an explicit equivalent gesture: long-press the
     toggle. The click that would otherwise follow is suppressed
     once, and a tap outside dismisses.
   ══════════════════════════════════════════════════════════ */

/** Continuous hover before the hidden switch appears. */
const ARM_MS = 1200;
/** Long-press equivalent for touch — same intent, coarse-pointer input. */
const PRESS_MS = 550;
/** Grace period after the pointer leaves the whole region. */
const GRACE_MS = 320;

export default function ThemeToggle() {
  const { mode, toggleMode, design, setDesign } = useTheme();
  const reduced = useReducedMotion();

  const [armedRaw, setArmed] = useState(false); // hovering, counting down
  const [revealedRaw, setRevealed] = useState(false);

  /* The EVA-only affordance is gated during render rather than reset from an
     effect. An effect would paint one frame of Classic mode with the EVA
     button still on screen and then re-render to remove it; deriving it means
     that frame never exists. Every read below goes through these two, so the
     stale raw values are unobservable. */
  const isEva = design === "eva";
  const armed = isEva && armedRaw;
  const revealed = isEva && revealedRaw;

  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** A long-press fires before the click it belongs to — swallow that click. */
  const swallowClick = useRef(false);

  const clearTimers = useCallback(() => {
    if (armTimer.current) clearTimeout(armTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    armTimer.current = null;
    hideTimer.current = null;
  }, []);

  // No timer may outlive the component.
  useEffect(() => clearTimers, [clearTimers]);

  // Timers, though, are an external system — they do have to be torn down.
  useEffect(() => {
    if (!isEva) clearTimers();
  }, [isEva, clearTimers]);

  // Touch has no "leave", so dismissal has to come from outside input.
  useEffect(() => {
    if (!revealed) return;
    const onOutside = (e: PointerEvent) => {
      if (!(e.target as HTMLElement)?.closest("[data-theme-toggle-root]")) {
        clearTimers();
        setRevealed(false);
        setArmed(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRevealed(false);
        setArmed(false);
      }
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [revealed, clearTimers]);

  /* ── Reveal lifecycle ───────────────────────────────── */

  const arm = useCallback(
    (delay: number) => {
      if (design !== "eva") return;
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      if (revealed) return; // already open — nothing to arm
      setArmed(true);
      if (armTimer.current) clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => {
        armTimer.current = null;
        setRevealed(true);
        setArmed(false);
      }, delay);
    },
    [design, revealed]
  );

  const disarm = useCallback(() => {
    if (armTimer.current) {
      clearTimeout(armTimer.current);
      armTimer.current = null;
    }
    setArmed(false);
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null;
      setRevealed(false);
    }, GRACE_MS);
  }, []);

  /* ── Pointer handlers ───────────────────────────────── */

  // Mouse/pen only. Touch fires a synthetic enter on tap, which would
  // arm the hover gesture and fight the long-press one.
  function handlePointerEnter(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    arm(ARM_MS);
  }

  function handlePointerLeave(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    disarm();
    if (revealed) scheduleHide();
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "touch") return;
    if (revealed) return;
    swallowClick.current = false;
    setArmed(true);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => {
      armTimer.current = null;
      swallowClick.current = true; // this press was a reveal, not a toggle
      setRevealed(true);
      setArmed(false);
    }, PRESS_MS);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (e.pointerType !== "touch") return;
    disarm(); // released early → it was an ordinary tap
  }

  /* ── Actions ────────────────────────────────────────── */

  function handleModeClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    toggleMode({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  function handleSwitchToClassic(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    clearTimers();
    setRevealed(false);
    setArmed(false);
    const rect = e.currentTarget.getBoundingClientRect();
    setDesign("classic", {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }

  const showArmHint = armed;

  return (
    <div
      data-theme-toggle-root
      className="relative inline-flex items-center overflow-visible z-50"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {/* Dark/Light mode switch */}
      <button
        type="button"
        onClick={handleModeClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        data-cursor-hover
        className={`relative inline-flex h-9 w-16 shrink-0 cursor-pointer items-center rounded-full border bg-[var(--color-glass-bg)] px-1 transition-[border-color,box-shadow,transform] duration-300 ease-out hover:scale-105 active:scale-[0.97] transform-gpu ${
          showArmHint
            ? "border-[var(--color-accent-warm)] shadow-[0_0_14px_var(--color-accent-warm)]"
            : "border-[var(--color-glass-border)]"
        }`}
      >
        {/* Sliding thumb */}
        <span
          className="pointer-events-none absolute h-7 w-7 rounded-full bg-[var(--color-accent-primary)] shadow-md transition-transform duration-300 ease-out"
          style={{
            transform: mode === "dark" ? "translateX(0)" : "translateX(28px)",
          }}
          aria-hidden="true"
        />

        <span className="pointer-events-none relative z-10 flex w-full items-center justify-between px-1.5 text-[var(--color-starlight)]">
          <Moon
            size={14}
            className={`transition-opacity duration-200 ${mode === "dark" ? "opacity-100" : "opacity-40"}`}
          />
          <Sun
            size={14}
            className={`transition-opacity duration-200 ${mode === "light" ? "opacity-100" : "opacity-40"}`}
          />
        </span>
      </button>

      {/* Hidden route back to Classic. Plain button, no popover chrome —
          it lives inside the same hover region as the trigger above, so
          the pointer can travel to it without the reveal collapsing.
          `pt-3` is padding, not margin: it keeps the gap INSIDE the
          hoverable box instead of creating a dead strip across it. */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            key="classic-switch"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={reduceable(
              { duration: DUR.fast, ease: EASE.out },
              !!reduced
            )}
            className="absolute top-full right-0 z-[9999] pt-3"
          >
            <button
              type="button"
              onClick={handleSwitchToClassic}
              data-cursor-hover
              autoFocus
              className="whitespace-nowrap rounded-xl border border-[var(--color-accent-warm)] bg-[var(--color-obsidian)] px-4 py-2.5 font-mono text-[11px] font-bold tracking-wider text-[var(--color-accent-warm)] transition-colors duration-200 hover:bg-[var(--color-accent-warm)] hover:text-black active:scale-[0.97]"
            >
              Classic Mode
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
