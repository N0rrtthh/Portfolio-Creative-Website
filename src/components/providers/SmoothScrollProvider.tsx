"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { prefersReducedMotion } from "@/lib/performance";

const LenisContext = createContext<Lenis | null>(null);

export function useLenis() {
  return useContext(LenisContext);
}

export default function SmoothScrollProvider({
  children,
  weight = "normal",
}: {
  children: React.ReactNode;
  weight?: "normal" | "heavy";
}) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Override-aware: `?motion=full` restores smooth scrolling even when
    // the OS asks for reduced motion.
    if (prefersReducedMotion()) return;

    const isHeavy = weight === "heavy";

    // Premium heavy scroll — high travel distance, slow lerp momentum
    // lerp: how fast it catches up to target (lower = more lag/inertia)
    // wheelMultiplier: how far each scroll tick moves (higher = more travel)
    const instance = new Lenis(
      isHeavy
        ? {
            lerp: 0.055,
            wheelMultiplier: 1.35,
            touchMultiplier: 1.6,
            smoothWheel: true,
            syncTouch: false,
          }
        : {
            lerp: 0.075,
            wheelMultiplier: 1.12,
            touchMultiplier: 1.5,
            smoothWheel: true,
            syncTouch: false,
          }
    );

    // Defer state update to avoid cascading renders from synchronous setState in effect
    const id = requestAnimationFrame(() => setLenis(instance));

    function raf(time: number) {
      instance.raf(time);
      rafRef.current = requestAnimationFrame(raf);
    }
    rafRef.current = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(id);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      instance.destroy();
      setLenis(null);
    };
  }, [weight]);

  return (
    <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>
  );
}
