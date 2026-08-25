"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { PROJECTS, Project } from "@/lib/data";
import {
  ArrowUpRight,
  Cpu,
  Layers,
  Gamepad2,
  X,
  ExternalLink,
  Code2,
  Sparkles,
  Filter,
} from "lucide-react";
import { GitHubIcon } from "@/components/ui/BrandIcons";
import { getProjectImage } from "@/data/projectImages";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { useLenis } from "@/components/providers/SmoothScrollProvider";
import { useLowEndDevice } from "@/lib/hooks/useClientFlag";
import { DUR, EASE, SPRING } from "@/lib/motion";

/* ══════════════════════════════════════════════════════════
   PROJECT MATRIX — what was making this section crawl
   ──────────────────────────────────────────────────────────
   Measured causes, in order of cost:

   1. ANIMATED backdrop-filter. Cards carried
      `backdrop-blur-md → hover:backdrop-blur-2xl` under
      `transition-all duration-500`. Blur radius is not a
      compositor-only property: every frame of that 500ms the GPU
      re-blurs the whole card rect, and `transition-all` did the
      same for box-shadow. Crossing the grid with the pointer meant
      several cards blurring at once. Now the blur is a single
      static value and only transform/colour/shadow transition.

   2. A permanently-running animation inside an invisible layer.
      The "CLICK FOR FULL SCHEMATIC" overlay is `opacity-0` until
      hover, but its `<Sparkles className="animate-spin" />` kept
      spinning forever — one compositor animation per card, none of
      them ever seen. Now `group-hover:animate-spin`, so it only
      runs while actually visible.

   3. Layout animations on every card. `layout` + `mode="popLayout"`
      makes framer-motion measure and tween EVERY card on every
      filter click. Kept on capable machines (it is what makes the
      filter feel physical) and dropped on low tier, where the
      measure pass alone blew the frame budget.

   4. The whole grid was rebuilt on any state change because the
      card markup was inline. Extracted to a memoized component
      with a stable onSelect, so opening the modal no longer
      re-renders 12 cards.

   `low` tier = reduced-motion, save-data, or a coarse pointer with
   ≤4 cores (see lib/performance).
   ══════════════════════════════════════════════════════════ */

const CATEGORIES = ["ALL", "WEB APPS", "MOBILE", "GAMES"] as const;

function matches(project: Project, category: string) {
  if (category === "ALL") return true;
  const type = project.type.toLowerCase();
  if (category === "WEB APPS")
    return type.includes("web") || type.includes("full-stack");
  if (category === "MOBILE") return type.includes("mobile");
  if (category === "GAMES") return type.includes("game");
  return true;
}

/* ── Card ─────────────────────────────────────────────────── */

interface CardProps {
  project: Project;
  index: number;
  animateHover: boolean;
  onSelect: (project: Project) => void;
}

