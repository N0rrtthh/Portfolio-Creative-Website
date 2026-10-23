"use client";

import { useRef, useEffect, useState, memo } from "react";
import { ArrowRight } from "lucide-react";
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from "framer-motion";
import { useSectionNav } from "@/lib/hooks/useSectionNav";
import { DUR, EASE } from "@/lib/motion";

const TYPING_LINES = [
  "> ACCESSING USER DATABASE...",
  "> DIRECTIVE: BUILD HIGH-PERFORMANCE DIGITAL SYSTEMS",
  "> OPERATIONAL STATUS: FULL SYNC ACHIEVED",
  "> USER: ELRONI QUIÑONES [NRTH.]",
];

function useTypingEffect(lines: string[], charDelay = 18, lineDelay = 400) {
  const [displayed, setDisplayed] = useState<string[]>([]);

  useEffect(() => {
    let currentLine = 0;
    let currentChar = 0;
    let cancelled = false;

    function typeNext() {
      if (cancelled || currentLine >= lines.length) return;

      if (currentChar === 0) {
        setDisplayed((prev) => [...prev, ""]);
      }

      if (currentChar < lines[currentLine].length) {
        const c = currentChar;
        const l = currentLine;
        setDisplayed((prev) => {
          const next = [...prev];
          next[l] = lines[l].substring(0, c + 1);
          return next;
        });
        currentChar++;
        setTimeout(typeNext, charDelay);
      } else {
        currentLine++;
        currentChar = 0;
        setTimeout(typeNext, lineDelay);
      }
    }

    const startTimer = setTimeout(typeNext, 800);
    return () => {
      cancelled = true;
      clearTimeout(startTimer);
    };
  }, [lines, charDelay, lineDelay]);

  return displayed;
}

/* ── Ambient A.T. field layer ─────────────────────────────────────
   The old hero was a static block: one fade-in per element and then
   nothing moved. This adds three cheap, continuously-alive layers —
   all transform/opacity only, so they stay on the compositor:

   1. a hex/grid field that drifts and breathes
   2. a vertical scan sweep on a long, irregular loop
   3. a slow counter-rotating target reticle behind the headline

   `pointer-events-none` throughout: this is scenery, never a hit
   target, which is also why none of it can steal clicks from the CTAs. */
const ATFieldBackdrop = memo(function ATFieldBackdrop({ still }: { still: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Drifting grid field. All five layers loop in CSS keyframes
          (globals.css) — framer drove them from JS and rewrote inline
          styles every frame; the compositor now does it for free. */}
      <div
        className="absolute -inset-[20%] opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-accent-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-accent-primary) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at 50% 45%, black 20%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 45%, black 20%, transparent 72%)",
          animation: still ? undefined : "eva-grid-drift 12s linear infinite",
        }}
      />

      {/* Breathing accent bloom */}
      <div
        className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        style={{
          background: "var(--color-accent-primary)",
          opacity: 0.14,
          animation: still ? undefined : "eva-bloom 7s ease-in-out infinite",
        }}
      />

      {/* Counter-rotating reticle rings */}
      <div
        className="absolute left-1/2 top-1/2 h-[62vmin] w-[62vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[var(--color-accent-warm)]/25"
        style={{ animation: still ? undefined : "loop-spin 60s linear infinite" }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-[44vmin] w-[44vmin] -translate-x-1/2 -translate-y-1/2 border border-[var(--color-accent-primary)]/25"
        style={{ animation: still ? undefined : "loop-spin-reverse 42s linear infinite" }}
      />

      {/* Scan sweep */}
      <div
        className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent via-[var(--color-accent-warm)]/12 to-transparent"
        style={{
          transform: "translateY(-10vh)",
          animation: still ? undefined : "eva-scan 8.5s linear infinite",
        }}
      />
    </div>
  );
});

