/**
 * Runtime performance tier detection for adaptive visual quality.
 * Keeps cinematic richness on capable machines while protecting mid-range laptops.
 *
 * DEBUGGING / OVERRIDES
 * ---------------------
 * The detected tier and its reasons are logged to the console once.
 * To force a tier while debugging, either:
 *   · append `?perf=high|medium|low` to the URL, or
 *   · run localStorage.setItem("perf-tier-override", "high") and reload.
 * Clear the override with localStorage.removeItem("perf-tier-override").
 */

export type PerformanceTier = "high" | "medium" | "low";

export interface AdaptiveQuality {
  tier: PerformanceTier;
  dpr: number;
  sparkleCount: number;
  particleBg: number;
  particleMid: number;
  particleFg: number;
  antialias: boolean;
  enableBlur: boolean;
  reduceContinuousFx: boolean;
}

let cached: AdaptiveQuality | null = null;

/** Diagnostic info about WHY a tier was chosen, logged once. */
interface TierReasons {
  cores: number;
  memory: number | undefined;
  isCoarse: boolean;
  reducedMotion: boolean;
  lowDpr: boolean;
  saveData: boolean;
  dpr: number;
}

function getTierOverride(): PerformanceTier | null {
  if (typeof window === "undefined") return null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("perf");
    const stored = window.localStorage.getItem("perf-tier-override");
    const v = fromUrl ?? stored;
    if (v === "high" || v === "medium" || v === "low") return v;
  } catch {
    // localStorage can throw in private mode — overrides are optional.
  }
  return null;
}

export type MotionOverride = "full" | "reduced" | null;

/**
 * Manual override for the OS "reduce motion" preference.
 *
 * WHY: Windows' "Animation effects" toggle (Settings → Accessibility →
 * Visual effects) feeds `prefers-reduced-motion`. When it is OFF — which
 * is common on laptops set up for battery life — the browser reports
 * `reduce`, and this site honourably disables almost every animation:
 * repulsion, signal field ripples, trace lines, fly-ins. The machine is
 * fast enough; the OS just asked for calm. That is indistinguishable from
 * "missing effects" to the person who forgot the toggle exists.
 *
 * Force full motion while debugging with either:
 *   · `?motion=full` in the URL, or
 *   · localStorage.setItem("motion-override", "full") then reload.
 * Clear with localStorage.removeItem("motion-override").
 */
export function getMotionOverride(): MotionOverride {
  if (typeof window === "undefined") return null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("motion");
    const stored = window.localStorage.getItem("motion-override");
    const v = fromUrl ?? stored;
    if (v === "full" || v === "reduced") return v;
  } catch {
    // Ignore — overrides are optional.
  }
  return null;
}

/** The effective reduced-motion state after applying any override. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  const override = getMotionOverride();
  if (override === "full") return false;
  if (override === "reduced") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function detectTier(): { tier: PerformanceTier; reasons: TierReasons } {
  if (typeof window === "undefined") {
    return {
      tier: "medium",
      reasons: { cores: 4, memory: undefined, isCoarse: false, reducedMotion: false, lowDpr: false, saveData: false, dpr: 1 },
    };
  }

  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const isCoarse = window.matchMedia("(pointer: coarse)").matches;
  // Respect the override here too: forcing full motion should also lift the
  // tier, since reduced-motion is what pins it to "low".
  const reducedMotion = prefersReducedMotion();
  const dpr = window.devicePixelRatio || 1;
  const lowDpr = dpr <= 1.25;
  const saveData =
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
      ?.saveData === true;

  const reasons: TierReasons = { cores, memory, isCoarse, reducedMotion, lowDpr, saveData, dpr };

  if (reducedMotion || saveData) return { tier: "low", reasons };
  if (isCoarse && cores <= 4) return { tier: "low", reasons };
  if (cores <= 4 || (memory !== undefined && memory <= 4) || lowDpr) return { tier: "medium", reasons };
  if (cores >= 8 && (memory === undefined || memory >= 8)) return { tier: "high", reasons };
  return { tier: "medium", reasons };
}

export function getAdaptiveQuality(forceRefresh = false): AdaptiveQuality {
  if (cached && !forceRefresh) return cached;

  const override = getTierOverride();
  const detected = detectTier();
  const tier = override ?? detected.tier;
  const dprCap = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;

  // One diagnostic line so it's easy to see what tier was picked and why.
  if (typeof window !== "undefined") {
    const r = detected.reasons;
     
    console.info(
      `[perf] tier: ${tier.toUpperCase()}` +
        (override ? " (forced by override)" : "") +
        ` | cores=${r.cores} mem=${r.memory ?? "?"}GB dpr=${r.dpr.toFixed(2)}` +
        ` coarse=${r.isCoarse} reducedMotion=${r.reducedMotion} saveData=${r.saveData}`,
    );
  }

  const table: Record<PerformanceTier, AdaptiveQuality> = {
    high: {
      tier: "high",
      dpr: Math.min(dprCap, 1.5),
      sparkleCount: 90,
      particleBg: 420,
      particleMid: 200,
      particleFg: 60,
      antialias: false,
      enableBlur: true,
      reduceContinuousFx: false,
    },
    medium: {
      tier: "medium",
      dpr: 1,
      sparkleCount: 48,
      particleBg: 280,
      particleMid: 140,
      particleFg: 40,
      antialias: false,
      enableBlur: true,
      reduceContinuousFx: false,
    },
    low: {
      tier: "low",
      dpr: 1,
      sparkleCount: 24,
      particleBg: 140,
      particleMid: 70,
      particleFg: 20,
      antialias: false,
      enableBlur: false,
      reduceContinuousFx: true,
    },
  };

  cached = table[tier];
  return cached;
}

/** True when the element is near/in the viewport (with rootMargin slack). */
export function observeVisibility(
  element: Element,
  onChange: (visible: boolean) => void,
  rootMargin = "20% 0px"
): () => void {
  if (typeof IntersectionObserver === "undefined") {
    onChange(true);
    return () => undefined;
  }

  const observer = new IntersectionObserver(
    ([entry]) => onChange(entry.isIntersecting),
    { rootMargin, threshold: 0 }
  );
  observer.observe(element);
  return () => observer.disconnect();
}
