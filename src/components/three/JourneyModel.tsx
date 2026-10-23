"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useTransform, type MotionValue } from "framer-motion";
import { useTheme } from "@/components/providers/ThemeProvider";
import { getAdaptiveQuality } from "@/lib/performance";
import { asset } from "@/lib/assets";

/**
 * JourneyModel — a persistent companion for the opening three chapters.
 *
 * HERO (Ch.01) — TECHY HOLOGRAM TRIO:
 *   · the MAIN model sits slightly RIGHT of centre — a particle cloud
 *     plus TRACING LINES: the model's own wireframe edges lit by a scan
 *     band that sweeps up the character (bright head, fading trail),
 *     like the lines are tracing the model into existence. GPU-only —
 *     one draw call, one time uniform per frame.
 *   · two supporting models slide in from the far left and far right,
 *     angled inward, visible but subordinate.
 *   · Mouse parallax is ACTIVE ONLY HERE.
 *   · All three models bob up and down on smooth sines — the same
 *     single-sine feel as the Contact globe.
 *   · Slow box-slice GLITCH bursts: chunky box blocks of the model
 *     jump sideways in the vertex shaders, the model offsets on X and
 *     flickers — like a corrupted hologram. The two background models
 *     run their own, more frequent glitch schedule.
 *   · Side models also run the tracing scan-line shader (dimmer,
 *     single pass) so all three holograms share the same language.
 *
 * ABOUT (Ch.02) + GITHUB ARCHIVE (Ch.03) — GREY SOLID:
 *   · the model turns into a solid grey bust, right-of-centre but NOT
 *     hugging the wall, clear of the About text column. Stays solid
 *     through Ch.03, fades only at the very end.
 *
 * Performance: point clouds are sampled (every Nth vertex). All hero-only
 * elements are hidden via `visible` once the journey enters Ch.02 so they
 * cost zero draw calls. No per-frame geometry rebuilds, no CPU particle
 * updates — the trace animation lives entirely in the fragment shader.
 */

const MODEL_URL = asset("/3d/model_c.glb");

/** Find the first mesh geometry in a loaded scene graph. */
function extractGeometry(scene: THREE.Object3D): THREE.BufferGeometry | null {
  let found: THREE.BufferGeometry | null = null;
  scene.traverse((obj) => {
    if (!found && (obj as THREE.Mesh).isMesh) {
      found = (obj as THREE.Mesh).geometry;
    }
  });
  return found;
}

/** Sample every Nth vertex from a geometry to reduce point count. */
function sampleGeometry(geo: THREE.BufferGeometry, stride: number): THREE.BufferGeometry {
  const pos = geo.getAttribute("position");
  if (!pos) return geo;
  const count = Math.floor(pos.count / stride);
  const sampled = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const srcIdx = i * stride;
    sampled[i * 3] = pos.getX(srcIdx);
    sampled[i * 3 + 1] = pos.getY(srcIdx);
    sampled[i * 3 + 2] = pos.getZ(srcIdx);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(sampled, 3));
  return g;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/* ── Tracing-line shaders ──────────────────────────────────────────────
   A scan band sweeps up the model (feet → head, looping). Lines glow
   bright as the band passes and fade behind it — reads as the wireframe
   being traced. Everything is computed in the shader; the CPU only
   updates `uTime` and `uOpacity` once per frame. */
/* ── GLITCH — box slice ────────────────────────────────────────────
   Shared vertex displacement: the model is divided into a grid of
   chunky rectangular BOXES (x bands × y bands); while uGlitch > 0,
   random boxes jump sideways (with a slight vertical lift) as a unit.
   uGlitchSeed reshuffles which boxes move, uGlitchAmp scales the
   shift relative to model height. GLITCH_DISPLACE gets injected into
   the point-cloud materials via onBeforeCompile; TRACE_VERT inlines
   the same math. */
const GLITCH_PARS = /* glsl */ `
  uniform float uGlitch;
  uniform float uGlitchSeed;
  uniform float uGlitchAmp;
`;

