"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useScroll } from "framer-motion";
import SmoothScrollProvider from "@/components/providers/SmoothScrollProvider";
import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/sections/Hero";
import AboutStory from "@/components/sections/AboutStory";
import TechStack from "@/components/sections/TechStack";
import Projects from "@/components/sections/Projects";
import Contact from "@/components/sections/Contact";
import { TIMELINE_SCROLL_VH } from "@/data/experience";
import { observeVisibility } from "@/lib/performance";
import { asset } from "@/lib/assets";
import SceneBoundary from "@/components/ui/SceneBoundary";
import { useNearViewport } from "@/lib/hooks/useNearViewport";
import { useChapterSnap } from "@/lib/hooks/useChapterSnap";

/* ══════════════════════════════════════════════════════════
   Classic running order
   ──────────────────────────────────────────────────────────
   Five acts, in this order: INTRO → CERTIFICATIONS → PROJECTS →
   EXPERIENCE → CONTACT.

   The sections that aren't act headings sit with the act they
   support rather than standing alone: the GitHub archive follows
   "Who I Am" (the same identity claim, measured instead of
   narrated), Tech Stack closes the intro (what I work with), and
   the Hologram showcase closes Projects (it IS work).
   ══════════════════════════════════════════════════════════ */

// Heavy / below-fold sections: defer JS parse+eval until after first paint.
// The placeholder reserves the section's *real* height so resolving the chunk
// doesn't shift ~280vh of layout out from under an in-progress scroll.
function ExperiencePlaceholder({ ref }: { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      id="experience"
      className="relative w-full bg-[#05060b]"
      style={{ height: `${TIMELINE_SCROLL_VH}vh` }}
      aria-hidden
    />
  );
}
const Experience = dynamic(() => import("@/components/sections/Experience"), {
  ssr: false,
  loading: () => <ExperiencePlaceholder />,
});

/* The 3D flight-path timeline is mounted only when the reader is about a
   screen and a half away. Rendering it at page load meant its chunk and
   WebGL context booted during the hero, competing with the intro. */
function DeferredExperience() {
  const [ref, near] = useNearViewport<HTMLDivElement>("150% 0px");
  return near ? <Experience /> : <ExperiencePlaceholder ref={ref} />;
}
const GithubContributions = dynamic(
  () => import("@/components/sections/GithubContributions"),
  { ssr: false }
);
const Certifications = dynamic(
  () => import("@/components/sections/Certifications"),
  { ssr: false }
);
const HologramShowcase = dynamic(
  () => import("@/components/sections/HologramShowcase"),
  { ssr: false }
);

// The persistent holographic fox trio: opens in the Hero (Ch.01) with a
// centre model flanked by two background models, then ONLY the centre model
// travels into About (Ch.02) and stays present through the GitHub archive
// (Ch.03), fading out only at the very end of that chapter.
const JourneyModel = dynamic(() => import("@/components/three/JourneyModel"), {
  ssr: false,
});

// Preload the GLB model so it's cached before the canvas mounts.
// Must match the exact filename used by JourneyModel: model_c.glb (the fox).
if (typeof window !== "undefined") {
  import("@react-three/drei").then(({ useGLTF }) => {
    useGLTF.preload(asset("/3d/model_c.glb"));
  });
}

/* Magnetic chapter stop points — one per act heading (plus the GitHub
   archive, which reads as its own beat). The Hologram showcase is part of
   the Projects act and stays free-scrolling. Module scope so the array
   identity never changes between renders. */
const CHAPTER_SNAP_IDS = [
  "hero",
  "about",
  "github-activity",
  "techstack",
  "certifications",
  "projects",
  "experience",
  "contact",
] as const;

/** Must render INSIDE the SmoothScrollProvider to reach the Lenis instance. */
function ChapterSnapper() {
  useChapterSnap(CHAPTER_SNAP_IDS);
  return null;
}

export default function ClassicLayout() {
  // One scroll-progress value spanning Hero → About → GitHub archive drives
  // the fox's whole journey (position / scale / opacity / spin) in
  // JourneyModel. The model stays present through Ch.02 and Ch.03 and fades
  // out only at the very end of the GitHub archive.
  const journeyRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: journeyRef,
    offset: ["start start", "end end"],
  });

  // Pause the fox's render loop once the journey scrolls fully out of view.
  const [journeyActive, setJourneyActive] = useState(true);
  useEffect(() => {
    const el = journeyRef.current;
    if (!el) return;
    return observeVisibility(el, setJourneyActive, "0px 0px");
  }, []);

  return (
    <SmoothScrollProvider>
      <ChapterSnapper />
      <Navbar />

      {/* Persistent holographic fox — fixed canvas behind the opening acts. */}
      <SceneBoundary>
        <JourneyModel progress={scrollYProgress} active={journeyActive} />
      </SceneBoundary>

      <main>
        {/* ── ACT I — INTRO ──────────────────────────────── */}
        {/* Journey wrapper: the fox's scroll progress is measured across
            Hero → About → GitHub archive (Ch.01–03). The model stays
            present through all three chapters and fades out only at the
            very end of the GitHub archive. */}
        <div ref={journeyRef}>
          <Hero />
          <AboutStory />
          <GithubContributions />
        </div>
        <TechStack />

        {/* ── ACT II — CERTIFICATIONS ────────────────────── */}
        <Certifications />

        {/* ── ACT III — PROJECTS ─────────────────────────── */}
        <Projects />
        <SceneBoundary>
          <HologramShowcase />
        </SceneBoundary>

        {/* ── ACT IV — EXPERIENCE ────────────────────────── */}
        <DeferredExperience />

        {/* ── ACT V — CONTACT ────────────────────────────── */}
        <Contact />
      </main>
    </SmoothScrollProvider>
  );
}
