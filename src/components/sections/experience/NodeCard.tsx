"use client";

import { memo } from "react";
import type { TimelineEntry } from "@/types/experience";

/**
 * Detail card for the active timeline node.
 *
 * Lives in normal DOM (positioned by TimelineScene via a transform on its host
 * wrapper) rather than inside drei's <Html>. That keeps the text on the regular
 * paint path and avoids the per-frame layout read + matrix3d write that <Html>
 * performs, which was the main source of scroll stutter in this section.
 *
 * Design: deliberately minimalist. One hairline ring, one dark glass surface,
 * and a typography-first hierarchy — no glowing borders, badge pills or icon
 * boxes. The only colour is the theme accent (via design tokens), so the card
 * follows whichever theme the site is wearing while the scene behind it stays
 * dark.
 */
const NodeCard = memo(function NodeCard({
  item,
  onInspect,
}: {
  item: TimelineEntry;
  onInspect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onInspect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onInspect();
        }
      }}
      aria-label={`${item.role} at ${item.company} — view details`}
      /* Width, not font size, does the heavy lifting here. The card sits
         dead-centre of the viewport, so `min(92vw, …)` lets it grow into
         the space it actually has and still fit a 360px phone. */
      className="group/card relative w-[min(92vw,22rem)] cursor-pointer rounded-2xl border border-white/10 bg-[#0b0c14]/85 p-6 text-left backdrop-blur-xl transition-colors duration-300 outline-none hover:border-white/25 focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/70 sm:w-[min(90vw,26rem)] sm:p-7 md:w-[min(80vw,30rem)] lg:w-[32rem]"
    >
      {/* Index — one quiet line */}
      <span className="mb-5 block font-mono text-[11px] font-bold tracking-[0.35em] text-[var(--color-accent-primary)]">
        {item.number}
      </span>

      {/* Role + company — the headline pair */}
      <h3 className="font-brand text-xl font-bold leading-snug text-white lg:text-[1.55rem]">
        {item.role}
      </h3>
      <p className="mt-1 font-mono text-xs font-semibold tracking-wider text-[var(--color-accent-warm)]">
        {item.company}
      </p>

      {/* Meta — one line, hairline separator */}
      <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-white/45">
        <span>{item.period}</span>
        <span className="h-3 w-px bg-white/15" aria-hidden="true" />
        <span>{item.location}</span>
      </div>

      <p className="mt-4 line-clamp-3 font-body text-sm leading-relaxed text-white/65">
        {item.description}
      </p>

      {/* Footer — tech as plain text + a quiet open affordance */}
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
        <p className="min-w-0 truncate font-mono text-[10px] tracking-wide text-white/40">
          {item.tech.slice(0, 4).join(" · ")}
        </p>
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/55 transition-colors duration-200 group-hover/card:text-[var(--color-accent-warm)]">
          Open
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover/card:translate-x-0.5"
          >
            →
          </span>
        </span>
      </div>
    </div>
  );
});

export default NodeCard;