const GLITCH_DISPLACE = /* glsl */ `
  if (uGlitch > 0.001) {
    float gBoxX = floor(position.x * 3.0 + uGlitchSeed * 13.1);
    float gBoxY = floor(position.y * 4.0 + uGlitchSeed * 31.7);
    float gBoxId = gBoxY * 7.31 + gBoxX;
    float gRnd = fract(sin(gBoxId * 12.9898 + uGlitchSeed * 78.233) * 43758.5453);
    float gGate = step(0.55, fract(gRnd * 5.7 + uGlitchSeed * 0.31));
    float gShift = (fract(gRnd * 3.31) - 0.5) * 2.0;
    float gLift = (fract(gRnd * 9.13) - 0.5) * 0.6;
    transformed.x += gShift * gGate * uGlitch * uGlitchAmp;
    transformed.y += gLift * gGate * uGlitch * uGlitchAmp;
  }
`;

const TRACE_VERT = /* glsl */ `
  ${GLITCH_PARS}
  varying vec3 vPos;
  void main() {
    vec3 pos = position;
    if (uGlitch > 0.001) {
      float gBoxX = floor(pos.x * 3.0 + uGlitchSeed * 13.1);
      float gBoxY = floor(pos.y * 4.0 + uGlitchSeed * 31.7);
      float gBoxId = gBoxY * 7.31 + gBoxX;
      float gRnd = fract(sin(gBoxId * 12.9898 + uGlitchSeed * 78.233) * 43758.5453);
      float gGate = step(0.55, fract(gRnd * 5.7 + uGlitchSeed * 0.31));
      float gShift = (fract(gRnd * 3.31) - 0.5) * 2.0;
      float gLift = (fract(gRnd * 9.13) - 0.5) * 0.6;
      pos.x += gShift * gGate * uGlitch * uGlitchAmp;
      pos.y += gLift * gGate * uGlitch * uGlitchAmp;
    }
    vPos = pos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const TRACE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uMinY;
  uniform float uHeight;
  varying vec3 vPos;

  uniform float uBoost;   // 1.0 = core pass, <1 = soft halo pass
  uniform float uScan;    // 1.0 = animated upward wipe, 0.0 = static wireframe

  void main() {
    float ny = (vPos.y - uMinY) / uHeight;        // 0 at base, 1 at top
    float phase = fract(ny - uTime * 0.16);       // band traveling upward
    float trail = pow(1.0 - phase, 2.2) * uScan;  // 0 in the static pass
    float base = mix(0.5, 0.10, uScan);           // static pass: visible skeleton, no band
    float alpha = (base + trail * 1.6) * uOpacity * uBoost;
    // Overdrive the color on the trail for an additive glow bloom.
    vec3 col = uColor * mix(1.0, 0.7 + trail * 2.0, uScan);
    gl_FragColor = vec4(col, alpha);
  }
`;

/* ── MAIN model journey ────────────────────────────────────────────────
   Slightly right of centre in hero, then right-of-centre in Ch.02+ but
   NOT hugging the right wall — clear of the About text column. */
const STOPS = [0, 0.3, 0.5, 0.66, 0.95, 1];
const POS_X = [0.5, 0.7, 1.9, 2.1, 2.2, 2.2];
const POS_Y = [0, 0, 0.05, 0.08, 0.1, 0.1];
const SCALE = [2.4, 2.3, 1.7, 1.6, 1.55, 1.55];
const OPACITY = [1, 1, 1, 1, 1, 0];

/* Particle/lines → solid grey crossfade at the Ch.02 boundary. */
const SOLID_STOPS = [0, 0.3, 0.45, 0.95, 1];
const SOLID_OPACITY = [0, 0, 0.7, 0.7, 0];
const WIRE_MULT = [1, 1, 0, 0, 0];

/* ── BACKGROUND side models: visible only in the hero ──
   Opacity raised from 0.32 → 0.55 so they read clearly as background
   companions, but the dim color + additive blending keeps them well
   below the brightness of the hero text. */
const SIDE_STOPS = [0, 0.22, 0.33, 1];
const SIDE_OPACITY = [0.55, 0.55, 0, 0];

/* Side models: visible, angled inward, pushed back.
   Both sit at the FAR edges of the frame — the left one hugs the far
   left, the right one the far right — so the main centre model owns
   the stage. Left renders as a DITHERED point cloud (jittered grain),
   right as a clean POINT cloud, so the trio reads as three distinct
   hologram styles. */
