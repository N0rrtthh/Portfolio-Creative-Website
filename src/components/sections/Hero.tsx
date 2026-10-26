"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useMotionValue,
  useSpring,
  animate,
  AnimatePresence,
} from "framer-motion";
import { ArrowUpRight, Cpu } from "lucide-react";
import MagneticButton from "@/components/ui/MagneticButton";
import ChapterLabel from "@/components/ui/ChapterLabel";
import AnimeText from "@/components/ui/AnimeText";
import AnimeStaggerGrid from "@/components/ui/AnimeStaggerGrid";
import TiltCard from "@/components/ui/TiltCard";
import { SOCIAL_ICONS } from "@/components/ui/BrandIcons";
import { CONTACT_EMAIL, SOCIAL_LINKS } from "@/lib/data";
import { asset } from "@/lib/assets";
import { useTheme } from "@/components/providers/ThemeProvider";
import profilePic from "@/../public/profile.jpg";

const ParticleField = dynamic(() => import("@/components/three/ParticleField"), {
  ssr: false,
});

import TypewriterRole from "@/components/ui/TypewriterRole";

const EASING = [0.22, 1, 0.36, 1] as const;

/* Inline SVG film-grain tile (feTurbulence) — a cheap celluloid texture that
   reads as "shot on film" without any image asset. */
const GRAIN_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

const METRICS = [
  { end: 12, suffix: "+", decimals: 0, label: "Projects Shipped" },
  { end: 4, suffix: "+ Yrs", decimals: 0, label: "Building & Crafting" },
  { end: 29, suffix: "", decimals: 0, label: "Certifications" },
];

/** Counts a metric up from 0 the first time it scrolls into view. */
function MetricValue({
  end,
  suffix,
  decimals,
  delay,
}: {
  end: number;
  suffix: string;
  decimals: number;
  delay: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, end, {
      duration: 1.8,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v.toFixed(decimals)),
    });
    return () => controls.stop();
  }, [inView, end, decimals, delay]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

/** A social icon that magnetically pulls toward the cursor on hover. */
function MagneticSocial({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.5 });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.35);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.35);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.a
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy }}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] text-[var(--color-silver)] backdrop-blur-md transition-[color,border-color,box-shadow] duration-200 hover:text-[var(--color-starlight)] hover:border-[var(--color-accent-primary)] hover:shadow-[0_0_18px_rgba(67,97,238,0.25)] will-change-transform"
      aria-label={label}
      data-cursor-hover
    >
      {children}
    </motion.a>
  );
}

/* HUD corner brackets for the profile card. */
function HudCorners() {
  const base =
    "pointer-events-none absolute z-20 h-5 w-5 border-[var(--color-accent-primary)] opacity-70";
  return (
    <>
      <span className={`${base} left-2 top-2 border-l-2 border-t-2 rounded-tl-md`} />
      <span className={`${base} right-2 top-2 border-r-2 border-t-2 rounded-tr-md`} />
      <span className={`${base} bottom-2 left-2 border-b-2 border-l-2 rounded-bl-md`} />
      <span className={`${base} bottom-2 right-2 border-b-2 border-r-2 rounded-br-md`} />
    </>
  );
}

