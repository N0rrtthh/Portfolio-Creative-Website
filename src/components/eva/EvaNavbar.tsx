"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useSectionNav } from "@/lib/hooks/useSectionNav";
import { useActiveSection, useMenuDismiss } from "@/lib/hooks/useActiveSection";

/* Same five destinations as the Classic pill, in the same order — the
   two navbars list the same story, so switching themes never changes
   what you can reach. Codes keep their chapter numbers from the section
   headings (IDENTITY is Ch.02 there, so it stays 02 here); the intro
   act's inner beats (COMMITS, DATABASE) are reached by scrolling, same
   as Classic. SYSTEM (#hero) lives on the brand mark, as in Classic. */
const SECTIONS = [
  { label: "IDENTITY", href: "#about", code: "02" },
  { label: "VAULT", href: "#certifications", code: "05" },
  { label: "ARCHIVE", href: "#projects", code: "06" },
  { label: "HISTORY", href: "#experience", code: "07" },
  { label: "COMMS", href: "#contact", code: "08" },
];

export default function EvaNavbar() {
  const [open, setOpen] = useState(false);
  const { scrollToId } = useSectionNav();

  /* Shared with the Classic navbar — see lib/hooks/useActiveSection. The
     per-section observers this replaced could each claim the highlight while
     a tall band was satisfied, so the winner came down to callback order
     rather than to what was on screen. */
  const hrefs = useMemo(() => SECTIONS.map((s) => s.href), []);
  const { active, scrolled, lockTo } = useActiveSection(hrefs);

  const closeMenu = useCallback(() => setOpen(false), []);
  // EVA hides its panel at `lg`, not `md`.
  useMenuDismiss(open, closeMenu, 1024);

  /* Single nav code path — see lib/hooks/useSectionNav. The old inline
     version resolved the destination once at click time, so any reflow
     during the 1.6s flight (svh collapse, content-visibility sections
     gaining real height, dynamic imports mounting) left it short. */
  function handleNav(e: React.MouseEvent, href: string) {
    e.preventDefault();
    setOpen(false);
    // Holds the clicked code lit until the scroll actually lands.
    lockTo(href);
    scrollToId(href);
  }

  return (
    /* Three lanes, mirroring Classic: brand hard left and utilities hard
       right, both OUTSIDE the nav surface, with only the section codes in
       the floating pill. Full-bleed padding rather than `container-narrow`,
       because the two outer lanes are meant to reach the screen edges. */
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[padding] duration-500 ${
        scrolled ? "py-2" : "py-3.5"
      }`}
    >
      <div className="flex items-center gap-3 overflow-visible px-3 sm:px-5 lg:px-8">
        {/* ── Brand, pinned left ───────────────────────────── */}
        <a
          href="#hero"
          onClick={(e) => handleNav(e, "#hero")}
          className="flex shrink-0 items-center gap-3 group"
          aria-label="Nrth — Home"
          data-cursor-hover
        >
          <motion.div
            whileHover={{ scale: 1.12, rotate: -5 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            /* Borderless, glow kept on the glyph itself — same treatment as
               the Classic mark, so the two modes share an identity. */
            className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl p-1.5 sm:h-13 sm:w-13"
          >
            <Image
              src={`${process.env.NODE_ENV === "production" ? "/Portfolio-Website" : ""}/Favicon.png`}
              alt=""
              width={44}
              height={44}
              aria-hidden
              priority
              className="h-full w-full object-contain filter drop-shadow-[0_0_12px_rgba(67,97,238,0.85)] transition-[filter] duration-200 group-hover:drop-shadow-[0_0_20px_rgba(252,191,73,0.9)]"
            />
          </motion.div>
          <span className="font-sans text-lg font-extrabold tracking-tight text-[var(--color-starlight)] transition-colors group-hover:text-[var(--color-accent-warm)] sm:text-2xl">
            Nrth.
          </span>
        </a>

        {/* ── Section codes, centred pill ──────────────────── */}
        <nav className="flex min-w-0 flex-1 justify-center">
          <div
            className={`hidden items-center gap-1 rounded-full px-3 py-2 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500 lg:flex ${
              scrolled
                ? "border border-[var(--color-accent-primary)]/40 bg-[var(--color-void)]/70 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl"
                : "border border-transparent bg-transparent"
            }`}
          >
            {SECTIONS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleNav(e, item.href)}
                className={`relative rounded-full px-3 py-1.5 font-mono text-[11px] tracking-wider transition-colors duration-300 ${
                  active === item.href
                    ? "border border-[var(--color-accent-warm)]/40 bg-[var(--color-glass-highlight)] font-bold text-[var(--color-accent-warm)]"
                    : "text-[var(--color-silver)] hover:bg-[var(--color-glass-highlight)] hover:text-[var(--color-starlight)]"
                }`}
                data-cursor-hover
              >
                <span className="mr-1 opacity-40">[{item.code}]</span>
                {item.label}
                {active === item.href && (
                  <motion.div
                    layoutId="eva-nav-indicator-dot"
                    className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--color-accent-warm)] shadow-[0_0_8px_var(--color-accent-warm)]"
                  />
                )}
              </a>
            ))}
          </div>
        </nav>

        {/* ── Utilities, pinned right ──────────────────────── */}
        <div className="relative z-50 flex shrink-0 items-center gap-2.5 overflow-visible">
          <div className="flex shrink-0 items-center overflow-visible">
            <ThemeToggle />
          </div>

          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-accent-primary)]/30 bg-[var(--color-glass-bg)] text-[var(--color-starlight)] backdrop-blur-md transition-transform duration-200 active:scale-95 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            data-cursor-hover
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="mt-2 px-3 sm:px-5 lg:hidden"
          >
            <div className="space-y-1 rounded-2xl border border-[var(--color-accent-primary)]/30 bg-[var(--color-void)]/95 p-4 shadow-2xl backdrop-blur-xl">
              {SECTIONS.map((item, i) => (
                <motion.a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNav(e, item.href)}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  className={`flex items-center justify-between rounded-xl px-4 py-2.5 font-mono text-xs transition-colors ${
                    active === item.href
                      ? "border-l-2 border-[var(--color-accent-warm)] bg-[var(--color-accent-primary)]/15 font-bold text-[var(--color-accent-warm)]"
                      : "border-l-2 border-transparent text-[var(--color-silver)] hover:bg-[var(--color-accent-primary)]/5 hover:text-[var(--color-starlight)]"
                  }`}
                >
                  <div>
                    <span className="mr-2 opacity-40">[{item.code}]</span>
                    <span>{item.label}</span>
                  </div>
                  {active === item.href && (
                    <span className="h-2 w-2 rounded-full bg-[var(--color-accent-warm)] shadow-[0_0_8px_var(--color-accent-warm)]" />
                  )}
                </motion.a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
