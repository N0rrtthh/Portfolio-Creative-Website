"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Canvas } from "@react-three/fiber";
import { AnimatePresence } from "framer-motion";
import ChapterLabel from "@/components/ui/ChapterLabel";
import {
  NODE_THRESHOLDS,
  TIMELINE_DATA,
  TIMELINE_SCROLL_VH,
} from "@/data/experience";
import { useSectionProgress } from "@/lib/hooks/useSectionProgress";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { useLenis } from "@/components/providers/SmoothScrollProvider";
import { getAdaptiveQuality, observeVisibility } from "@/lib/performance";

import DossierModal from "./DossierModal";
import NodeCard from "./NodeCard";
import TimelineScene from "./TimelineScene";
import WaypointNav from "./WaypointNav";

/** Maps raw scroll progress to the active node index. */
function nodeForProgress(progress: number) {
  for (let i = 0; i < NODE_THRESHOLDS.length; i++) {
    if (progress < NODE_THRESHOLDS[i]) return i;
  }
  return NODE_THRESHOLDS.length;
}

/**
 * "My Experience" — a sticky flight-path timeline.
 *
 * Performance contract:
 *  • Scroll progress flows through a ref, so scrolling causes no React renders.
 *    The only state that changes is `activeNode` (4 times across 320vh).
 *  • The dossier card is real DOM positioned by a single transform write from
 *    the r3f frame loop, instead of drei's <Html> (which reads layout and
 *    writes a matrix3d every frame for every mounted card).
 *  • The WebGL loop is fully parked (`frameloop="never"`) whenever the section
 *    is outside the viewport or the dossier modal is open.
 */
export default function ExperienceTimeline() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardHostRef = useRef<HTMLDivElement>(null);

  const [activeNode, setActiveNode] = useState(0);
  const [inspectedNode, setInspectedNode] = useState<number | null>(null);
  const [inView, setInView] = useState(false);
  const [mounted, setMounted] = useState(false);

  const lenis = useLenis();
  const quality = useMemo(() => getAdaptiveQuality(), []);


  const handleProgress = useCallback((progress: number) => {
    const next = nodeForProgress(progress);
    setActiveNode((prev) => (prev === next ? prev : next));
  }, []);

  const { progressRef, scrollToProgress } = useSectionProgress(
    sectionRef,
    handleProgress
  );

  // Defer canvas + portal until after first paint.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Park the render loop while the section is offscreen.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    return observeVisibility(el, setInView, "25% 0px");
  }, []);

  // Lock page scroll while the dossier is open.
  // `overflow: hidden` alone is not enough: Lenis drives scroll from its own
  // rAF loop and keeps going straight through it. The shared hook stops the
  // instance and pins the body, so the timeline cannot advance underneath.
  useScrollLock(inspectedNode !== null, lenis);


  const handleWaypoint = useCallback(
    (index: number) => scrollToProgress(TIMELINE_DATA[index].scrollTarget),
    [scrollToProgress]
  );

  const closeDossier = useCallback(() => setInspectedNode(null), []);
  const inspectActive = useCallback(
    () => setInspectedNode(activeNode),
    [activeNode]
  );

  const activeItem = TIMELINE_DATA[activeNode];
  const inspectedItem = inspectedNode !== null ? TIMELINE_DATA[inspectedNode] : null;
  const renderScene = inView && inspectedNode === null;

  return (
    <section
      id="experience"
      ref={sectionRef}
      className="relative w-full bg-[#05060b]"
      style={{ height: `${TIMELINE_SCROLL_VH}vh` }}
    >
      {mounted &&
        createPortal(
          <AnimatePresence>
            {inspectedItem && (
              <DossierModal
                key={inspectedItem.id}
                item={inspectedItem}
                onClose={closeDossier}
              />
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Sticky viewport frame — `h-svh`, not `h-screen`: on mobile
          browsers 100vh includes the area behind the expanded URL
          bar, which clipped the frame's bottom edge. */}
      <div className="sticky top-0 left-0 h-svh w-full overflow-hidden">
        {/* Header overlay */}
        <div className="pointer-events-none absolute top-16 left-0 z-20 w-full px-6 md:top-20 md:px-12">
          <div className="mx-auto max-w-7xl">
            <ChapterLabel
              index={7}
              classic="Experience"
              eva="MISSION LOG"
              className="mb-1"
            />
            <h2 className="font-brand text-2xl font-bold uppercase tracking-tight text-white md:text-3xl">
              My Experience
            </h2>
          </div>
        </div>

        <WaypointNav activeNode={activeNode} onSelect={handleWaypoint} />


        {/* Dossier card — positioned imperatively by the scene */}
        <div
          ref={cardHostRef}
          className="absolute top-0 left-0 z-10 will-change-transform"
          style={{ opacity: 0, visibility: "hidden", pointerEvents: "none" }}
        >
          <NodeCard item={activeItem} onInspect={inspectActive} />
        </div>

        {/* 3D WebGL canvas */}
        <div className="absolute inset-0 z-0">
          {mounted && (
            <Canvas
              camera={{ position: [0, 0, 14], fov: 60 }}
              /* Full-screen emissive scene — fragment cost dominates, so the
                 backing store stays at 1x regardless of device pixel ratio. */
              dpr={1}
              frameloop={renderScene ? "always" : "never"}
              gl={{
                antialias: quality.antialias,
                alpha: false,
                powerPreference: "high-performance",
                stencil: false,
                depth: true,
              }}
              /* `touchAction: "none"` here swallowed vertical swipes: the
                 canvas covers the whole sticky viewport, and this section is
                 scroll-driven over ~280vh, so on a phone the timeline could
                 not be advanced or scrolled past at all. `pan-y` keeps the
                 canvas from hijacking the gesture while still blocking
                 horizontal pan / double-tap zoom. */
              style={{ touchAction: "pan-y" }}
            >
              <TimelineScene
                progressRef={progressRef}
                activeNode={activeNode}
                quality={quality}
                cardHostRef={cardHostRef}
              />
            </Canvas>
          )}
        </div>
      </div>
    </section>
  );
}
