import type { ComponentType } from "react";

/** Minimal icon contract — keeps data modules decoupled from lucide's internals. */
export type TimelineIcon = ComponentType<{
  size?: number | string;
  className?: string;
}>;

export interface TimelineEntry {
  id: string;
  /** Zero-padded display index, e.g. "01". */
  number: string;
  role: string;
  company: string;
  period: string;
  location: string;
  description: string;
  highlights: string[];
  tech: string[];
  /** Heading over `tech` in the dossier — "Stack" unless the entry is not a build. */
  techLabel?: string;
  icon: TimelineIcon;
  /** Labelled facts shown in the dossier's definition list. */
  details: { label: string; value: string }[];
  /** Normalized position (0–1) of this node along the flight path / scroll range. */
  scrollTarget: number;
}
