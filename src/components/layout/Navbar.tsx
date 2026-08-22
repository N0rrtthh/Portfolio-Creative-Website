"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useSectionNav } from "@/lib/hooks/useSectionNav";
import { useActiveSection, useMenuDismiss } from "@/lib/hooks/useActiveSection";

/* Mirrors the running order in ClassicLayout. The intro act (About, GitHub
   archive, Tech Stack) is treated as one block, so only About gets a nav
   entry — Commits and Skills are reached by scrolling through About. */
const NAV_ITEMS = [
  { label: "About", href: "#about" },
  { label: "Certifications", href: "#certifications" },
  { label: "Projects", href: "#projects" },
  { label: "Experience", href: "#experience" },
  { label: "Contact", href: "#contact" },
];

const ALL_SECTIONS = [
  { label: "Home", href: "#hero" },
  ...NAV_ITEMS,
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { scrollToId } = useSectionNav();

  /* Active section, the scrolled flag and the click lock all come from one
     shared hook — see lib/hooks/useActiveSection for why per-section
     observers were replaced by a single reading line. EVA's navbar uses the
     same hook, so the two can't drift apart again. */
  const hrefs = useMemo(() => ALL_SECTIONS.map((s) => s.href), []);
  const { active: activeSection, scrolled, lockTo } = useActiveSection(hrefs);

  const closeMenu = useCallback(() => setOpen(false), []);
  useMenuDismiss(open, closeMenu);

  /* Single nav code path — see lib/hooks/useSectionNav. */
  function handleNavClick(e: React.MouseEvent, href: string) {
    e.preventDefault();
    setOpen(false);
    // Takes the highlight now and holds it until the scroll lands, so the
    // pill doesn't flicker through every section on the way.
    lockTo(href);
    scrollToId(href);
  }

  return (
    /* Three lanes, not one pill.
       The brand sits hard left and the theme toggle hard right, both OUTSIDE
       the nav surface; only the section links live in the floating pill,
       centred. That's why this uses full-bleed padding instead of
       `container-narrow` — the two utilities are meant to touch the screen
       edges. Every colour here is a token: the old `text-white` /
       `text-slate-300` pair was invisible against light mode. */
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[padding] duration-500 ease-out ${
        scrolled ? "py-2.5" : "py-4"
      }`}
      style={{ transitionTimingFunction: "var(--ease-cinematic)" }}
    >
      <div className="flex items-center gap-3 px-3 sm:px-5 lg:px-8">
        {/* ── Brand, pinned left ───────────────────────────── */}
        <a
          href="#hero"
          onClick={(e) => handleNavClick(e, "#hero")}
          className="flex items-center gap-3 group shrink-0"
          aria-label="Nrth. — Home"
          data-cursor-hover
        >
          <motion.div
            whileHover={{ scale: 1.1, rotate: 4 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            /* Borderless: the mark now reads as a lit glyph rather than a
               chip. The glow is kept and moved onto the image itself, so
               there is no box edge left behind once the border is gone. */
            className="flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-2xl overflow-hidden p-1.5"
          >
            <Image
              src={`${process.env.NODE_ENV === "production" ? "/Portfolio-Website" : ""}/Favicon.png`}
              alt=""
              width={44}
              height={44}
              aria-hidden
              priority
              className="h-full w-full object-contain filter drop-shadow-[0_0_10px_rgba(67,97,238,0.75)] transition-[filter] duration-200 group-hover:drop-shadow-[0_0_18px_rgba(67,97,238,0.95)]"
            />
          </motion.div>
          <span className="font-sans text-lg sm:text-2xl font-extrabold tracking-tight text-[var(--color-starlight)] group-hover:text-[var(--color-accent-primary)] transition-colors">
            Nrth.
          </span>
        </a>

        {/* ── Section links, centred pill ──────────────────── */}
        <nav className="flex-1 flex justify-center min-w-0">
          <div
            /* `backdrop-filter` is deliberately NOT in the transition list:
               it is not smoothly animatable, and tweening it while crossing
               the 40px scroll threshold repainted the whole pill every frame
               — the visible "glitching" navbar. Background/border/shadow
               still ease; the blur snaps on, which reads as instant. */
            className={`hidden md:flex items-center gap-1 rounded-full px-3 py-2 transition-[background-color,border-color,box-shadow] duration-500 ease-out ${
              scrolled
                ? "glass-heavy shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
                : "bg-transparent border border-transparent"
            }`}
            style={{ transitionTimingFunction: "var(--ease-cinematic)" }}
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={`relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-200 ${
                    isActive
                      ? "text-[var(--color-starlight)] font-semibold bg-[var(--color-glass-highlight)] border border-[var(--color-glass-border)]"
                      : "text-[var(--color-silver)] hover:text-[var(--color-starlight)] hover:bg-[var(--color-glass-highlight)]"
                  }`}
                  data-cursor-hover
                >
                  <span className="relative z-10">{item.label}</span>

                  {isActive && (
                    <motion.div
                      layoutId="classic-nav-indicator-dot"
                      className="absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--color-accent-primary)] shadow-[0_0_8px_var(--color-accent-primary)]"
                      transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    />
                  )}
                </a>
              );
            })}
          </div>
        </nav>

        {/* ── Utilities, pinned right ──────────────────────── */}
        <div className="flex items-center gap-2.5 shrink-0">
          <ThemeToggle />

          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            aria-controls="classic-mobile-nav"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] text-[var(--color-starlight)] backdrop-blur-md transition-transform duration-200 active:scale-95 md:hidden"
            data-cursor-hover
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile nav modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mt-2 px-3 sm:px-5 md:hidden"
          >
            <div
              id="classic-mobile-nav"
              className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-void)]/95 p-4 backdrop-blur-2xl shadow-2xl space-y-1"
            >
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeSection === item.href
                      ? "bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] font-bold"
                      : "text-[var(--color-silver)] hover:bg-[var(--color-glass-bg)] hover:text-[var(--color-starlight)]"
                  }`}
                >
                  <span>{item.label}</span>
                  {activeSection === item.href && (
                    <span className="h-2 w-2 rounded-full bg-[var(--color-accent-primary)] shadow-[0_0_6px_var(--color-accent-primary)]" />
                  )}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
