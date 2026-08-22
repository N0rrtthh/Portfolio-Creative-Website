"use client";

import { useState } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { GitCommit, WifiOff } from "lucide-react";
import ChapterLabel from "@/components/ui/ChapterLabel";
import RevealText from "@/components/ui/RevealText";

const YEARS = [2022, 2023, 2024, 2025, 2026];
const GITHUB_USERNAME = "N0rrtthh";

interface DayData {
  date: string;
  count: number;
  level: number; // -1 = padding cell, 0-4 = intensity
}

interface WeekData {
  contributionDays: DayData[];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

import staticDataRaw from "@/data/github-data.json";

const staticData = staticDataRaw as unknown as {
  source: string;
  error: string | null;
  years: Record<string, { totalContributions: number; weeks: WeekData[] }>;
};

/* One palette, both modes.
   The old version keyed every cell off Tailwind's `dark:` variant, which
   resolves from `prefers-color-scheme` — NOT from this site's own
   `data-mode` attribute. So the grid tracked the OS, not the toggle, and
   in light mode half of this section rendered white-on-white. Everything
   below is either a design token or a green that reads on both surfaces. */
const CELL_COLORS: Record<number, { border: string; bg: string; glow?: string }> = {
  0: { border: "border-[var(--color-glass-border)]", bg: "bg-[var(--color-graphite)]" },
  1: { border: "border-emerald-800/50", bg: "bg-emerald-900/70" },
  2: { border: "border-emerald-600/60", bg: "bg-emerald-700" },
  3: { border: "border-emerald-500/70", bg: "bg-emerald-500" },
  4: {
    border: "border-emerald-400",
    bg: "bg-emerald-400",
    glow: "shadow-[0_0_10px_rgba(16,185,129,0.45)]",
  },
};


function levelFor(level: number, count: number) {
  if (level === -1) return -1;
  if (count === 0 || level === 0) return 0;
  if (level === 1 || count < 4) return 1;
  if (level === 2 || count < 8) return 2;
  if (level === 3 || count < 14) return 3;
  return 4;
}

export default function GithubContributions() {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const [pinnedDay, setPinnedDay] = useState<DayData | null>(null);

  // Cursor-following tooltip position
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 300, damping: 30 });
  const springY = useSpring(mouseY, { stiffness: 300, damping: 30 });

  const error = staticData.error;
  const isLive = staticData.source === "build_graphql";
  const data = staticData.years[String(selectedYear)];

  const totalCommits = data?.totalContributions || 0;

  return (
    <motion.section
      id="github-activity"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative py-12 md:py-14 border-t border-[var(--color-glass-border)] bg-[var(--color-abyss)] overflow-hidden transition-colors duration-500"

    >
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/10 blur-[120px] rounded-full" />

      <div className="container-narrow relative z-10">
        <ChapterLabel index={3} classic="GitHub Activity Archive" eva="CONTRIBUTION MATRIX" className="mb-4" />


        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <RevealText as="h2" className="text-section-title font-display text-[var(--color-starlight)]">
              GitHub Commit History
            </RevealText>
            <p className="mt-2 text-sm text-[var(--color-silver)] max-w-xl">

              Real contribution activity fetched from{" "}
              <a
                href={`https://github.com/${GITHUB_USERNAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-500 font-bold font-mono underline hover:text-emerald-400 transition-colors"

              >
                @{GITHUB_USERNAME}
              </a>{" "}
              on GitHub.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isLive ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs font-mono"

              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live from GitHub
              </motion.div>
            ) : error ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono">
                <WifiOff className="w-3.5 h-3.5" />
                Connection Error
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-obsidian)]">

              {YEARS.map((year) => (
                <button
                  key={year}
                  onClick={() => {
                    setSelectedYear(year);
                    setPinnedDay(null);
                  }}
                  className="relative px-3 py-1.5 text-xs font-mono rounded-lg text-[var(--color-silver)] hover:text-[var(--color-starlight)] transition-colors cursor-pointer"
                >
                  {selectedYear === year && (
                    <motion.span
                      layoutId="year-pill"
                      className="absolute inset-0 rounded-lg bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className={`relative z-10 ${selectedYear === year ? "text-black font-bold" : ""}`}>{year}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Clean Animated Stat Counter */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2 mb-8 text-sm font-mono text-[var(--color-silver)]"
        >
          <GitCommit className="w-4 h-4 text-emerald-500" />
          <AnimatePresence mode="wait">
            <motion.span
              key={`${selectedYear}-${totalCommits}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="font-bold text-[var(--color-starlight)] text-base"
            >
              {totalCommits.toLocaleString()}
            </motion.span>
          </AnimatePresence>
          contributions in {selectedYear}
        </motion.div>

        {/* Contribution Heatmap Matrix Card with Entrance Scale Animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative p-4 sm:p-6 rounded-3xl border border-[var(--color-glass-border)] bg-[var(--color-obsidian)] backdrop-blur-xl min-h-[220px] flex flex-col justify-center"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            mouseX.set(e.clientX - rect.left);
            mouseY.set(e.clientY - rect.top);
          }}
        >
          <AnimatePresence mode="wait">
            {error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center p-8"
              >
                <WifiOff className="w-10 h-10 text-red-500/50 mb-3" />
                <p className="text-red-400 font-mono text-sm">{error}</p>
                <p className="text-[var(--color-ash)] text-xs mt-2 max-w-sm">
                  The GitHub API is currently unreachable or rate-limited. Please try again later or provide a personal access token.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={selectedYear}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-emerald-500/20"
              >
                {/* Floating tooltip that follows cursor */}
                <AnimatePresence>
                  {hoveredDay && hoveredDay.level !== -1 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.12 }}
                      style={{ left: springX, top: springY }}
                      className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-[calc(100%+10px)] px-3 py-1.5 rounded-lg bg-[var(--color-starlight)] text-[var(--color-void)] text-[11px] font-mono whitespace-nowrap shadow-xl"
                    >
                      <span className="font-bold">{hoveredDay.count}</span>{" "}
                      contribution{hoveredDay.count === 1 ? "" : "s"} ·{" "}
                      {new Date(hoveredDay.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex text-[10px] font-mono text-[var(--color-ash)] mb-2 pl-8 min-w-[760px] justify-between">
                  {MONTH_LABELS.map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </div>

                <div className="flex items-start gap-3 min-w-[760px]">
                  <div className="flex flex-col justify-between text-[9px] font-mono text-[var(--color-ash)] h-[105px] pt-1">
                    <span>Mon</span>
                    <span>Wed</span>
                    <span>Fri</span>
                  </div>

                  <div className="grid grid-flow-col gap-1.5 flex-1">
                    {data?.weeks.map((week, wIdx) => (
                      <div key={wIdx} className="grid grid-rows-7 gap-1.5">
                        {week.contributionDays.map((day, dIdx) => {
                          const lvl = levelFor(day.level, day.count);
                          const style = lvl === -1 ? null : CELL_COLORS[lvl];
                          const isPinned = pinnedDay?.date === day.date;
                          return (
                            <motion.div
                              key={`${wIdx}-${dIdx}`}
                              whileHover={lvl !== -1 ? { scale: 1.4, zIndex: 20 } : undefined}
                              whileTap={lvl !== -1 ? { scale: 1.15 } : undefined}
                              onMouseEnter={() => lvl !== -1 && setHoveredDay(day)}
                              onMouseLeave={() => setHoveredDay(null)}
                              onClick={() => lvl !== -1 && setPinnedDay(isPinned ? null : day)}
                              className={`h-3 w-3 rounded-[3px] border transition-colors cursor-pointer ${
                                lvl === -1
                                  ? "opacity-0 pointer-events-none"
                                  : `${style?.border} ${style?.bg} ${style?.glow ?? ""} ${
                                      isPinned ? "ring-2 ring-emerald-400 ring-offset-1 ring-offset-[var(--color-obsidian)]" : ""
                                    }`
                              }`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.section>
  );
}