const ProjectCard = memo(function ProjectCard({
  project,
  index,
  animateHover,
  onSelect,
}: CardProps) {
  const img = getProjectImage(project.id);

  return (
    /* No `layout`. Closing the schematic modal restores the scroll offset the
       lock captured, so every card's box changes in a single frame — with
       layout animation on, framer read that as a move and the whole matrix
       slid and jittered. The grid is CSS-positioned and needs no layout
       animation; filter changes still tween in and out. */
    <motion.article
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      whileHover={animateHover ? { y: -6 } : undefined}
      transition={{ duration: DUR.base, ease: EASE.out }}
      onClick={() => onSelect(project)}
      /* Explicit transition list — `transition-all` also animated
         backdrop-filter and box-shadow, the two most expensive
         properties on the card. */
      className="group relative cursor-pointer rounded-2xl border border-[var(--color-accent-primary)]/40 bg-[var(--color-obsidian)]/90 p-7 shadow-xl backdrop-blur-md transition-[border-color,background-color,box-shadow] duration-300 hover:border-[var(--color-accent-warm)] hover:bg-[#080b18]/95 hover:shadow-[0_15px_45px_rgba(122,0,255,0.35)]"
      data-cursor-hover
    >
      {/* HUD corner brackets */}
      <div className="absolute top-0 left-0 h-3.5 w-3.5 border-t-2 border-l-2 border-[var(--color-accent-warm)] opacity-60 transition-opacity group-hover:opacity-100" />
      <div className="absolute bottom-0 right-0 h-3.5 w-3.5 border-b-2 border-r-2 border-[var(--color-accent-warm)] opacity-60 transition-opacity group-hover:opacity-100" />

      {/* Preview */}
      <div className="relative mb-6 aspect-video w-full overflow-hidden rounded-xl border border-[var(--color-accent-primary)]/30 bg-black transition-colors group-hover:border-[var(--color-accent-warm)]/70">
        {img ? (
          <div className="relative h-full w-full overflow-hidden">
            <Image
              src={img}
              alt={project.title}
              width={800}
              height={450}
              loading="lazy"
              sizes="(min-width: 1024px) 40vw, 90vw"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[var(--color-obsidian)] via-transparent to-transparent opacity-70 transition-opacity group-hover:opacity-40" />

            {/* Static blur value; only opacity transitions. */}
            <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-black/60 font-mono text-xs font-bold tracking-widest text-[var(--color-accent-warm)] opacity-0 backdrop-blur-[3px] transition-opacity duration-300 group-hover:opacity-100">
              <Sparkles size={16} className="group-hover:animate-spin" />
              <span>CLICK FOR FULL SCHEMATIC</span>
            </div>
          </div>
        ) : (
          <div
            className="relative flex h-full w-full flex-col justify-between overflow-hidden p-6"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${project.color}25, #05070f 85%)`,
            }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] opacity-20 [background-size:16px_16px]" />

            <div className="z-10 flex items-start justify-between font-mono text-[10px] text-[var(--color-accent-warm)]">
              <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 px-2.5 py-1">
                {project.type.includes("Game") ? (
                  <Gamepad2 size={12} className="text-purple-400" />
                ) : project.type.includes("Mobile") ? (
                  <Layers size={12} className="text-cyan-400" />
                ) : (
                  <Cpu size={12} className="text-blue-400" />
                )}
                {project.type.toUpperCase()}
              </span>
              <span className="text-[var(--color-ash)]">
                [SCHEMATIC_v{project.year}]
              </span>
            </div>

            <div className="z-10">
              <h4 className="font-display text-xl font-black tracking-wider text-white uppercase drop-shadow-md">
                {project.title}
              </h4>
              <p className="mt-1 font-mono text-[11px] text-[var(--color-silver)]">
                {project.subtitle}
              </p>
            </div>

            <div className="z-10 flex items-center justify-between border-t border-white/10 pt-2 font-mono text-[9px] text-[var(--color-ash)]">
              <span>STATUS: DEPLOYED</span>
              <span className="text-emerald-400">ENCRYPTION: VERIFIED</span>
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 flex items-start justify-between">
        <span className="font-mono text-xs tracking-widest text-[var(--color-accent-warm)]">
          FILE_{String(index + 1).padStart(2, "0")}
        </span>
        <span className="rounded-md border border-[var(--color-accent-primary)]/30 bg-[var(--color-accent-primary)]/20 px-2.5 py-1 font-mono text-[10px] text-[var(--color-pearl)]">
          {project.type.toUpperCase()}
        </span>
      </div>

      <h3 className="font-display mb-2 text-2xl font-bold text-white uppercase transition-colors group-hover:text-[var(--color-accent-warm)]">
        {project.title}
      </h3>

      <p className="mb-6 line-clamp-2 font-mono text-xs leading-relaxed text-[var(--color-silver)]">
        {project.subtitle}
      </p>

      <div className="mb-8 flex flex-wrap gap-2">
        {project.technologies.slice(0, 4).map((tech) => (
          <span
            key={tech}
            className="rounded-md border border-[var(--color-glass-border)] px-2.5 py-1 font-mono text-[10px] tracking-wider text-[var(--color-ash)] uppercase"
          >
            {tech}
          </span>
        ))}
        {project.technologies.length > 4 && (
          <span className="px-2 py-1 font-mono text-[10px] text-[var(--color-accent-warm)]">
            +{project.technologies.length - 4} MORE
          </span>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/10 pt-4 font-mono text-xs text-[var(--color-accent-warm)]">
        <span className="flex items-center gap-1 group-hover:underline">
          VIEW TACTICAL DATA <ArrowUpRight size={14} />
        </span>
        <span className="text-[10px] text-[var(--color-ash)]">
          [{project.year}]
        </span>
      </div>
    </motion.article>
  );
});

/* ── Section ──────────────────────────────────────────────── */

export default function EvaProjects() {
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const lenis = useLenis();

  /* Tier detection touches navigator/matchMedia, so it cannot be read during
     render without SSR and hydration disagreeing. The hook uses
     `useSyncExternalStore`, which gives the client its real value on the FIRST
     render — the old `useState(false)` + effect painted the wrong value once
     and then re-rendered the whole grid to correct it. */
  const lowEnd = useLowEndDevice();

  /* The old effect set `document.body.style.overflow = "hidden"`, which Lenis
     ignores outright — it drives scroll from its own rAF loop, so the page kept
     moving behind the modal. useScrollLock stops the Lenis instance, pins the
     body (the only lock iOS respects), and restores the offset on close. */
  useScrollLock(!!selectedProject, lenis);

  const filteredProjects = useMemo(
    () => PROJECTS.filter((p) => matches(p, activeCategory)),
    [activeCategory]
  );

  // Stable identity keeps the memoized cards from re-rendering when the
  // modal opens or the filter changes.
  const handleSelect = useCallback((project: Project) => {
    setSelectedProject(project);
  }, []);

  const closeModal = useCallback(() => setSelectedProject(null), []);

  useEffect(() => {
    if (!selectedProject) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedProject, closeModal]);

  const modalImg = selectedProject
    ? getProjectImage(selectedProject.id)
    : undefined;

  return (
    <section id="projects" className="relative py-24">
      <div className="container-narrow">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: DUR.slow, ease: EASE.out }}
          className="mb-8 flex flex-col justify-between gap-4 border-b-2 border-[var(--color-accent-primary)] pb-4 sm:flex-row sm:items-end"
        >
          <div>
            <h2 className="font-display text-3xl font-bold tracking-wider text-[var(--color-accent-primary)] uppercase">
              Archive // Projects Matrix
            </h2>
            <p className="mt-1 font-mono text-xs text-[var(--color-silver)]">
              Interactive MAGI Data Repository — Click any file for full tactical
              schematic
            </p>
          </div>
          <span className="font-mono text-xs text-[var(--color-ash)]">
            DISPLAYING: {filteredProjects.length} / {PROJECTS.length} RECORDS
          </span>
        </motion.div>

        {/* Filters */}
        <div className="mb-12 flex w-fit flex-wrap items-center gap-2 rounded-2xl border border-[var(--color-accent-primary)]/30 bg-[var(--color-obsidian)]/80 p-1.5">
          <Filter size={14} className="mr-1 ml-2 text-[var(--color-accent-warm)]" />
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              data-cursor-hover
              className={`relative rounded-xl px-4 py-2 font-mono text-xs font-bold tracking-wider transition-colors duration-200 ${
                activeCategory === cat
                  ? "font-extrabold text-black"
                  : "text-[var(--color-pearl)]/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              {activeCategory === cat && (
                <motion.div
                  layoutId="eva-project-filter"
                  className="absolute inset-0 rounded-xl bg-[var(--color-accent-warm)] shadow-[0_0_15px_rgba(57,255,20,0.5)]"
                  transition={SPRING.snappy}
                />
              )}
              <span className="relative z-10">{cat}</span>
            </button>
          ))}
        </div>

        {/* Grid — plain CSS grid. `popLayout` needs `layout` on the children
            to work, and that is exactly what was jittering on modal close, so
            both are gone together. */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <AnimatePresence initial={false}>
            {filteredProjects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={index}
                animateHover={!lowEnd}
                onSelect={handleSelect}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Modal — portalled to <body>. Inside `.container-narrow` it sat under
          ancestors that create stacking/containing blocks, so `fixed` was
          resolved against the section rather than the viewport; that is what
          made the panel shift as the page behind it settled. */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
          {selectedProject && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DUR.fast }}
              onClick={closeModal}
              role="dialog"
              aria-modal="true"
              aria-label={selectedProject ? `${selectedProject.title} project details` : "Project details"}
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl sm:p-6"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={SPRING.panel}
                onClick={(e) => e.stopPropagation()}
                /* `.scroll-panel` adds overscroll-behavior:contain (no chaining
                   into the page) and -webkit-overflow-scrolling:touch (iOS
                   momentum), which plain `overflow-y-auto scrollbar-none` lacks.
                   `mt-16` is dropped: combined with max-h it pushed the panel
                   off-centre and clipped the bottom on short viewports. */
                className="scroll-panel relative max-h-[85svh] w-full max-w-3xl rounded-3xl border-2 border-[var(--color-accent-warm)] bg-[#070913] p-6 text-white shadow-[0_0_50px_rgba(57,255,20,0.3)] sm:p-8"
              >
                <button
                  onClick={closeModal}
                  aria-label="Close project details"
                  className="absolute top-5 right-5 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white transition-colors hover:bg-[var(--color-accent-warm)] hover:text-black"
                >
                  <X size={18} />
                </button>

                <div className="mb-6">
                  <div className="mb-2 flex items-center gap-3 font-mono text-xs text-[var(--color-accent-warm)]">
                    <Code2 size={16} />
                    <span>MAGI ANALYSIS // {selectedProject.id.toUpperCase()}</span>
                    <span className="text-[var(--color-ash)]">
                      [{selectedProject.year}]
                    </span>
                  </div>
                  <h3 className="font-display text-3xl font-extrabold text-white uppercase sm:text-4xl">
                    {selectedProject.title}
                  </h3>
                  <p className="mt-1 font-mono text-sm text-[var(--color-silver)]">
                    {selectedProject.subtitle}
                  </p>
                </div>

                <div className="relative mb-6 aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
                  {modalImg ? (
                    <Image
                      src={modalImg}
                      alt={selectedProject.title}
                      width={1000}
                      height={560}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full flex-col items-center justify-center p-8 text-center"
                      style={{
                        background: `radial-gradient(circle at 50% 50%, ${selectedProject.color}35, #05070f 90%)`,
                      }}
                    >
                      <Cpu size={48} className="mb-4 text-[var(--color-accent-warm)]" />
                      <h4 className="font-display text-2xl font-bold uppercase">
                        {selectedProject.title}
                      </h4>
                      <p className="mt-2 max-w-md font-mono text-xs text-[var(--color-silver)]">
                        {selectedProject.description}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mb-8 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 font-mono text-sm leading-relaxed text-[var(--color-pearl)]">
                  <h5 className="text-xs font-bold tracking-wider text-[var(--color-accent-warm)] uppercase">
                    &gt; ARCHITECTURAL OVERVIEW &amp; PROBLEM SOLVED
                  </h5>
                  <p>{selectedProject.description}</p>
                </div>

                <div className="mb-8">
                  <h5 className="mb-3 font-mono text-xs font-bold tracking-wider text-[var(--color-accent-warm)] uppercase">
                    MODULE TECH STACK
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedProject.technologies.map((tech) => (
                      <span
                        key={tech}
                        className="rounded-xl border border-[var(--color-accent-primary)]/50 bg-[var(--color-accent-primary)]/10 px-3.5 py-1.5 font-mono text-xs font-semibold text-white"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 border-t border-white/10 pt-4">
                  {selectedProject.live && (
                    <a
                      href={selectedProject.live}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl bg-[var(--color-accent-warm)] px-6 py-3 font-mono text-xs font-bold text-black shadow-[0_0_20px_rgba(57,255,20,0.5)] transition-colors hover:bg-white"
                    >
                      <ExternalLink size={16} /> LIVE DEPLOYMENT
                    </a>
                  )}
                  {selectedProject.github && (
                    <a
                      href={selectedProject.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-mono text-xs font-bold text-white transition-colors hover:border-[var(--color-accent-warm)] hover:text-[var(--color-accent-warm)]"
                    >
                      <GitHubIcon className="h-4 w-4" /> VIEW SOURCE CODE
                    </a>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
          </AnimatePresence>,
          document.body
        )}
    </section>
  );
}
