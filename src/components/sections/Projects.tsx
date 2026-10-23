"use client";

import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight, X, ChevronLeft, ChevronRight } from "lucide-react";
import { GitHubIcon } from "@/components/ui/BrandIcons";
import RevealText from "@/components/ui/RevealText";
import TiltPanel from "@/components/ui/TiltPanel";
import ChapterLabel from "@/components/ui/ChapterLabel";
import { PROJECTS, type Project } from "@/lib/data";
import { getProjectImage } from "@/data/projectImages";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { useLenis } from "@/components/providers/SmoothScrollProvider";
import { DUR, EASE, SPRING } from "@/lib/motion";


const featured = PROJECTS.filter((p) => p.featured);


// Mobile card carousel — shown below md breakpoint
function MobileProjectCarousel({ onSelect }: { onSelect: (p: Project) => void }) {
  const [idx, setIdx] = useState(0);
  const dragStart = useRef(0);
  const all = PROJECTS;
  const project = all[idx];
  const projectImg = getProjectImage(project.id);

  const prev = () => setIdx((i) => (i - 1 + all.length) % all.length);
  const next = () => setIdx((i) => (i + 1) % all.length);

  // The canonical `id="projects"` lives on the desktop section below.
  // A duplicate id here made `querySelector("#projects")` resolve to this
  // hidden element on desktop — its rect.top is 0, so nav clicks scrolled
  // to the top of the page instead of to Selected Works.
  return (
    <div className="md:hidden section-padding" id="projects-mobile">
      <div className="container-narrow">
        <ChapterLabel index={6} classic="Selected Work" eva="OPERATION LOG" className="mb-3" />
        <RevealText as="h2" className="text-section-title font-display text-[var(--color-starlight)] mb-8">
          Projects, built with craft.
        </RevealText>

        <AnimatePresence mode="wait">
          <motion.article
            key={project.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => onSelect(project)}
            onTouchStart={(e) => { dragStart.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              const delta = dragStart.current - e.changedTouches[0].clientX;
              if (Math.abs(delta) > 40) {
                if (delta > 0) next();
                else prev();
              }
            }}
            className="group relative flex flex-col justify-end overflow-hidden rounded-3xl border border-[var(--color-glass-border)] bg-[var(--color-obsidian)] cursor-pointer"
            style={{ minHeight: "60vw", maxHeight: 420 }}
          >
            {projectImg && (
              <div className="absolute inset-0 opacity-60">
                <Image src={projectImg} alt={project.title} fill sizes="100vw" className="object-cover" />

                <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-obsidian)] via-[var(--color-obsidian)]/60 to-transparent" />
              </div>
            )}
            {!projectImg && (

              <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 40% 60%, ${project.color}20, transparent 70%)` }} />
            )}
            <div className="relative z-10 p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: project.color }} />
                <span className="chapter-label">{project.type} · {project.year}</span>
              </div>
              <h3 className="font-display text-2xl font-bold text-[var(--color-starlight)]">{project.title}</h3>
              <p className="mt-1 font-body text-sm text-[var(--color-silver)] line-clamp-2">{project.subtitle}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {project.technologies.slice(0, 3).map((t) => (
                  <span key={t} className="rounded-full border border-[var(--color-glass-border)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-silver)] bg-white/[0.03]">{t}</span>
                ))}
              </div>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-accent-primary)]/40 bg-[var(--color-accent-primary)]/10 px-4 py-1.5 font-mono text-[11px] font-bold text-[var(--color-accent-primary)]">
                VIEW DETAILS <ArrowUpRight size={12} />
              </span>
            </div>
          </motion.article>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-between">
          <button onClick={prev} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] text-[var(--color-silver)]" aria-label="Previous project">
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            {all.map((_, i) => (
              /* Padding + negative margin: the visible dot stays the same
                 size, but the tappable area is ~32px instead of 8–20px. */
              <button key={i} onClick={() => setIdx(i)} className="cursor-pointer rounded-full p-2 -m-2" aria-label={`Go to project ${i + 1}`}>
                <span className={`block rounded-full transition-all duration-300 ${i === idx ? "w-5 h-2 bg-[var(--color-accent-primary)]" : "w-2 h-2 bg-[var(--color-ash)]"}`} />
              </button>
            ))}
          </div>
          <button onClick={next} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] text-[var(--color-silver)]" aria-label="Next project">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Projects() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [viewportH, setViewportH] = useState(900);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [mounted, setMounted] = useState(false);
  const lenis = useLenis();
  const modalImg = selectedProject ? getProjectImage(selectedProject.id) : undefined;

  // Page must not scroll behind the dossier — Lenis included.
  useScrollLock(!!selectedProject, lenis);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Escape closes the dossier. Expected on every modal; its absence is a bug.
  useEffect(() => {
    if (!selectedProject) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedProject(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedProject]);


  // Measure track overflow for horizontal scroll
  useEffect(() => {
    function measure() {
      if (!trackRef.current) return;
      setTrackWidth(trackRef.current.scrollWidth - window.innerWidth);
      setViewportH(window.innerHeight);
    }
    measure();
    window.addEventListener("resize", measure, { passive: true });
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Scroll progress for the pinned section
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Map vertical scroll to horizontal position
  const x = useTransform(scrollYProgress, [0, 1], [0, -trackWidth]);
  const sectionHeight = Math.max(300, trackWidth + viewportH);

  return (
    /* Single canonical `id="projects"` lives on this wrapper so nav clicks
       resolve to whichever layout is actually visible. Putting the id on the
       desktop <section> alone broke mobile (that section is display:none below
       md); putting it on both created a duplicate-id bug on desktop. */
    <div id="projects">
      {/* Mobile carousel — shown below md */}
      <MobileProjectCarousel onSelect={setSelectedProject} />

      {/* Desktop horizontal scroll section — hidden on mobile */}
      <section
        ref={sectionRef}
        className="relative hidden md:block"
        style={{ height: sectionHeight }}
      >
      {/* Pinned viewport */}
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* Header — always visible, positioned safely below sticky navbar */}
        <div className="container-narrow relative z-20 pt-24 sm:pt-28 md:pt-32">
          <ChapterLabel index={6} classic="Selected Work" eva="OPERATION LOG" className="mb-3" />
          <RevealText
            as="h2"
            className="text-section-title font-display text-[var(--color-starlight)]"
          >
            Projects, built with craft.
          </RevealText>
        </div>

        {/* Horizontal track — vertically centered scroll track with original spacing */}
        <motion.div
          ref={trackRef}
          style={{ x }}
          className="absolute top-0 left-0 flex h-full items-center gap-12 pl-[clamp(1.5rem,5vw,4rem)] pr-[50vw] pt-20 pb-10 z-10"
        >
          {/* Original spacer for the header area */}
          <div className="w-[40vw] shrink-0" />

          {featured.map((project) => {
            const cardImg = getProjectImage(project.id);
            return (
            /* The card is a 3D panel: TiltPanel owns the perspective and the
               rotation, the article keeps its own hover scale. The track's
               layout classes (height, width, shrink-0) live on the wrapper
               because the wrapper is now the flex item — the article fills
               it. Splitting them this way is also what keeps framer-motion
               and the tilt loop from writing the same `transform`. */
            <TiltPanel
              key={project.id}
              className="h-[70vh] w-[75vw] max-w-[900px] shrink-0"
            >
            <motion.article
              whileHover={{ scale: 1.02, y: -6 }}
              whileTap={{ scale: 0.98 }}
              transition={SPRING.soft}

              onClick={() => setSelectedProject(project)}
              className="group relative flex h-full w-full flex-col justify-end overflow-hidden rounded-3xl border border-[var(--color-glass-border)] bg-[var(--color-obsidian)] p-10 md:p-14 transition-[border-color,box-shadow] duration-300 ease-out shadow-[0_20px_50px_rgba(0,0,0,0.55)] cursor-pointer hover:border-[var(--color-accent-primary)]/50 hover:shadow-[0_25px_60px_color-mix(in_srgb,var(--color-accent-primary)_20%,transparent)]"
              data-hoverable
              data-cursor-hover
            >
              {/* Background gradient glow */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                style={{
                  background: `radial-gradient(ellipse at 30% 70%, ${project.color}25, transparent 60%)`,
                }}
                aria-hidden="true"
              />

              {/* Project image */}
              {/* Artwork legibility: raised from 55% to 80% (95% on hover) so
                  screenshots stay clearly viewable while scrolling through the
                  track. The gradient overlay still protects text contrast in
                  the lower half where the copy sits. */}
              {cardImg && (
                <div className="absolute inset-0 opacity-80 group-hover:opacity-95 transition-opacity duration-700">


                  <Image
                    src={cardImg}
                    alt={project.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 900px"
                    className="object-cover"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-obsidian)] via-[var(--color-obsidian)]/80 to-transparent" />
                </div>
              )}

              {/* Content */}
              <div className="relative z-10">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 rounded-full animate-pulse"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="chapter-label">
                      {project.type} · {project.year}
                    </span>
                  </div>

                  {/* VIEW PROJECT DETAILS BUTTON BADGE */}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-accent-primary)]/40 bg-[var(--color-accent-primary)]/10 px-4 py-1.5 font-mono text-[11px] font-bold text-[var(--color-accent-primary)] group-hover:bg-[var(--color-accent-primary)] group-hover:text-white transition-all shadow-md">
                    <span>VIEW PROJECT DETAILS</span>
                    <ArrowUpRight size={13} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </span>
                </div>

                <h3 className="font-display text-4xl font-bold text-[var(--color-starlight)] md:text-5xl group-hover:text-[var(--color-accent-primary)] transition-colors">
                  {project.title}
                </h3>
                <p className="mt-2 font-body text-lg text-[var(--color-silver)]">
                  {project.subtitle}
                </p>

                <p className="mt-4 max-w-lg font-body text-sm leading-relaxed text-[var(--color-ash)] line-clamp-3">
                  {project.description}
                </p>

                {/* Tech tags */}
                <div className="mt-6 flex flex-wrap gap-2">
                  {project.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-full border border-[var(--color-glass-border)] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-silver)] bg-white/[0.03]"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </motion.article>
            </TiltPanel>
            );
          })}

          {/* Experiments / non-featured — final scene */}

          <div className="flex h-[70vh] w-[60vw] max-w-[700px] shrink-0 flex-col justify-center">
            <span className="chapter-label mb-6">Experiments & Prototypes</span>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {PROJECTS.filter((p) => !p.featured).map((project) => (
                <div
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  className="glass group flex flex-col gap-3 rounded-2xl p-5 transition-all duration-300 hover:border-[var(--color-accent-primary)]/40 hover:bg-white/[0.06] cursor-pointer"
                  data-cursor-hover
                  data-hoverable
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <ArrowUpRight
                      size={14}
                      className="text-[var(--color-ash)] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--color-accent-primary)]"
                    />
                  </div>
                  <h4 className="font-display text-lg text-[var(--color-starlight)] group-hover:text-white transition-colors">
                    {project.title}
                  </h4>
                  <p className="font-body text-xs text-[var(--color-silver)]">
                    {project.subtitle}
                  </p>
                  <div className="mt-auto flex gap-2">
                    {project.technologies.slice(0, 3).map((tech) => (
                      <span
                        key={tech}
                        className="font-mono text-[9px] uppercase tracking-wider text-[var(--color-ash)]"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Progress indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
          <span className="chapter-label">
            Scroll to explore
          </span>
          <div className="h-[1px] w-16 bg-[var(--color-glass-border)] overflow-hidden">
            <motion.div
              className="h-full bg-[var(--color-accent-primary)]"
              style={{ scaleX: scrollYProgress, transformOrigin: "left" }}
            />
          </div>
        </div>
      </div>

      {/* Project detail modal — portalled to <body> so it escapes the
          section's stacking context. */}
      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {selectedProject && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DUR.fast, ease: EASE.out }}
                onClick={() => setSelectedProject(null)}
                role="dialog"
                aria-modal="true"
                aria-label={`${selectedProject.title} — project details`}
                className="fixed inset-0 z-[99999] flex items-center justify-center bg-[var(--color-void)]/80 p-4 backdrop-blur-md sm:p-6"
              >
                <motion.div
                  initial={{ scale: 0.96, opacity: 0, y: 12 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.97, opacity: 0, y: 8, transition: { duration: DUR.fast, ease: EASE.in } }}
                  transition={SPRING.panel}
                  onClick={(e) => e.stopPropagation()}
                  className="relative flex max-h-[88svh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-obsidian)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
                >
                  {/* Header — meta, title, close */}
                  <div className="flex items-start justify-between gap-4 border-b border-[var(--color-glass-border)] px-6 pb-5 pt-6 sm:px-8">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-ash)]">
                        {selectedProject.type} · {selectedProject.year}
                      </p>
                      <h3 className="mt-1.5 font-display text-2xl font-bold text-[var(--color-starlight)] sm:text-3xl">
                        {selectedProject.title}
                      </h3>
                      <p className="mt-1 font-body text-sm text-[var(--color-silver)]">
                        {selectedProject.subtitle}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProject(null)}
                      aria-label="Close project details"
                      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--color-glass-border)] text-[var(--color-silver)] transition-colors hover:border-[var(--color-accent-primary)] hover:text-[var(--color-starlight)]"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Scrollable body — `data-lenis-prevent` keeps Lenis from
                      hijacking wheel events that start inside the panel. */}
                  <div
                    data-lenis-prevent
                    className="scroll-panel min-h-0 flex-1 overflow-y-auto px-6 py-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:px-8"
                  >
                    {/* Screenshot */}
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-void)]">
                      {modalImg ? (
                        <Image
                          src={modalImg}
                          alt={`${selectedProject.title} screenshot`}
                          fill
                          sizes="(max-width: 768px) 100vw, 768px"
                          className="object-cover object-top"
                          priority
                        />
                      ) : (
                        <div
                          className="flex h-full w-full flex-col items-center justify-center p-8 text-center"
                          style={{
                            background: `radial-gradient(ellipse at 50% 45%, ${selectedProject.color}26, transparent 75%)`,
                          }}
                        >
                          <h4 className="font-display text-2xl font-bold text-[var(--color-starlight)] sm:text-3xl">
                            {selectedProject.title}
                          </h4>
                          <p className="mt-2 max-w-md font-body text-sm text-[var(--color-silver)]">
                            {selectedProject.subtitle}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Overview */}
                    <p className="mt-6 font-body text-sm leading-relaxed text-[var(--color-silver)] sm:text-[15px]">
                      {selectedProject.description}
                    </p>

                    {/* Problem / Solution / Outcome — quiet rows, one accent */}
                    <dl className="mt-6 divide-y divide-[var(--color-glass-border)] border-y border-[var(--color-glass-border)]">
                      {(
                        [
                          ["Problem", selectedProject.problem],
                          ["Solution", selectedProject.solution],
                          ["Outcome", selectedProject.outcome],
                        ] as const
                      ).map(([label, text]) => (
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
                    <div className="mt-6 pb-1">
                      <p className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-ash)]">
                        Stack
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedProject.technologies.map((tech) => (
                          <span
                            key={tech}
                            className="rounded-md border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] px-2.5 py-1 font-mono text-[11px] text-[var(--color-silver)]"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>

                  </div>{/* end scrollable content area */}

                  {/* Footer — actions (hidden when the project has no links) */}
                  {(selectedProject.github || selectedProject.live) && (
                    <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-[var(--color-glass-border)] px-6 py-4 sm:px-8">
                      {selectedProject.live && (
                        <a
                          href={selectedProject.live}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--color-accent-primary)] px-5 py-2.5 font-mono text-xs font-bold text-white transition-opacity hover:opacity-90"
                        >
                          Launch Live Site <ArrowUpRight size={14} />
                        </a>
                      )}
                      {selectedProject.github && (
                        <a
                          href={selectedProject.github}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-glass-border)] px-5 py-2.5 font-mono text-xs font-bold text-[var(--color-silver)] transition-colors hover:border-[var(--color-accent-primary)] hover:text-[var(--color-starlight)]"
                        >
                          <GitHubIcon size={14} /> View Source
                        </a>
                      )}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
      </section>
    </div>
  );
}
