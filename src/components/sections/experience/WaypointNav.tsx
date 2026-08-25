"use client";

import { memo } from "react";
import { TIMELINE_DATA } from "@/data/experience";

/** Right-edge waypoint rail — jumps the scroll position to a node. */
const WaypointNav = memo(function WaypointNav({
  activeNode,
  onSelect,
}: {
  activeNode: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav
      aria-label="Experience timeline waypoints"
      className="pointer-events-auto absolute right-6 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-4 md:right-12"
    >
      {TIMELINE_DATA.map((item, idx) => {
        const isActive = activeNode === idx;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(idx)}
            title={`Go to ${item.company}`}
            aria-current={isActive ? "true" : undefined}
            className={`group flex cursor-pointer items-center justify-end gap-3 text-left transition-[transform,opacity] duration-[250ms] ease-out will-change-transform ${
              isActive ? "scale-110 opacity-100" : "opacity-40 hover:opacity-90"
            }`}
          >
            <span
              className={`hidden font-mono text-[11px] font-bold uppercase tracking-widest transition-colors md:inline ${
                isActive
                  ? "text-[var(--color-accent-warm)]"
                  : "text-white/50 group-hover:text-white"
              }`}
            >
              {item.company}
            </span>
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full border transition-[border-color,background-color,box-shadow] duration-[250ms] ease-out ${
                isActive
                  ? "border-white/60 bg-[var(--color-accent-primary)] shadow-[0_0_12px_var(--color-accent-glow)]"
                  : "border-white/20 bg-white/5 group-hover:border-white/50"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isActive ? "bg-white" : "bg-transparent"
                }`}
              />
            </span>
          </button>
        );
      })}
    </nav>
  );
});

export default WaypointNav;
