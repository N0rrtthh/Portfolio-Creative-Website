"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowUpRight, ShieldAlert, Cpu } from "lucide-react";
import MagneticButton from "@/components/ui/MagneticButton";
import ChapterLabel from "@/components/ui/ChapterLabel";
import AnimeText from "@/components/ui/AnimeText";
import AnimeStaggerGrid from "@/components/ui/AnimeStaggerGrid";
import TiltCard from "@/components/ui/TiltCard";
import { GitHubIcon, XIcon } from "@/components/ui/BrandIcons";
import { CONTACT_EMAIL, SOCIAL_LINKS } from "@/lib/data";
import { useTheme } from "@/components/providers/ThemeProvider";
import profilePic from "@/../public/profile.jpg";

const ParticleField = dynamic(() => import("@/components/three/ParticleField"), {
  ssr: false,
});

import TypewriterRole from "@/components/ui/TypewriterRole";

const EASING = [0.22, 1, 0.36, 1] as const;

const METRICS = [
  { value: "12+", label: "Projects Shipped" },
  { value: "4+ Yrs", label: "Building & Crafting" },
  { value: "99.9%", label: "Production Stability" },
];

export default function Hero() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { setDesign } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

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

  // GPU-only scroll exit: opacity + transform. Avoid animating filter:blur
  // (forces continuous paint/composite on every scroll frame).
  //
  // The old fade drove opacity to 0 at ~35% of a 160svh pinned scroll, which
  // left the remaining ~65% as an invisible hero — a tall empty dark band
  // before "Ch. 02 — Who I Am". The hero now stays fully opaque through the
  // pin and only fades as it physically scrolls out of view, so there is no
  // empty gap: the hero fills the screen right up until the next section.
  const contentOpacity = useTransform(scrollYProgress, [0.5, 0.92], [1, 0]);
  const contentBlur = useTransform(scrollYProgress, [0.5, 0.92], [0, 12]);
  const contentScale = useTransform(scrollYProgress, [0.5, 0.95], [1, 0.92]);
  const contentY = useTransform(scrollYProgress, [0.5, 0.95], [0, -60]);

  const glowOpacity = useTransform(scrollYProgress, [0.4, 0.8], [0.18, 0]);
  const glowY = useTransform(scrollYProgress, [0.5, 0.95], [0, -90]);

  return (
    <div ref={wrapRef} id="hero" className="relative min-h-svh">
      <section className="flex min-h-svh flex-col overflow-hidden py-16 justify-center">
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

        {/* Bottom gradient fade */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(180deg, transparent 55%, var(--color-void) 100%)",
          }}
          aria-hidden="true"
        />

        {/* Main Hero Content */}
        <motion.div
          style={{
            opacity: contentOpacity,
            scale: contentScale,
            y: contentY,
            filter: useTransform(contentBlur, (v) => v > 0.1 ? `blur(${v}px)` : "none"),
          }}
          className="container-narrow relative z-10 flex flex-1 flex-col justify-center my-auto will-change-transform transform-gpu"
        >
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            {/* Left Column — Text & Identity */}
            <div className="lg:col-span-7">
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
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 rounded-full border border-dashed border-purple-400/40 pointer-events-none"
                    />

                    {/* Animated Pulsing Icon */}
                    <motion.div
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Cpu size={14} className="text-purple-400 group-hover:text-purple-300 transition-colors" />
                    </motion.div>
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
                        <ShieldAlert size={10} className="text-purple-400 animate-pulse" />
                        <span>OVERRIDE TERMINAL // EVA</span>
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
              <div className="h-10 my-4 flex items-center">
                <TypewriterRole />
              </div>

              {/* Concise Personal Introduction */}
              <motion.p
                initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
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
                    href="#contact"
                    className="rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] px-7 py-3.5 font-body text-sm font-medium text-[var(--color-silver)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-[250ms] ease-out hover:border-[var(--color-accent-primary)] hover:text-[var(--color-starlight)] hover:shadow-[0_8px_30px_rgba(67,97,238,0.15)] will-change-transform transform-gpu active:scale-[0.97]"
                  >
                    Get in touch <ArrowUpRight className="inline-block h-4 w-4 ml-1 opacity-70" />
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
                {SOCIAL_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[var(--color-starlight)] transition-colors p-1"
                    aria-label={link.label}
                  >
                    {link.icon === "github" ? <GitHubIcon size={16} /> : <XIcon size={16} />}
                  </a>
                ))}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="hover:text-[var(--color-starlight)] transition-colors p-1 font-mono text-xs break-all"
                >
                  {CONTACT_EMAIL}
                </a>
              </motion.div>
            </div>

            {/* Right Column — Hero Profile Visual & Metric Cards */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 0.4, ease: EASING }}
              className="lg:col-span-5 flex justify-center lg:justify-end"
            >
              <TiltCard className="w-full max-w-sm">
                <div className="relative overflow-hidden rounded-3xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] p-4 backdrop-blur-2xl shadow-2xl">
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

                  {/* Metrics Row */}
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--color-glass-border)] pt-4 text-center">
                    {METRICS.map((metric) => (
                      <div key={metric.label}>
                        <span className="block font-mono text-sm font-bold text-[var(--color-starlight)]">
                          {metric.value}
                        </span>
                        <span className="block font-mono text-[9px] uppercase tracking-wider text-[var(--color-ash)]">
                          {metric.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </TiltCard>
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          style={{ opacity: contentOpacity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 pointer-events-none"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-ash)]">
            Scroll to explore narrative
          </span>
          <ArrowDown className="h-3.5 w-3.5 text-[var(--color-silver)] animate-bounce" />
        </motion.div>
      </section>
    </div>
  );
}
