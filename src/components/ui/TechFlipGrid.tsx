"use client";

import { memo, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { TECH_STACK, type TechItem } from "@/lib/data";
import { categoryColor } from "@/lib/techMeta";
import TechMark from "@/components/ui/TechMark";
import { useReducedMotionPref, useCoarsePointer } from "@/lib/hooks/useClientFlag";

/**
 * Tech arsenal as two counter-scrolling conveyors of 3D flip cards.
 *
 *  - The whole strip drifts continuously (row A left, row B right).
 *  - Hovering the strip pauses the conveyor (CSS `group:hover`).
 *  - Hovering (or keyboard-focusing) a card flips it in 3D to reveal a
 *    quick dossier, and every OTHER card smoothly dims + recedes so the
 *    focused tile commands attention. Uses GPU-composited opacity/scale only
 *    (no `filter: blur()`) so it stays smooth while the marquee scrolls.
 *  - Touch has no hover, so there is no pause and no flip: tapping a card
 *    pauses its row and flips it; tapping it again (or another card)
 *    resumes/swaps. Scrolling never flips — browsers suppress `click`
 *    after a drag, and flip state only changes on `click` for touch.
 *  - Category tabs filter the conveyors.
 *  - Reduced-motion users get a static grid that shows everything at once.
 */

/* Smooth, critically-damped flip — no spring overshoot, so the card never
   wobbles or re-triggers while the pointer sits on its edge. */
const FLIP_TRANSITION = { duration: 0.55, ease: [0.32, 0.72, 0, 1] } as const;

/* Gentle deceleration used for the dim/recede fade — no overshoot. */
const EASE = [0.22, 1, 0.36, 1] as const;

/* ─── One 3D flip card ───────────────────────────────────── */
const FlipCard = memo(function FlipCard({
  tech,
  instanceId,
  isActive,
  isDimmed,
  onActivate,
  onDeactivate,
  touch,
}: {
  tech: TechItem;
  /** Unique per rendered copy (the marquee duplicates each card). */
  instanceId: string;
  /** Touch-first device: flip on tap instead of hover. */
  touch: boolean;
  /** This card is hovered/focused → flip it. */
  isActive: boolean;
  /** A different card is active → dim + recede this one. */
  isDimmed: boolean;
  onActivate: (id: string) => void;
  onDeactivate: (id: string) => void;
}) {
  const color = categoryColor(tech.category);

  /* 3D only while it is needed. A resting card is a flat 2D tile; the
     perspective / preserve-3d / backface stack (four compositor layers per
     card, ~160 across both belts) switches on the moment the card activates
     and drops again once the flip back to 0° has finished. Visually
     identical — a card at 0° only ever shows its front — but the belts no
     longer drag 160 3D layers through every frame. */
  const [settling, setSettling] = useState(false);
  const deep = isActive || settling;

  const handlePointerEnter = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") onActivate(instanceId);
    },
    [onActivate, instanceId]
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") onDeactivate(instanceId);
    },
    [onDeactivate, instanceId]
  );

  /* Touch: a tap is a toggle. Uses `click` (not `pointerdown`) on purpose —
     the browser only fires `click` for stationary taps, never after a
     scroll-drag, so flicking the conveyor never flips a card mid-gesture. */
  const handleTap = useCallback(() => {
    if (!touch) return;
    if (isActive) onDeactivate(instanceId);
    else onActivate(instanceId);
  }, [touch, isActive, onActivate, onDeactivate, instanceId]);

  /* The OUTER wrapper is the stable hit-area: it never rotates on hover, so
     the pointer can't "fall off" a moving card and re-trigger the flip.

     PERFORMANCE: the focus/dim effect animates ONLY `opacity` and `scale`
     (transform + opacity are GPU-composited → zero repaint). We deliberately
     avoid `filter: blur()` here: blurring ~80 cards simultaneously forces an
     expensive per-frame repaint of every card and was the source of the lag.
     The active card pops slightly (scale 1.04) while the rest dim + shrink,
     which reads as the same "everything recedes" focus effect, smoothly. */
  return (
    <motion.div
      tabIndex={0}
      aria-label={`${tech.name} — ${tech.category}.`}
      data-cursor-hover
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={handleTap}
      onFocus={() => onActivate(instanceId)}
      onBlur={() => onDeactivate(instanceId)}
      animate={{
        opacity: isDimmed ? 0.22 : 1,
        scale: isDimmed ? 0.94 : isActive ? 1.04 : 1,
      }}
      transition={{ duration: 0.35, ease: EASE }}
      className={`relative h-52 w-44 shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-2xl sm:w-48 ${deep ? "[perspective:1100px]" : ""}`}
    >
      {/* Rotating inner — flip only. */}
      <motion.div
        animate={{ rotateY: isActive ? 180 : 0 }}
        transition={FLIP_TRANSITION}
        onAnimationStart={() => setSettling(true)}
        onAnimationComplete={() => {
          if (!isActive) setSettling(false);
        }}
        className={`relative h-full w-full ${deep ? "[transform-style:preserve-3d]" : ""}`}
      >
        {/* ── FRONT — identity ─────────────────────────────── */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-[var(--color-glass-border)] px-4 ${deep ? "[backface-visibility:hidden]" : ""}`}
          style={{
            background: `linear-gradient(165deg, ${color}1c, rgba(255,255,255,0.03) 55%, rgba(255,255,255,0.015))`,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div
            className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-25 blur-2xl"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          <TechMark tech={tech} size={52} />
          <span className="max-w-full truncate font-mono text-xs font-bold uppercase tracking-wide text-[var(--color-starlight)]">
            {tech.name}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-[var(--color-ash)]">
            <span
              className="inline-block h-1 w-1 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            {tech.category}
          </span>
          <span className="absolute bottom-2.5 font-mono text-[8px] uppercase tracking-widest text-[var(--color-ash)] opacity-50">
            {touch ? "tap to peek" : "hover to peek"}
          </span>
        </div>

        {/* ── BACK — dossier (mounted only while the card is 3D) ── */}
        {deep && (
        <div
          className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl border p-4 [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{
            borderColor: `${color}55`,
            background: `linear-gradient(165deg, ${color}22, rgba(10,10,20,0.97) 45%, rgba(10,10,20,0.99))`,
            boxShadow: `0 0 32px ${color}22, 0 16px 40px rgba(0,0,0,0.55)`,
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="truncate font-display text-sm font-bold text-white">
              {tech.name}
            </span>
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
          </div>

          <p className="my-auto font-body text-[11px] leading-relaxed text-[var(--color-silver)]">
            {tech.note}
          </p>
        </div>
        )}
      </motion.div>
    </motion.div>
  );
});

/* ─── Static card for reduced-motion users ───────────────── */
function StaticCard({ tech }: { tech: TechItem }) {
  const color = categoryColor(tech.category);

  return (
    <div
      data-cursor-hover
      className="flex h-auto min-h-44 flex-col overflow-hidden rounded-2xl border border-[var(--color-glass-border)] p-4"
      style={{
        background: `linear-gradient(165deg, ${color}1c, rgba(255,255,255,0.03) 55%, rgba(255,255,255,0.015))`,
      }}
    >
      <div className="mb-3 flex items-center gap-3">
        <TechMark tech={tech} size={40} />
        <div className="min-w-0">
          <p className="truncate font-mono text-xs font-bold uppercase tracking-wide text-[var(--color-starlight)]">
            {tech.name}
          </p>
          <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-[var(--color-ash)]">
            <span
              className="inline-block h-1 w-1 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            {tech.category}
          </span>
        </div>
      </div>
      <p className="mt-auto font-body text-[11px] leading-relaxed text-[var(--color-silver)]">
        {tech.note}
      </p>
    </div>
  );
}

/* ─── One conveyor row ───────────────────────────────────── */
function ConveyorRow({
  items,
  reverse,
  activeId,
  onActivate,
  onDeactivate,
  touch,
  paused,
}: {
  items: TechItem[];
  reverse: boolean;
  activeId: string | null;
  onActivate: (id: string) => void;
  onDeactivate: (id: string) => void;
  touch: boolean;
  /** A card somewhere is flipped → freeze the belt so the flipped target
   *  stays under the finger (touch has no hover-pause to do this). */
  paused: boolean;
}) {
  // Keep linear speed roughly constant regardless of how many cards are shown.
  const duration = Math.max(18, items.length * 4);

  // Two identical halves + translateX(±50%) = seamless loop. Each half owns
  // its trailing gap (pr-4) so the seam spacing matches the in-row spacing.
  // Each rendered copy gets a unique instanceId so only the exact card under
  // the pointer flips — its off-screen duplicate stays put.
  const half = (hidden: boolean) => (
    <div
      className="flex shrink-0 gap-4 pr-4"
      aria-hidden={hidden || undefined}
    >
      {items.map((tech) => {
        const instanceId = `${tech.name}${hidden ? "-dup" : ""}`;
        return (
          <FlipCard
            key={instanceId}
            tech={tech}
            instanceId={instanceId}
            isActive={activeId === instanceId}
            isDimmed={activeId !== null && activeId !== instanceId}
            onActivate={onActivate}
            onDeactivate={onDeactivate}
            touch={touch}
          />
        );
      })}
    </div>
  );

  return (
    <div
      /* `overflow-hidden` clips the marquee horizontally, but it would also
         clip the active card's 1.04 scale (and focus ring) top and bottom.
         The vertical padding gives the scaled card room inside the clip
         region so it never gets cut off when it flips/pops. */
      className="group relative overflow-hidden py-3"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 7%, black 93%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 7%, black 93%, transparent)",
      }}
    >
      <div
        className={`flex w-max ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}
        style={{
          animationDuration: `${duration}s`,
          // Inline play-state would override (and kill) the CSS `.group:hover`
          // pause, so it is only set when a flip actually needs the freeze.
          ...(paused ? { animationPlayState: "paused" as const } : null),
        }}
      >
        {half(false)}
        {half(true)}
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */
export default function TechFlipGrid() {
  const reduced = useReducedMotionPref();
  const touch = useCoarsePointer();
  const [activeCategory, setActiveCategory] = useState("All");

  // instanceId of the card currently flipped (hovered/focused), or null.
  const [activeId, setActiveId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      activeCategory === "All"
        ? TECH_STACK
        : TECH_STACK.filter((t) => t.category === activeCategory),
    [activeCategory]
  );

  // Split into two counter-scrolling rows for layered, parallax-like motion.
  const rowA = useMemo(() => filtered.filter((_, i) => i % 2 === 0), [filtered]);
  const rowB = useMemo(() => filtered.filter((_, i) => i % 2 === 1), [filtered]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(TECH_STACK.map((t) => t.category)))],
    []
  );

  const handleActivate = useCallback((id: string) => setActiveId(id), []);

  // Only clear if this card is still the active one — avoids a race where the
  // next card's enter fires before the previous card's leave.
  const handleDeactivate = useCallback((id: string) => {
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  // Clear any flipped card when the category changes so a stale id never
  // points at a card that no longer exists in the new filtered list.
  const handleCategory = useCallback((cat: string) => {
    setActiveCategory(cat);
    setActiveId(null);
  }, []);

  return (
    <div className="relative select-none">
      {/* Category filter tabs */}
      <div className="mb-8 flex flex-wrap gap-2.5 justify-center">
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          const color = categoryColor(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategory(cat)}
              className={`relative rounded-full px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors duration-300 cursor-pointer ${
                isActive
                  ? "text-white"
                  : "text-[var(--color-silver)] hover:text-[var(--color-starlight)] border border-[var(--color-glass-border)] bg-white/[0.02] hover:bg-white/[0.06]"
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: color,
                      boxShadow: `0 4px 24px ${color}50, 0 0 0 1px ${color}30`,
                    }
                  : undefined
              }
              data-cursor-hover
              aria-pressed={isActive}
            >
              {cat}
              {cat !== "All" && (
                <span className="ml-1.5 opacity-60">
                  {TECH_STACK.filter((t) => t.category === cat).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {reduced ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((tech) => (
            <StaticCard key={tech.name} tech={tech} />
          ))}
        </div>
      ) : (
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-4"
          role="region"
          aria-label="Technology showcase. The cards scroll continuously; hover or tap a card to pause and flip it, which dims the rest out."
        >
          <ConveyorRow
            items={rowA}
            reverse={false}
            activeId={activeId}
            onActivate={handleActivate}
            onDeactivate={handleDeactivate}
            touch={touch}
            paused={activeId !== null}
          />
          {rowB.length > 0 && (
            <ConveyorRow
              items={rowB}
              reverse
              activeId={activeId}
              onActivate={handleActivate}
              onDeactivate={handleDeactivate}
              touch={touch}
              paused={activeId !== null}
            />
          )}
        </motion.div>
      )}

      <p className="mt-8 text-center font-display text-sm italic text-[var(--color-silver)]">
        ...and many more.
      </p>
    </div>
  );
}