"use client";

import { memo, useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { TimelineEntry } from "@/types/experience";

/**
 * Experience detail modal. Mirrors the Projects modal structure: pinned
 * header, design-token styling, and an inner `.scroll-panel` body carrying
 * `data-lenis-prevent` so wheel input that starts inside the panel scrolls
 * the panel instead of being hijacked by Lenis. Mounted only while open
 * (via AnimatePresence in the parent), so none of this markup exists in the
 * DOM during normal scrolling.
 */
const DossierModal = memo(function DossierModal({
  item,
  onClose,
}: {
  item: TimelineEntry;
  onClose: () => void;
}) {
  // Escape to dismiss
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const Icon = item.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClose}
      role="dialog"

      aria-modal="true"
      aria-label={`${item.role} at ${item.company}`}
      className="pointer-events-auto fixed inset-0 z-[99999] flex items-center justify-center bg-[var(--color-void)]/80 p-4 backdrop-blur-md sm:p-6"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        /* The panel itself never scrolls — it is a flex column with a pinned
           header and an inner `.scroll-panel` body (below), the same shape
           as the Projects modal. `data-lenis-prevent` on that body keeps
           Lenis from hijacking wheel events that start inside the panel. */
        className="relative flex max-h-[88svh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-obsidian)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      >
        {/* Header — identity + close, pinned above the scroll area */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-glass-border)] px-6 pb-5 pt-6 sm:px-8">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] text-[var(--color-accent-primary)]">
              <Icon size={22} />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-ash)]">
                {item.period} · {item.location}
              </p>
              <h3 className="mt-1.5 font-display text-2xl font-bold leading-tight text-[var(--color-starlight)] sm:text-3xl">
                {item.role}
              </h3>
              <p className="mt-1 font-body text-sm text-[var(--color-silver)]">
                {item.company}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close experience details"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--color-glass-border)] text-[var(--color-silver)] transition-colors hover:border-[var(--color-accent-primary)] hover:text-[var(--color-starlight)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body — `data-lenis-prevent` keeps Lenis from hijacking
            wheel events that start inside the panel; `.scroll-panel` adds
            overflow, overscroll containment and iOS momentum scrolling. */}
        <div
          data-lenis-prevent
          className="scroll-panel min-h-0 flex-1 px-6 py-6 sm:px-8"
        >
          {/* Overview */}
          <p className="font-body text-sm leading-relaxed text-[var(--color-pearl)] sm:text-base">
            {item.description}
          </p>

          {/* Highlights */}
          <div className="mt-7">
            <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-ash)]">
              Highlights
            </p>
            <ul className="grid gap-2.5">
              {item.highlights.map((h) => (
                <li key={h} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent-primary)]"
                  />
                  <span className="font-body text-sm leading-relaxed text-[var(--color-silver)]">
                    {h}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Labelled facts — same definition-list pattern as the
              Projects modal's Problem / Solution / Outcome block. */}
          <dl className="mt-7 divide-y divide-[var(--color-glass-border)] border-y border-[var(--color-glass-border)]">
            {item.details.map(({ label, value: text }) => (
              <div
                key={label}
                className="grid grid-cols-[5.5rem_1fr] gap-4 py-3.5 sm:grid-cols-[7rem_1fr]"
              >
                <dt className="pt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-ash)]">
                  {label}
                </dt>
                <dd className="font-body text-sm leading-relaxed text-[var(--color-silver)]">
                  {text}
                </dd>
              </div>
            ))}
          </dl>

          {/* Stack */}
          <div className="mt-7 pb-1">
            <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-ash)]">
              {item.techLabel ?? "Stack"}
            </p>
            <div className="flex flex-wrap gap-2">
              {item.tech.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] px-2.5 py-1 font-mono text-[11px] text-[var(--color-silver)]"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});

export default DossierModal;
