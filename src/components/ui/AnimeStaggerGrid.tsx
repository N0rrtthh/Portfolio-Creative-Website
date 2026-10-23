"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { getAdaptiveQuality, observeVisibility } from "@/lib/performance";

interface AnimeStaggerGridProps {
  rows?: number;
  columns?: number;
  className?: string;
}

/* Same choreography the anime.js version ran — a ripple out from the
   centre: each dot shrinks to 0.2 and lifts 12px (500ms, easeOutSine),
   then settles back (1200ms, easeInOutQuad), alternating forever, with a
   60ms-per-cell stagger measured from the grid centre.

   It now lives in CSS keyframes (`stagger-dot-move` / `stagger-dot-fade`
   in globals.css). The JS loop wrote transform + opacity on every dot on
   every frame — up to 72 style writes per frame on the main thread, in
   the hero, for the whole visit. CSS transform/opacity animations run on
   the compositor and cost the main thread nothing. */
const STAGGER_MS = 60;

/**
 * Ambient dot grid. Loops only while visible; density scales with device tier
 * after mount (avoids SSR/client hydration mismatch).
 */
export default function AnimeStaggerGrid({
  rows = 8,
  columns = 16,
  className = "",
}: AnimeStaggerGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  // Start with medium density for stable hydration, then adapt client-side
  const [dims, setDims] = useState({ rows: Math.min(rows, 6), cols: Math.min(columns, 10) });
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const q = getAdaptiveQuality();
    const id = requestAnimationFrame(() => {
      setDims({
        rows:
          q.tier === "low" ? Math.min(rows, 4) : q.tier === "medium" ? Math.min(rows, 6) : rows,
        cols:
          q.tier === "low"
            ? Math.min(columns, 8)
            : q.tier === "medium"
              ? Math.min(columns, 10)
              : columns,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [rows, columns]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    return observeVisibility(el, setRunning, "10% 0px");
  }, []);

  const total = dims.rows * dims.cols;
  const cx = (dims.cols - 1) / 2;
  const cy = (dims.rows - 1) / 2;

  return (
    <div
      ref={gridRef}
      className={`grid gap-2 ${className}`}
      style={{
        gridTemplateColumns: `repeat(${dims.cols}, 1fr)`,
        gridTemplateRows: `repeat(${dims.rows}, 1fr)`,
      }}
      aria-hidden="true"
    >
      {Array.from({ length: total }, (_, i) => {
        const x = i % dims.cols;
        const y = Math.floor(i / dims.cols);
        const delay = Math.round(Math.hypot(x - cx, y - cy) * STAGGER_MS);
        const style: CSSProperties = {
          animationDelay: `${delay}ms, ${delay}ms`,
          animationPlayState: running ? "running" : "paused",
        };
        return (
          <div
            key={i}
            className="stagger-dot h-1.5 w-1.5 rounded-full bg-[var(--color-accent-primary)] opacity-30"
            style={style}
          />
        );
      })}
    </div>
  );
}