export default function Hero() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { setDesign } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  // Cursor-following spotlight — a soft radial glow that eases toward the
  // pointer, adding interactive depth without any layout cost (GPU transforms
  // only). Spring-smoothed so it trails the cursor cinematically.
  const spotX = useMotionValue(0);
  const spotY = useMotionValue(0);
  const spotSpringX = useSpring(spotX, { stiffness: 60, damping: 20, mass: 0.6 });
  const spotSpringY = useSpring(spotY, { stiffness: 60, damping: 20, mass: 0.6 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      spotX.set(e.clientX - 300);
      spotY.set(e.clientY - 300);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [spotX, spotY]);

  // Secret transition trigger into EVA mode
  const handleSecretTrigger = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setDesign("eva", origin);
  };


  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start start", "end start"],
  });

  // GPU-only scroll exit. The hero is a single 100svh screen (not pinned), so
  // the content stays fully visible while the hero is on screen and only
  // fades/scales during the final stretch as it physically leaves — no empty
  // dark band while the next chapter is still scrolling in.
  const contentOpacity = useTransform(scrollYProgress, [0.7, 1], [1, 0]);
  const contentScale = useTransform(scrollYProgress, [0.7, 1], [1, 0.96]);
  const contentY = useTransform(scrollYProgress, [0.7, 1], [0, -50]);

  // Differential parallax: the identity column and the profile card leave at
  // different speeds, giving the exit depth instead of a flat fade.
  const leftY = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const rightY = useTransform(scrollYProgress, [0, 1], [0, -130]);

  const glowOpacity = useTransform(scrollYProgress, [0.4, 0.8], [0.18, 0]);
  const glowY = useTransform(scrollYProgress, [0.5, 0.95], [0, -90]);

  // Scroll cue fades out as soon as the reader starts scrolling.
  const scrollCueOpacity = useTransform(scrollYProgress, [0, 0.08], [1, 0]);

  return (
    <div ref={wrapRef} id="hero" className="relative min-h-svh">
      <section className="flex min-h-svh flex-col overflow-hidden py-16 justify-center">
        {/* Background layers — fade up as part of the cinematic opening */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.8, delay: 0.35, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0"
        >
          {/* Particle field background */}
          <div className="pointer-events-none absolute inset-0 opacity-50">
            <ParticleField scrollProgress={scrollYProgress} />
          </div>

          {/* Anime.js Stagger Grid in background */}
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 z-0">
            <AnimeStaggerGrid rows={6} columns={12} />
          </div>

          {/* Ambient gradient */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{ opacity: glowOpacity, y: glowY }}
            aria-hidden="true"
          >
            <div
              className="absolute top-1/3 left-1/4 w-[600px] h-[600px] rounded-full animate-breathe"
              style={{
                background: "radial-gradient(circle, rgba(67,97,238,0.22), transparent 70%)",
              }}
            />
          </motion.div>

          {/* Cursor-following spotlight — interactive depth layer */}
          <motion.div
            className="pointer-events-none absolute top-0 left-0 h-[600px] w-[600px] rounded-full"
            style={{
              x: spotSpringX,
              y: spotSpringY,
              background:
                "radial-gradient(circle, rgba(99,102,241,0.10), transparent 65%)",
            }}
            aria-hidden="true"
          />
        </motion.div>

        {/* Cinematic vignette — darkens only the far edges for a filmic frame.
            Kept soft (0.32) and starting late (62%) so it never obscures or
            visually "closes in" on the hero content. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.8, delay: 0.6, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 z-[5]"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,0.32) 100%)",
          }}
          aria-hidden="true"
        />

        {/* Film grain — subtle static noise for a celluloid texture */}
        <div
          className="pointer-events-none absolute inset-0 z-[6] opacity-[0.05] mix-blend-overlay"
          style={{ backgroundImage: `url("${GRAIN_SVG}")`, backgroundSize: "180px 180px" }}
          aria-hidden="true"
        />

        {/* Reading scrim — a soft veil behind the identity column so the fox
            hologram (and the particle field) can never wash out the copy.
            Tinted with --color-void via color-mix so it matches both dark
            and light themes instead of hardcoding black. */}
        <div
          className="pointer-events-none absolute inset-0 z-[7]"
          style={{
            background:
              "radial-gradient(ellipse 70% 85% at 30% 50%, color-mix(in srgb, var(--color-void) 72%, transparent) 0%, color-mix(in srgb, var(--color-void) 34%, transparent) 45%, transparent 72%)",
          }}
          aria-hidden="true"
        />

        {/* Main Hero Content — a cinematic FOCUS-PULL entrance (blur → sharp,
            scale settle) on the outer wrapper, wrapping the scroll-driven
            exit on the inner wrapper so the two never fight over `filter`. */}
        <motion.div
          initial={{ opacity: 0, filter: "blur(16px)", scale: 1.04 }}
          animate={{ opacity: 1, filter: "blur(0px)", scale: 1, transitionEnd: { filter: "none" } }}
          transition={{ duration: 1.5, delay: 0.45, ease: EASING }}
          className="relative z-10 flex w-full flex-1 flex-col justify-center will-change-transform transform-gpu"
        >
          <motion.div
            style={{
              opacity: contentOpacity,
              scale: contentScale,
              y: contentY,
              /* No scroll-linked blur: re-blurring the whole hero (with a
                 backdrop-blurred card inside it) every scroll frame was the
                 single most expensive paint on the page. Fade + scale + lift
                 carry the exit on the compositor. */
            }}
            className="container-narrow flex flex-col justify-center will-change-transform transform-gpu"
          >
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            {/* Left Column — Text & Identity */}
            <motion.div style={{ y: leftY }} className="lg:col-span-7">
              {/* Availability Status Badge, Chapter Label & Secret Animated EVA Icon */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.0, delay: 0.1, ease: EASING }}
                className="flex flex-wrap items-center gap-4 mb-6 relative"
              >
                <ChapterLabel index={1} classic="Introduction" eva="SYNC INITIATED" />
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] px-3.5 py-1 text-xs font-mono text-[var(--color-silver)] backdrop-blur-md">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Available for Roles
                </div>

                {/* SECRET ANIMATED ICON ABOVE ELRONI (Secret EVA Mode Trigger) */}
                <div className="relative group">
                  <button
                    type="button"
                    onClick={handleSecretTrigger}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    data-cursor-hover
                    aria-label="Secret NERV System Override"
                    className="relative flex items-center justify-center p-2 rounded-full border border-purple-500/30 bg-purple-950/20 hover:bg-purple-900/40 hover:border-purple-400 transition-[background-color,border-color,box-shadow,transform] duration-[250ms] ease-out active:scale-[0.97] shadow-[0_0_12px_rgba(168,85,247,0.25)] group"
                  >
                    {/* Animated Rotating Outer Ring */}
                    <div
                      style={{ animation: "loop-spin 8s linear infinite" }}
                      className="absolute inset-0 rounded-full border border-dashed border-purple-400/40 pointer-events-none"
                    />

                    {/* Animated Pulsing Icon */}
                    <div style={{ animation: "loop-pulse-scale 2s ease-in-out infinite" }}>
                      <Cpu size={14} className="text-purple-400 group-hover:text-purple-300 transition-colors" />
                    </div>
                  </button>

                  {/* Lowkey Secret Tooltip on Hover */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.9 }}
                        className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 whitespace-nowrap px-2.5 py-1 rounded-lg border border-purple-500/40 bg-black/90 text-[10px] font-mono font-semibold text-purple-300 shadow-xl pointer-events-none z-50 flex items-center gap-1.5"
                      >

                        <span>EVA MODE</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Primary Name Headline Anchor */}
              <AnimeText delay={200} className="text-hero font-display text-[var(--color-starlight)] tracking-tight">
                Elroni Quiñones
              </AnimeText>

              {/* Animated Role / Title Sequence */}
              {/* Own layer + layout containment: the typewriter changes text
                  every 25–40ms, and without isolation each keystroke re-laid-out
                  and re-rastered the entire hero column. */}
              <div className="h-10 my-4 flex items-center will-change-transform [contain:layout_paint]">
                <TypewriterRole />
              </div>

              {/* Concise Personal Introduction */}
              <motion.p
                initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
                transition={{ duration: 1.0, delay: 0.6, ease: EASING }}
                className="mt-4 max-w-prose font-body text-base leading-relaxed text-[var(--color-silver)] md:text-lg"
              >
                Building production web, mobile, and game systems at the intersection of engineering rigor and design craft. Dedicated to shipping fast, responsive, and memorable user experiences.
              </motion.p>

              {/* Primary & Secondary Call To Action Buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.0, delay: 0.8, ease: EASING }}
                >
                  <MagneticButton
                    href="#projects"
                    className="rounded-full bg-[var(--color-starlight)] px-7 py-3.5 font-body text-sm font-semibold text-[var(--color-void)] transition-[background-color,color,box-shadow,transform] duration-[250ms] ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(240,240,250,0.18)] will-change-transform transform-gpu active:scale-[0.97]"
                  >
                    View Selected Work
                  </MagneticButton>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.0, delay: 0.9, ease: EASING }}
                >
                  <MagneticButton
                    href={asset("/ELRONI_QUIÑONES_Resume.pdf")}
                    download
                    className="rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] px-7 py-3.5 font-body text-sm font-medium text-[var(--color-silver)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-[250ms] ease-out hover:border-[var(--color-accent-primary)] hover:text-[var(--color-starlight)] hover:shadow-[0_8px_30px_rgba(67,97,238,0.15)] will-change-transform transform-gpu active:scale-[0.97]"
                  >
                    Download Resume <ArrowUpRight className="inline-block h-4 w-4 ml-1 opacity-70" />
                  </MagneticButton>
                </motion.div>
              </div>

              {/* Social Network Quick Access Strip */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.0, delay: 1.1, ease: EASING }}
                className="mt-8 flex flex-wrap items-center gap-3 text-xs font-mono text-[var(--color-ash)]"
              >
                <span className="uppercase tracking-widest text-[10px]">Connect:</span>
                {SOCIAL_LINKS.map((link) => {
                  const Icon = SOCIAL_ICONS[link.icon];
                  return (
                    <MagneticSocial key={link.label} href={link.href} label={link.label}>
                      {Icon ? <Icon size={16} /> : link.label}
                    </MagneticSocial>
                  );
                })}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="hover:text-[var(--color-starlight)] transition-colors p-2 -m-1 font-mono text-xs break-all"
                >
                  {CONTACT_EMAIL}
                </a>
              </motion.div>
            </motion.div>

            {/* Right Column — Hero Profile Visual & Metric Cards */}
            <motion.div style={{ y: rightY }} className="lg:col-span-5">
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.4, ease: EASING }}
                className="flex w-full justify-center lg:justify-end"
              >
                {/* Profile card — clean, no orbiting badges. */}
                <div className="relative w-full max-w-sm">
                  {/* Soft animated glow halo behind the card */}
                  <div
                    className="pointer-events-none absolute h-[420px] w-[420px] rounded-full"
                    style={{
                      left: "50%",
                      top: "50%",
                      animation: "hero-halo 6s ease-in-out infinite",
                      background:
                        "radial-gradient(circle, rgba(67,97,238,0.28), transparent 70%)",
                    }}
                    aria-hidden="true"
                  />

                  <TiltCard className="relative z-10 w-full">
                <div className="relative overflow-hidden rounded-3xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] p-4 backdrop-blur-2xl shadow-2xl">
                  {/* HUD corner brackets */}
                  <HudCorners />
                  <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl">
                    <Image
                      src={profilePic}
                      alt="Elroni Quiñones"
                      fill
                      priority
                      className="object-cover transition-transform duration-700 hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-obsidian)] via-transparent to-transparent opacity-80" />

                    {/* Floating Info Overlay */}
                    <div className="absolute bottom-4 left-4 right-4 text-left">
                      <span className="block font-mono text-[10px] uppercase tracking-widest text-[var(--color-accent-warm)]">
                        Engineer & Creative
                      </span>
                      <h2 className="font-display text-lg font-bold text-[var(--color-starlight)]">
                        Elroni Quiñones
                      </h2>
                    </div>
                  </div>

                  {/* Metrics Row — counts up on first view */}
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--color-glass-border)] pt-4 text-center">
                    {METRICS.map((metric, i) => (
                      <div key={metric.label}>
                        <span className="block font-mono text-sm font-bold text-[var(--color-starlight)]">
                          <MetricValue
                            end={metric.end}
                            suffix={metric.suffix}
                            decimals={metric.decimals}
                            delay={1.2 + i * 0.15}
                          />
                        </span>
                        <span className="block font-mono text-[9px] uppercase tracking-wider text-[var(--color-ash)]">
                          {metric.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </TiltCard>
                </div>
              </motion.div>
            </motion.div>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll cue — a gentle animated prompt that fades on first scroll */}
        <motion.div
          style={{ opacity: scrollCueOpacity }}
          className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
          aria-hidden="true"
        >
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.8, ease: "easeOut" }}
            className="flex flex-col items-center gap-2"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-ash)]">
              Scroll
            </span>
            <div className="flex h-9 w-5 items-start justify-center rounded-full border border-[var(--color-glass-border)] p-1.5">
              <div
                style={{ animation: "scroll-cue-dot 1.8s ease-in-out infinite" }}
                className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent-primary)]"
              />
            </div>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
