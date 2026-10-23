"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useScroll } from "framer-motion";
import SmoothScrollProvider from "@/components/providers/SmoothScrollProvider";
import EvaNavbar from "@/components/eva/EvaNavbar";
import EvaHero from "@/components/eva/EvaHero";
import EvaAbout from "@/components/eva/EvaAbout";
import EvaProjects from "@/components/eva/EvaProjects";
import EvaTechStack from "@/components/eva/EvaTechStack";
import EvaExperience from "@/components/eva/EvaExperience";
import EvaContact from "@/components/eva/EvaContact";
import { observeVisibility } from "@/lib/performance";
import { asset } from "@/lib/assets";
import SceneBoundary from "@/components/ui/SceneBoundary";

// Heavy below-fold sections — defer parse until after first paint
const GithubContributions = dynamic(
  () => import("@/components/sections/GithubContributions"),
  { ssr: false }
);
const Certifications = dynamic(
  () => import("@/components/sections/Certifications"),
  { ssr: false }
);

// The persistent holographic fox trio — the same JourneyModel classic mode
// runs, so EVA inherits the full rework: slow box-slice glitch bursts on
// the main model, more frequent side-model glitches, trace scan-lines on
// all three holograms, wire-multiplier gating, reduced-effects support.
// It reads the live design tokens itself (useTheme → design === "eva"),
// so the hologram re-colours to EVA green/orange with no prop plumbing.
const JourneyModel = dynamic(() => import("@/components/three/JourneyModel"), {
  ssr: false,
});

// Preload the GLB model so it's cached before the canvas mounts.
// Must match the file JourneyModel requests (see MODEL_URL there).
if (typeof window !== "undefined") {
  import("@react-three/drei").then(({ useGLTF }) => {
    useGLTF.preload(asset("/3d/model_c.glb"));
  });
}

export default function EvaLayout() {
  // One scroll-progress value spanning Hero → About → GitHub archive
  // (EVA's opening three chapters, in the same order classic runs them)
  // drives the fox's whole journey in JourneyModel: hologram trio in the
  // hero, solid bust through About + the archive, fade-out at its end.
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
    <SmoothScrollProvider weight="heavy">
      <div className="relative min-h-screen overflow-hidden bg-[var(--color-void)] font-mono text-[var(--color-pearl)]">
        {/* MAGI Hexagon Grid Background — static CSS, zero JS cost */}
        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='103.92' viewBox='0 0 60 103.92' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l30 17.32v34.64L30 69.28 0 51.96V17.32zM30 103.92l30-17.32V51.96l-30-17.32-30 17.32v34.64z' fill='%234361ee' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
            backgroundSize: "60px 103px",
          }}
          aria-hidden
        />

        {/* Persistent holographic fox — fixed canvas behind the opening acts.
            DOM order puts it above the z-0 hex grid; the z-[2] scan line and
            border frame plus the z-10 main content all stay on top of it. */}
        <SceneBoundary>
          <JourneyModel progress={scrollYProgress} active={journeyActive} />
        </SceneBoundary>

        {/* Vertical Tactical Scanning Line — top-0 anchors it for the
            transform-based scan-down sweep (see globals.css). */}
        <div
          className="pointer-events-none fixed right-0 left-0 top-0 z-[2] h-[2px] bg-gradient-to-r from-transparent via-[var(--color-accent-primary)] to-transparent opacity-20 animate-[scan-down_10s_linear_infinite]"
          aria-hidden
        />

        {/* Tactical HUD Corner Warning Borders */}
        <div
          className="pointer-events-none fixed inset-0 z-[2] border border-[var(--color-accent-primary)]/10"
          aria-hidden
        />

        <EvaNavbar />

        {/* Same running order as Classic, so switching design themes never
            reshuffles the story. The commit archive follows IDENTITY in both
            modes: it reads as evidence for the profile that precedes it. */}
        <main className="relative z-10">
          {/* ACT I — INTRO */}
          {/* Journey wrapper: the fox's scroll progress is measured across
              Hero → About → GitHub archive (Ch.01–03), same arc as classic.
              The model stays present through all three chapters and fades
              out only at the very end of the GitHub archive. */}
          <div ref={journeyRef}>
            <EvaHero />
            <EvaAbout />
            <GithubContributions />
          </div>
          <EvaTechStack />

          {/* ACT II — CERTIFICATIONS */}
          <Certifications />

          {/* ACT III — PROJECTS */}
          <EvaProjects />

          {/* ACT IV — EXPERIENCE */}
          <EvaExperience />

          {/* ACT V — CONTACT — EVA's own comms uplink: the GOBOLD
              composition with the left-dominant zoomed globe pane
              (CRT/VHS stack) and the right-shifted bay deck. */}
          <EvaContact />
        </main>
      </div>
    </SmoothScrollProvider>
  );
}