export default function EvaHero() {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const typedLines = useTypingEffect(TYPING_LINES);
  const { navigate } = useSectionNav();

  /* Pointer parallax. Springs, not raw values, so the headline trails the
     cursor with weight instead of snapping to it. Fine pointers only —
     on touch there is no hover state to react to. */
  const px = useSpring(0, { stiffness: 60, damping: 20, mass: 0.6 });
  const py = useSpring(0, { stiffness: 60, damping: 20, mass: 0.6 });

  useEffect(() => {
    if (reduceMotion) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    function onMove(e: MouseEvent) {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      px.set(nx * 22);
      py.set(ny * 14);
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [px, py, reduceMotion]);

  const still = Boolean(reduceMotion);
  const headline = "PROJECT";

  return (
    <section
      ref={ref}
      id="hero"
      className="relative flex min-h-svh flex-col justify-center overflow-hidden py-24 sm:py-28 md:py-32"
    >
      <ATFieldBackdrop still={still} />

      <motion.div style={{ y, opacity }} className="container-narrow relative z-10">
        <motion.div style={{ x: px, y: py }} className="border-l-4 border-[var(--color-accent-warm)] pl-5 sm:pl-8 md:pl-16">
          {/* Status badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.6, 1] }}
            transition={{ duration: 0.6, times: [0, 0.2, 0.5, 1] }}
            className="mb-6 sm:mb-8 inline-flex flex-wrap items-center gap-3 border border-[var(--color-accent-warm)]/40 bg-[var(--color-accent-warm)]/10 px-3 py-1.5 font-mono text-[10px] tracking-[0.25em] text-[var(--color-accent-warm)] sm:px-4 sm:text-xs"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent-warm)] shadow-[0_0_8px_var(--color-accent-warm)] animate-pulse" />
            SYSTEM OVERRIDE // DWN-01 SYNC: 100%
          </motion.div>

          {/* Heading — per-character entry so it assembles rather than
              sliding in as one slab, then holds a slow chromatic flicker. */}
          <h1 className="mb-6 sm:mb-8 font-display text-[clamp(2.6rem,12vw,9rem)] font-black uppercase leading-[0.88] tracking-tighter text-[var(--color-starlight)]">
            <span className="sr-only">Project 01 — Nrth.</span>
            <span aria-hidden className="block">
              {headline.split("").map((char, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
                  transition={{ duration: 0.5, delay: 0.15 + i * 0.045, ease: EASE.out }}
                  className="inline-block"
                >
                  {char}
                </motion.span>
              ))}
            </span>
            <motion.span
              aria-hidden
              initial={{ opacity: 0, x: -24 }}
              animate={
                still
                  ? { opacity: 1, x: 0 }
                  : { opacity: [0, 1, 0.82, 1], x: 0 }
              }
              transition={{ duration: 0.8, delay: 0.5, ease: EASE.out }}
              className="block text-[var(--color-accent-primary)] drop-shadow-[0_0_20px_var(--color-accent-primary)]"
            >
              <motion.span
                animate={still ? undefined : { opacity: [1, 0.8, 1] }}
                transition={{ duration: 0.16, repeat: Infinity, repeatType: "mirror", repeatDelay: 3.4 }}
                className="inline-block"
              >
                09 // NRTH.
              </motion.span>
            </motion.span>
          </h1>

          {/* Terminal card with typing effect */}
          <motion.div
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="relative max-w-2xl origin-top border border-[var(--color-accent-primary)]/50 bg-[var(--color-obsidian)] p-4 shadow-[0_0_40px_rgba(0,0,0,0.5)] sm:p-6 md:p-8"
          >
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 h-3 w-3 border-t-2 border-l-2 border-[var(--color-accent-warm)]" />
            <div className="absolute top-0 right-0 h-3 w-3 border-t-2 border-r-2 border-[var(--color-accent-warm)]" />
            <div className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-[var(--color-accent-warm)]" />
            <div className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-[var(--color-accent-warm)]" />

            <p className="mb-4 font-mono text-[10px] font-bold tracking-[0.2em] text-[var(--color-accent-warm)]">
              CLASSIFIED DATA. AUTHORIZED PERSONNEL ONLY.
            </p>

            <div className="space-y-1.5 font-mono text-[11px] break-words text-[var(--color-pearl)] sm:text-xs md:text-sm">
              {typedLines.map((line, i) => (
                <p key={i} className={line.startsWith("> USER") ? "font-bold text-[var(--color-accent-warm)]" : ""}>
                  {line}
                  {i === typedLines.length - 1 && (
                    <span className="ml-1 inline-block h-3.5 w-2 bg-[var(--color-accent-primary)] animate-pulse" />
                  )}
                </p>
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.base, delay: 0.9, ease: EASE.out }}
            className="mt-8 flex flex-wrap gap-3 sm:mt-10 sm:gap-4"
          >
            {/* Both CTAs route through useSectionNav. A bare href="#projects"
                triggers a NATIVE hash jump, which Lenis overwrites on the very
                next frame — that was the "first click does nothing" bug. */}
            <a
              href="#projects"
              onClick={(e) => navigate(e, "#projects")}
              className="flex items-center gap-3 border border-[var(--color-accent-warm)]/50 bg-[var(--color-accent-primary)] px-5 py-3 font-mono text-xs font-bold tracking-widest text-white transition-all duration-200 hover:bg-[var(--color-accent-warm)] hover:text-black hover:shadow-[0_0_20px_var(--color-accent-warm)] sm:px-8 sm:py-4 sm:text-sm"
              data-cursor-hover
            >
              PROJECT LINK
              <ArrowRight size={18} />
            </a>
            <a
              href="#about"
              onClick={(e) => navigate(e, "#about")}
              className="flex items-center gap-3 border border-[var(--color-accent-primary)]/40 px-5 py-3 font-mono text-xs tracking-widest text-[var(--color-pearl)] transition-all duration-200 hover:border-[var(--color-accent-warm)] hover:text-[var(--color-accent-warm)] sm:px-8 sm:py-4 sm:text-sm"
              data-cursor-hover
            >
              VIEW USER DATA
            </a>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* NOTE: the "SCROLL TO PROCEED" affordance was removed deliberately.
          The hero already ends mid-viewport and the CTAs are the real entry
          points — a permanent scroll hint on a page that obviously scrolls is
          decoration competing with the actual actions. */}
    </section>
  );
}