const SIDE_REST_X_L = 5.2;
const SIDE_REST_X_R = 4.8;
const SIDE_Z = -2.2;
const SIDE_SCALE = 1.4;
const SIDE_ENTER_FROM = 9.0;
const SIDE_Y_OFFSET_L = -0.45;
const SIDE_Y_OFFSET_R = -0.25;

/* Point sizing. */
const MAIN_POINT_SIZE = 0.04;
const SIDE_POINT_SIZE = 0.038;

function FoxTrio({
  mainX,
  mainY,
  mainS,
  mainO,
  spin,
  solidOp,
  wireMult,
  sideO,
  solidColor,
  sparkColor,
  sideSparkColor,
}: {
  mainX: MotionValue<number>;
  mainY: MotionValue<number>;
  mainS: MotionValue<number>;
  mainO: MotionValue<number>;
  spin: MotionValue<number>;
  solidOp: MotionValue<number>;
  wireMult: MotionValue<number>;
  sideO: MotionValue<number>;
  solidColor: string;
  sparkColor: string;
  sideSparkColor: string;
}) {
  const { scene } = useGLTF(MODEL_URL);
  const viewport = useThree((s) => s.viewport);

  const mainRef = useRef<THREE.Group>(null);
  const leftRef = useRef<THREE.Group>(null);
  const rightRef = useRef<THREE.Group>(null);
  const solidRef = useRef<THREE.MeshStandardMaterial>(null);
  const sparkMainRef = useRef<THREE.PointsMaterial>(null);
  const leftPointsMatRef = useRef<THREE.PointsMaterial>(null);
  const sparkRightRef = useRef<THREE.PointsMaterial>(null);
  const traceLinesRef = useRef<THREE.LineSegments>(null);
  const traceMatRef = useRef<THREE.ShaderMaterial>(null);
  const haloLinesRef = useRef<THREE.LineSegments>(null);
  const haloMatRef = useRef<THREE.ShaderMaterial>(null);
  const leftTraceMatRef = useRef<THREE.ShaderMaterial>(null);
  const rightTraceMatRef = useRef<THREE.ShaderMaterial>(null);

  const mouse = useRef({ x: 0, y: 0 });
  /* Glitch burst schedule: next trigger time, burst window, box seed,
     and the per-shuffle jitter/flicker values. */
  const glitchRef = useRef({
    next: 3.0,
    start: -10,
    end: -10,
    dur: 0.4,
    seed: 0,
    lastShuffle: 0,
    jx: 0,
    dip: 0,
  });
  /* SIDE models get their own, MORE FREQUENT glitch schedule. */
  const sideGlitchRef = useRef({
    next: 2.0,
    start: -10,
    end: -10,
    dur: 0.4,
    seed: 0,
    lastShuffle: 0,
    jx: 0,
    dip: 0,
  });
  const intro = useRef(0);
  const rotAccum = useRef(0);
  const lastSpin = useRef(0);
  const quality = useMemo(() => getAdaptiveQuality(), []);

  const geometry = useMemo(() => {
    const geo = extractGeometry(scene);
    if (!geo) return null;
    const g = geo.clone();
    g.center();
    g.computeVertexNormals();
    return g;
  }, [scene]);

  /* Sampled point clouds — fewer particles for performance. */
  const pointsGeo = useMemo(() => {
    if (!geometry) return null;
    return sampleGeometry(geometry, 4);
  }, [geometry]);

  const sidePointsGeo = useMemo(() => {
    if (!geometry) return null;
    return sampleGeometry(geometry, 6);
  }, [geometry]);

  /* Left model: DITHERED point cloud — sampled vertices with a small
     random jitter per point so the surface reads as grain/dither rather
     than a clean scan. Deterministic seed so it doesn't re-scatter on
     re-render. */
  const sideDitherGeo = useMemo(() => {
    if (!geometry) return null;
    const base = sampleGeometry(geometry, 5);
    const pos = base.getAttribute("position");
    const jittered = new Float32Array(pos.count * 3);
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed / 2147483647) * 2 - 1;
    };
    for (let i = 0; i < pos.count; i++) {
      jittered[i * 3] = pos.getX(i) + rand() * 0.03;
      jittered[i * 3 + 1] = pos.getY(i) + rand() * 0.03;
      jittered[i * 3 + 2] = pos.getZ(i) + rand() * 0.03;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(jittered, 3));
    return g;
  }, [geometry]);

  /* The model's own edges — the lines that get traced. Low threshold
     angle (8°) picks up MORE edges for a denser, larger-scale trace. */
  const edges = useMemo(() => {
    if (!geometry) return null;
    return new THREE.EdgesGeometry(geometry, 8);
  }, [geometry]);

  /* Model vertical bounds — normalizes the scan band in the shader. */
  const bounds = useMemo(() => {
    if (!geometry) return { minY: -1, height: 2 };
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    if (!bb) return { minY: -1, height: 2 };
    return { minY: bb.min.y, height: Math.max(0.001, bb.max.y - bb.min.y) };
  }, [geometry]);

  /* Trace shader uniforms — one time uniform drives the whole effect.
     Two passes share the shader: a bright CORE and a slightly enlarged,
     softer HALO that fakes thicker lines + glow (no postprocessing). */
  /* ── GLITCH uniforms — one envelope drives the slice tear across all
     hologram materials (trace lines + all three point clouds). Amp is
     scaled to model height so the tear reads proportionally. Held in a
     ref (not useMemo) because useFrame mutates the values per frame. ── */
  const glitchUniforms = useRef({
    uGlitch: { value: 0 },
    uGlitchSeed: { value: 0 },
    uGlitchAmp: { value: 0.12 },
  });
  useEffect(() => {
    glitchUniforms.current.uGlitchAmp.value = bounds.height * 0.12;
  }, [bounds]);

  /* Side models have their own glitch envelope (more frequent bursts). */
  const sideGlitchUniforms = useRef({
    uGlitch: { value: 0 },
    uGlitchSeed: { value: 0 },
    uGlitchAmp: { value: 0.12 },
  });
  useEffect(() => {
    sideGlitchUniforms.current.uGlitchAmp.value = bounds.height * 0.12;
  }, [bounds]);

  const traceUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(sparkColor) },
      uOpacity: { value: 0 },
      uMinY: { value: bounds.minY },
      uHeight: { value: bounds.height },
      uBoost: { value: 1.0 },
      uScan: { value: 1.0 },
      /* Glitch uniforms — values synced per-frame via traceMatRef. */
      uGlitch: { value: 0 },
      uGlitchSeed: { value: 0 },
      uGlitchAmp: { value: 0.12 },
    }),
    [sparkColor, bounds]
  );

  const haloUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(sparkColor) },
      uOpacity: { value: 0 },
      uMinY: { value: bounds.minY },
      uHeight: { value: bounds.height },
      uBoost: { value: 0.35 },
      uScan: { value: 1.0 },
      /* Glitch uniforms — values synced per-frame via haloMatRef. */
      uGlitch: { value: 0 },
      uGlitchSeed: { value: 0 },
      uGlitchAmp: { value: 0.12 },
    }),
    [sparkColor, bounds]
  );

  /* SIDE tracing lines — same shader as the hero model but uScan = 0:
     the upward wipe stays exclusive to the main model, so the sides
     render as a static, dimmer wireframe (single pass, no halo). Both
     side materials share this uniform source; values are copied in by
     R3F and synced per-frame. */
  const sideTraceUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(sideSparkColor) },
      uOpacity: { value: 0 },
      uMinY: { value: bounds.minY },
      uHeight: { value: bounds.height },
      uBoost: { value: 0.55 },
      uScan: { value: 0.0 },
      /* Glitch uniforms — values synced per-frame via the mat refs. */
      uGlitch: { value: 0 },
      uGlitchSeed: { value: 0 },
      uGlitchAmp: { value: 0.12 },
    }),
    [sideSparkColor, bounds]
  );

  /* Inject the glitch box-slice displacement into all three point-cloud
     materials via onBeforeCompile — they keep their JSX declarations
     and refs; this just hooks the glitch uniforms in. The side models
     use their own, more frequently driven envelope. */
  useEffect(() => {
    const patch = (
      mat: THREE.PointsMaterial | null,
      u: {
        uGlitch: { value: number };
        uGlitchSeed: { value: number };
        uGlitchAmp: { value: number };
      }
    ) => {
      if (!mat) return;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uGlitch = u.uGlitch;
        shader.uniforms.uGlitchSeed = u.uGlitchSeed;
        shader.uniforms.uGlitchAmp = u.uGlitchAmp;
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", `#include <common>\n${GLITCH_PARS}`)
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>\n${GLITCH_DISPLACE}`
          );
      };
      mat.customProgramCacheKey = () => "journey-glitch-points";
      mat.needsUpdate = true;
    };
    patch(sparkMainRef.current, glitchUniforms.current);
    patch(leftPointsMatRef.current, sideGlitchUniforms.current);
    patch(sparkRightRef.current, sideGlitchUniforms.current);
  }, []);

  useFrame(({ clock, pointer }, delta) => {
    const main = mainRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!main || !left || !right) return;

    const t = clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);
    const slow = quality.reduceContinuousFx ? 0.5 : 1;

    mouse.current.x += (pointer.x - mouse.current.x) * 0.04;
    mouse.current.y += (pointer.y - mouse.current.y) * 0.04;

    /* ── MAIN entrance ── */
    const introT = Math.max(0, t - 1.0);
    intro.current = Math.min(1, introT / 1.6);
    const p = intro.current;
    const easeFade = easeOutCubic(p);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const easePop = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);

    const wm = wireMult.get();
    const mainOpacity = mainO.get() * easeFade;
    const heroVisible = wm > 0.01;

    /* ── GLITCH scheduler — slow box-slice bursts, hero only ──
       Every few seconds a burst fires: random box blocks jump in the
       vertex shaders, the whole model offsets on X, and the brightness
       dips. The pattern re-rolls every ~0.12s inside a burst so it
       reads slow and deliberate, not buzzy. Gated by the wire
       multiplier so the solid bust in Ch.02+ stays clean. */
    const g = glitchRef.current;
    const glitchLive = wm > 0.01;
    if (glitchLive && t >= g.next) {
      g.start = t;
      g.dur = 0.35 + Math.random() * 0.35;
      g.end = t + g.dur;
      g.next =
        g.end + (quality.reduceContinuousFx ? 6.0 : 3.5) + Math.random() * 4.0;
      g.seed = Math.random() * 100;
      g.jx = (Math.random() - 0.5) * 0.14;
      g.dip = 0.45 * Math.random();
      g.lastShuffle = t;
    }
    let glitchAmt = 0;
    if (glitchLive && t >= g.start && t < g.end) {
      const ph = clamp01((t - g.start) / Math.max(0.001, g.dur));
      glitchAmt =
        Math.sin(Math.PI * ph) * (quality.reduceContinuousFx ? 0.5 : 1);
      /* Re-roll the box pattern a few times per burst — slow, deliberate. */
      if (t - g.lastShuffle > 0.12) {
        g.seed = Math.random() * 100;
        g.jx = (Math.random() - 0.5) * 0.14;
        g.dip = 0.45 * Math.random();
        g.lastShuffle = t;
      }
    }
    glitchUniforms.current.uGlitch.value = glitchAmt;
    glitchUniforms.current.uGlitchSeed.value = g.seed;
    const jx = glitchAmt > 0.01 ? g.jx * glitchAmt : 0;
    const flick = glitchAmt > 0.01 ? 1 - g.dip * glitchAmt : 1;

    /* ── SIDE GLITCH scheduler — more frequent bursts than the main
       model so the background companions flicker more often. ── */
    const sg = sideGlitchRef.current;
    if (glitchLive && t >= sg.next) {
      sg.start = t;
      sg.dur = 0.3 + Math.random() * 0.35;
      sg.end = t + sg.dur;
      sg.next =
        sg.end + (quality.reduceContinuousFx ? 2.4 : 1.1) + Math.random() * 1.8;
      sg.seed = Math.random() * 100;
      sg.jx = (Math.random() - 0.5) * 0.16;
      sg.dip = 0.5 * Math.random();
      sg.lastShuffle = t;
    }
    let sideGlitchAmt = 0;
    if (glitchLive && t >= sg.start && t < sg.end) {
      const ph = clamp01((t - sg.start) / Math.max(0.001, sg.dur));
      sideGlitchAmt =
        Math.sin(Math.PI * ph) * (quality.reduceContinuousFx ? 0.5 : 1);
      if (t - sg.lastShuffle > 0.1) {
        sg.seed = Math.random() * 100;
        sg.jx = (Math.random() - 0.5) * 0.16;
        sg.dip = 0.5 * Math.random();
        sg.lastShuffle = t;
      }
    }
    sideGlitchUniforms.current.uGlitch.value = sideGlitchAmt;
    sideGlitchUniforms.current.uGlitchSeed.value = sg.seed;
    const jxSide = sideGlitchAmt > 0.01 ? sg.jx * sideGlitchAmt : 0;
    const sideFlick = sideGlitchAmt > 0.01 ? 1 - sg.dip * sideGlitchAmt : 1;

    /* ── MAIN transform ── */
    /* Smooth sine bob — same feel as the Contact globe: a clear,
       gentle up-and-down in the hero, calmer once the model becomes
       the solid bust in Ch.02+ (amp eases down with the wire mult). */
    const bobAmp = 0.1 + 0.18 * wm;
    const floatY = Math.sin(t * 1.0 * slow) * bobAmp;
    const maxX = viewport.width * 0.38;
    main.position.set(
      Math.min(mainX.get(), maxX) + jx,
      mainY.get() + floatY,
      0
    );
    /* ── Compact (portrait) viewport ──
       A phone shows only ~1.6 world units of width at this camera, so the
       edge-clamped side models would land ON the main model instead of
       flanking it, and the choreographed main scale overflows the frame.
       Compact viewports drop the trio down to the main model, shrunk to fit
       the width (floor 0.55 keeps ultra-narrow folds from vanishing). */
    const compact = viewport.width / viewport.height < 0.9;
    const fit = compact
      ? Math.max(0.55, Math.min(1, viewport.width / 3.1))
      : 1;
    const mScale = mainS.get() * easePop * fit;
    main.scale.set(mScale, mScale, mScale);

    /* Continuous accumulated spin. */
    const spinVal = spin.get();
    const spinDelta = spinVal - lastSpin.current;
    lastSpin.current = spinVal;
    rotAccum.current += 0.3 * slow * dt + spinDelta;

    /* Mouse parallax gated to hero only. */
    main.rotation.y = rotAccum.current + mouse.current.x * 0.4 * wm;
    main.rotation.x =
      mouse.current.y * 0.2 * wm + Math.sin(t * 0.3 * slow) * 0.04;

    /* ── TRACING LINES: GPU scan band, one uniform update per frame ── */
    if (traceLinesRef.current) traceLinesRef.current.visible = heroVisible;
    if (haloLinesRef.current) haloLinesRef.current.visible = heroVisible;
    if (traceMatRef.current) {
      traceMatRef.current.uniforms.uTime.value = t;
      traceMatRef.current.uniforms.uOpacity.value = mainOpacity * wm * flick;
      traceMatRef.current.uniforms.uGlitch.value = glitchAmt;
      traceMatRef.current.uniforms.uGlitchSeed.value = g.seed;
      traceMatRef.current.uniforms.uGlitchAmp.value =
        glitchUniforms.current.uGlitchAmp.value;
    }
    if (haloMatRef.current) {
      haloMatRef.current.uniforms.uTime.value = t;
      haloMatRef.current.uniforms.uOpacity.value = mainOpacity * wm * flick;
      haloMatRef.current.uniforms.uGlitch.value = glitchAmt;
      haloMatRef.current.uniforms.uGlitchSeed.value = g.seed;
      haloMatRef.current.uniforms.uGlitchAmp.value =
        glitchUniforms.current.uGlitchAmp.value;
    }

    /* Hero particles. */
    if (sparkMainRef.current) {
      sparkMainRef.current.opacity = mainOpacity * wm * 0.8 * flick;
      sparkMainRef.current.size = MAIN_POINT_SIZE;
    }

    /* Ch.02+ read: grey solid. */
    if (solidRef.current) {
      solidRef.current.opacity = solidOp.get() * easeFade;
    }

    /* ── SIDE models ── */
    const enterT = easeOutCubic(clamp01((t - 0.6) / 1.8));
    const sideOpacity = sideO.get() * enterT * easeFade;
    const restL = Math.min(SIDE_REST_X_L, viewport.width * 0.5);
    const restR = Math.min(SIDE_REST_X_R, viewport.width * 0.49);
    const sxL = lerp(SIDE_ENTER_FROM, restL, enterT);
    const sxR = lerp(SIDE_ENTER_FROM, restR, enterT);

    const bobL = Math.sin(t * 0.85 * slow) * 0.16;
    const bobR = Math.sin(t * 0.85 * slow + Math.PI) * 0.16;

    left.position.set(-sxL - jxSide, SIDE_Y_OFFSET_L + bobL, SIDE_Z);
    right.position.set(sxR + jxSide, SIDE_Y_OFFSET_R + bobR, SIDE_Z);
    left.scale.set(SIDE_SCALE, SIDE_SCALE, SIDE_SCALE);
    right.scale.set(SIDE_SCALE, SIDE_SCALE, SIDE_SCALE);
    /* Angled inward toward centre. */
    left.rotation.y = 0.4 + (-t * 0.12 * slow * enterT);
    right.rotation.y = -0.4 + (t * 0.12 * slow * enterT);

    if (leftPointsMatRef.current) {
      leftPointsMatRef.current.opacity = sideOpacity * 0.9 * sideFlick;
      leftPointsMatRef.current.size = SIDE_POINT_SIZE * 0.9;
    }
    if (sparkRightRef.current) {
      sparkRightRef.current.opacity = sideOpacity * sideFlick;
      sparkRightRef.current.size = SIDE_POINT_SIZE;
    }

    /* Side tracing lines — static wireframe (uScan 0), side glitch envelope. */
    for (const mat of [leftTraceMatRef.current, rightTraceMatRef.current]) {
      if (!mat) continue;
      mat.uniforms.uTime.value = t;
      mat.uniforms.uOpacity.value = sideOpacity * 0.55 * sideFlick;
      mat.uniforms.uGlitch.value = sideGlitchAmt;
      mat.uniforms.uGlitchSeed.value = sg.seed;
      mat.uniforms.uGlitchAmp.value =
        sideGlitchUniforms.current.uGlitchAmp.value;
    }

    /* Hide side models once faded for perf — and always on compact
       (portrait) viewports, where their edge clamp piles them onto the
       main model instead of flanking it (see `compact` above). */
    const sideVisible = sideOpacity > 0.005 && !compact;
    left.visible = sideVisible;
    right.visible = sideVisible;
  });

  if (!geometry || !pointsGeo || !sidePointsGeo || !sideDitherGeo) return null;

  return (
    <>
      {/* Lights for the solid bust. */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 5]} intensity={1.4} />
      <directionalLight position={[-3, -1, 4]} intensity={0.4} color="#e5e7eb" />

      {/* MAIN model group. */}
      <group ref={mainRef}>
        {/* Grey solid — Ch.02 through Ch.03. */}
        <mesh geometry={geometry} renderOrder={1}>
          <meshStandardMaterial
            ref={solidRef}
            color={solidColor}
            metalness={0.05}
            roughness={0.8}
            flatShading
            transparent
            opacity={0}
          />
        </mesh>

        {/* Tracing lines — the model's own edges, lit by a scan band
            that sweeps up the character. Two passes: soft HALO (slightly
            enlarged, fakes thickness + glow) under a bright CORE. Hero only. */}
        {edges && (
          <>
            <lineSegments
              ref={haloLinesRef}
              geometry={edges}
              renderOrder={2}
              scale={1.02}
            >
              <shaderMaterial
                ref={haloMatRef}
                uniforms={haloUniforms}
                vertexShader={TRACE_VERT}
                fragmentShader={TRACE_FRAG}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </lineSegments>
            <lineSegments ref={traceLinesRef} geometry={edges} renderOrder={3}>
              <shaderMaterial
                ref={traceMatRef}
                uniforms={traceUniforms}
                vertexShader={TRACE_VERT}
                fragmentShader={TRACE_FRAG}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </lineSegments>
          </>
        )}

        {/* Particles (sampled) — hero only. */}
        <points geometry={pointsGeo} renderOrder={3}>
          <pointsMaterial
            ref={sparkMainRef}
            color={sparkColor}
            size={MAIN_POINT_SIZE}
            transparent
            opacity={0}
            sizeAttenuation
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>

      {/* LEFT supporting model — dithered point cloud. */}
      <group ref={leftRef}>
        <points geometry={sideDitherGeo} renderOrder={1}>
          <pointsMaterial
            ref={leftPointsMatRef}
            color={sideSparkColor}
            size={SIDE_POINT_SIZE * 0.9}
            transparent
            opacity={0}
            sizeAttenuation
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
        {/* Wireframe edges — static; the upward wipe stays on the main model. */}
        {edges && (
          <lineSegments geometry={edges} renderOrder={2}>
            <shaderMaterial
              ref={leftTraceMatRef}
              uniforms={sideTraceUniforms}
              vertexShader={TRACE_VERT}
              fragmentShader={TRACE_FRAG}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </lineSegments>
        )}
      </group>

      {/* RIGHT supporting model — point cloud. */}
      <group ref={rightRef}>
        <points geometry={sidePointsGeo} renderOrder={1}>
          <pointsMaterial
            ref={sparkRightRef}
            color={sideSparkColor}
            size={SIDE_POINT_SIZE}
            transparent
            opacity={0}
            sizeAttenuation
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
        {/* Wireframe edges — static; the upward wipe stays on the main model. */}
        {edges && (
          <lineSegments geometry={edges} renderOrder={2}>
            <shaderMaterial
              ref={rightTraceMatRef}
              uniforms={sideTraceUniforms}
              vertexShader={TRACE_VERT}
              fragmentShader={TRACE_FRAG}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </lineSegments>
        )}
      </group>
    </>
  );
}

export default function JourneyModel({
  progress,
  active,
}: {
  progress: MotionValue<number>;
  active: boolean;
}) {
  const quality = useMemo(() => getAdaptiveQuality(), []);
  const { mode, design } = useTheme();
  const isEva = design === "eva";

  // Grey solid for Ch.02–03 — darker so it doesn't wash out text.
  const solidColor = useMemo(() => {
    if (isEva) return mode === "dark" ? "#166534" : "#9a3412";
    return mode === "dark" ? "#4b5563" : "#9ca3af";
  }, [isEva, mode]);

  // Particle/line hologram color for the hero (main model).
  const sparkColor = useMemo(() => {
    if (isEva) return mode === "dark" ? "#39ff14" : "#ff6a00";
    return mode === "dark" ? "#a5b4fc" : "#4361ee";
  }, [isEva, mode]);

  // Side model particle color — visible but subordinate (still dimmer
  // than the hero text even at the raised opacity).
  const sideSparkColor = useMemo(() => {
    if (isEva) return mode === "dark" ? "#15803d" : "#c2410c";
    return mode === "dark" ? "#64748b" : "#94a3b8";
  }, [isEva, mode]);

  const mainX = useTransform(progress, STOPS, POS_X);
  const mainY = useTransform(progress, STOPS, POS_Y);
  const mainS = useTransform(progress, STOPS, SCALE);
  const mainO = useTransform(progress, STOPS, OPACITY);
  const spin = useTransform(progress, [0, 1], [0, Math.PI * 2]);

  const solidOp = useTransform(progress, SOLID_STOPS, SOLID_OPACITY);
  const wireMult = useTransform(progress, SOLID_STOPS, WIRE_MULT);
  const sideO = useTransform(progress, SIDE_STOPS, SIDE_OPACITY);

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 4.2], fov: 45 }}
        dpr={quality.dpr}
        frameloop={active ? "always" : "never"}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
        }}
        className="absolute! inset-0"
      >
        <Suspense fallback={null}>
          <FoxTrio
            mainX={mainX}
            mainY={mainY}
            mainS={mainS}
            mainO={mainO}
            spin={spin}
            solidOp={solidOp}
            wireMult={wireMult}
            sideO={sideO}
            solidColor={solidColor}
            sparkColor={sparkColor}
            sideSparkColor={sideSparkColor}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL);