"use client";

import React, { useRef, useState, useEffect, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { motion, AnimatePresence } from "framer-motion";
import { getAdaptiveQuality, observeVisibility } from "@/lib/performance";
import { useReducedMotionPref } from "@/lib/hooks/useClientFlag";
import { asset } from "@/lib/assets";
import {
  PointSim, makeRefAttribute, HG_LIB, HG_UNIFORMS, HG_TARGET,
  isGPGPUSupported,
} from "@/lib/three/hologramSim";


const SLOTS = [
  {
    id: "mobile",
    index: "1/03",
    label: "MOBILE",
    title: "MOBILE APPS",
    body: "Cross-platform Flutter apps — from the BidaBoss e-commerce app to QR attendance.",
    model: asset("/3d/model_b.glb"),
    footerK: "BRIEF",
    footerV: "SITE / BRAND",
    glass: false,
  },
  {
    id: "creative",
    index: "2/03",
    label: "CREATIVE / 3D",
    title: "CREATIVE DEV",
    body: "Godot games, Blender models, motion design — where engineering meets craft.",
    model: asset("/3d/model_c.glb"),
    footerK: "CLIENT",
    footerV: "COMMISSION",
    glass: false,
  },
  {
    id: "logo",
    index: "3/03",
    label: "LOGO / NRTH",
    title: "THE LOGO",
    body: "NRTH's logo which is a fox — the only model in here that can leave particle form. You can turn it into a solid form and the original colored glass.",
    model: asset("/3d/model1.glb"),
    footerK: "THE LOGO",
    footerV: "NRTH / FOX",
    glass: true,
  },
];

/* ─── Color presets — the "outside the box" customization control ──
   Lives in the right info panel, physically outside the canvas card. */
const COLOR_PRESETS = [
  { name: "CRIMSON", hex: "#ff2200" },
  { name: "CYAN", hex: "#00e5ff" },
  { name: "AMBER", hex: "#ffb000" },
  { name: "VIOLET", hex: "#b026ff" },
  { name: "ACID", hex: "#39ff14" },
];

/* ─── Repulsion brush silhouettes ───────────────────────
   The influence zone is evaluated as a 2D signed distance in the plane
   perpendicular to the view ray, so its cross-section can be any shape.
   `idx` is what the shader branches on — keep it in step with the SDF
   ladder in VERT_PTS. Picked with icon buttons rather than labels: the
   silhouette IS the label. */
const BRUSHES = [
  { id: "circle",   idx: 0, label: "Round brush" },
  { id: "triangle", idx: 1, label: "Triangle brush" },
  { id: "square",   idx: 2, label: "Square brush" },
  { id: "flat",     idx: 3, label: "Flat blade brush" },
  { id: "tube",     idx: 4, label: "Upright tube brush" },
] as const;

type BrushShape = (typeof BRUSHES)[number]["id"];

const BRUSH_INDEX = Object.fromEntries(
  BRUSHES.map((b) => [b.id, b.idx]),
) as Record<BrushShape, number>;

/** The picker's glyphs: each button draws its own silhouette to scale. */
function BrushIcon({ shape, color }: { shape: BrushShape; color: string }) {
  const common = { fill: color, stroke: "none" };
  return (
    <svg viewBox="0 0 20 20" width={14} height={14} aria-hidden="true">
      {shape === "circle"   && <circle cx="10" cy="10" r="7" {...common} />}
      {shape === "triangle" && <polygon points="10,17 2.5,4 17.5,4" {...common} />}
      {shape === "square"   && <rect x="3.5" y="3.5" width="13" height="13" {...common} />}
      {shape === "flat"     && <rect x="1.5" y="8" width="17" height="4" {...common} />}
      {shape === "tube"     && <rect x="8" y="1.5" width="4" height="17" {...common} />}
    </svg>
  );
}

/* ─── Shared scan phase ─────────────────────────────────────
   ONE function owns *when* the scan is, in normalised form:
     0 → card's top edge, 1 → card's bottom edge.

   It deliberately knows nothing about world units. The old version
   returned a world Y baked from a hardcoded ±1.2 amplitude, which is
   why the line never reached the card's edges: ±1.2 only covers the
   middle band of what the camera actually sees, so the travel visibly
   stopped short at both ends. Growing the line's height would only
   have hidden that — the *range* was wrong, not the size.

   `ScanRig` converts this phase into (a) a world Y for the shader beam
   and (b) a top% for the DOM line, from the same number in the same
   frame, so the two cannot drift. */
function scanPhase(startTime: number, offset: number) {
  const elapsed = (performance.now() - startTime) / 1000;
  const cycle = 16.0;
  const t = ((elapsed + offset) % cycle) / cycle; // 0..1 sawtooth
  // Triangle wave: 0 -> 1 (first half, top to bottom) -> 0 (second half,
  // bottom back to top) instead of snapping back to the top each loop.
  const tri = t < 0.5 ? t * 2.0 : (1.0 - t) * 2.0;
  // Quintic smootherstep (not cubic) — near-zero velocity right at the
  // top/bottom turnaround, so the reversal is obviously a bounce, not a
  // constant-speed line that happens to loop.
  return tri * tri * tri * (tri * (tri * 6.0 - 15.0) + 10.0);
}

/** Half the scan line's cap square (5px) — keeps it flush, never clipped. */
const LINE_HALF_PX = 3;

/* ─── Repulsion tuning ──────────────────────────────────────
   All in MODEL units. Every model is normalised to ~2 units on its longest
   axis when the point cloud is built, so these numbers mean the same thing
   for any GLB dropped into SLOTS. */
const RADIUS         = 0.70; // radius of the cursor TUBE through the model
const RADIAL_FORCE   = 0.34; // push away from the cursor axis
const SWIRL_STRENGTH = 0.16; // tangential slide around it, so the cloud clumps
const NORMAL_FORCE   = 0.22; // along the surface normal — gives it volume
const NOISE_SCALE    = 1.0;  // per-vertex variance frequency (ragged rim)
const RESTORE_SPEED  = 1.40; // seconds for displaced points to settle back
const POINTER_LAG    = 0.09; // cursor interpolation — the dragged wake
/** How staggered the return is, 0–1. Higher = points trickle back further
    apart in time, which is what makes the settle read as swarming nanobots
    reassembling rather than one elastic sheet snapping home. At 0.75 the
    first points are home before the last ones have started moving. */
const RESTORE_STAGGER = 0.75;
/** Extra outward kick that peaks HALFWAY through a point's transition, in
    both directions. This is the "scatter first, then regroup" beat: a point
    doesn't ease straight home, it flings further out and comes back. */
const RELEASE_BURST   = 0.30;
/** Continuous drift while displaced. Without it, points hold a frozen
    offset and the pocket looks like a dent in a solid; with it they mill
    about like a swarm holding position. */
const WANDER          = 0.055;
/** Ambient sway applied to EVERY anchored point, cursor or not — the coral
    reef idle. Phase is a smooth function of position, so neighbours lean
    together as one frond instead of each shimmering independently. Small on
    purpose: this should read as a current in the water, never as noise. */
const SWAY            = 0.016;
/** Lateral brush along the cursor's direction of travel, scaled by speed.
    This is the other half of "fast sweeps don't punch holes": the outward
    forces are scaled DOWN as speed rises and replaced by this sideways
    push, so a quick pass combs the surface instead of boring through it. */
const BRUSH_DRAG      = 0.11;
/** Cursor speed, in model units/sec, that counts as fully "fast". */
const FAST_SPEED      = 2.6;
/* ── Swipe dispersal ────────────────────────────────────
   A fast stroke doesn't just deform the cloud, it throws points off it. The
   stroke is recorded as a line segment in the model's own space and points
   near that segment are flung outward, then trickle back — which is why the
   scatter outlives the cursor instead of snapping shut the moment it
   passes. Cheap enough to be free: one segment, four uniforms, no per-point
   state and no extra buffers. */
/** Normalised speed above which a move counts as a swipe rather than a push.
    Released at 60% of this, so a stroke hovering right at the threshold
    can't stutter in and out of "swiping" frame by frame. */
const SWIPE_TRIGGER   = 0.45;
/** A NEW stroke can only be recorded once the previous scatter has mostly
    rebuilt. Without this gate, moving back over the model re-pinned the
    recorded segment to the cursor, which teleported the whole scattered
    swath and snapped every still-returning point home in one frame — the
    "particles reset" and the glitching that came with it. Extending the
    stroke you're already making is unaffected. */
const RESWIPE_GATE    = 0.18;
/** Attack time of the scatter amplitude. Short, but not zero: ramping
    instead of jumping is what keeps a new stroke from visibly popping. */
const SCATTER_ATTACK  = 0.07;
/** How far the swipe throws points, in model units. */
const SCATTER_FORCE   = 0.95;
/** Radius of the disturbed corridor around the stroke. */
const SWIPE_RADIUS    = 0.55;
/** Time constant of the rebuild. Long on purpose — the reassembly is the
    part worth watching, and it's staggered per point on top of this. */
const SCATTER_DECAY   = 2.8;

/* ─── Cloud density ─────────────────────────────────────────
   Total surface samples per model, by hardware tier. Density is what makes
   the object read as a dotted SOLID rather than as dust — and it is what
   makes the torn pocket legible, because a rip only reads as a rip if the
   material around it is continuous.

   Back down from 90k: at that density the model read as a solid mass rather
   than as a point cloud, which is not the look this section wants. These
   land near the old vertex-derived counts, but the points are now EVENLY
   distributed, which was the actual problem — the fix was the sampling
   method, not the quantity. */
const POINT_COUNTS = { high: 34_000, medium: 20_000, low: 12_000 } as const;

/* ─── Runtime quality guard ─────────────────────────────────
   The tier from getAdaptiveQuality() is a GUESS made from core count and
   memory before a single frame has been drawn. It can't know about a
   throttled GPU, a laptop on battery, or twelve other tabs. So the guess is
   measured against reality once the section is live, and walked down if the
   frame rate doesn't hold up.

   Two levers, in the order that costs the least to change:
     · point budget — the samples are in random order, so drawing a prefix
       of the buffer is an unbiased thinning of the SAME cloud. No
       reallocation, no resampling, no hitch.
     · pixel ratio — halves the fragment load, but visibly softens, so it
       only comes after thinning. */
const PERF_STEPS = [1, 0.7, 0.5] as const;
/** Below this, quality steps down. Above RECOVER_FPS it may step back up. */
const DOWNGRADE_FPS = 45;
const RECOVER_FPS   = 58;
/** Sample window. Long enough that one stalled frame can't trigger it. */
const PERF_WINDOW   = 1.0;
/** Consecutive good windows required before stepping back up. Recovery is
    deliberately slower than degradation: flapping between levels is worse
    than sitting one notch too low. */
const RECOVER_HOLD  = 3;

/* ─── Camera rig ────────────────────────────────────────
   The camera answers to scroll: the model is approached as the section
   crosses the viewport rather than sitting at one fixed focal length the
   whole way past. All in world units, and all small — this is parallax that
   gives the object presence, not a camera move that competes with it.

   Progress here is 0 when the section's top edge first touches the bottom
   of the viewport and 1 when its bottom edge leaves the top, so the whole
   travel is usable regardless of how tall the section is. */
const CAM_Z_FAR   = 4.75; // entering and leaving
const CAM_Z_NEAR  = 4.05; // mid-section, the closest approach
const CAM_Y_LIFT  = 0.55; // how far the eye rises across the pass
const CAM_ORBIT   = 0.28; // lateral drift, radians of arc at the model
/** Time constant of the camera's own smoothing, on top of the scroll ref.
    Scroll deltas arrive in coarse jumps (trackpads, wheel notches, mobile
    fling); easing toward the target is what keeps those from reading as
    steps in the camera. */
const CAM_TAU     = 0.22;




/* ─── Shaders ───────────────────────────────────────────── */

/* ── Idle point cloud ──────────────────────────────────────
   This shader no longer computes displacement. Every point's position is
   simulated on the GPU by PointSim (see lib/three/hologramSim.ts) and read
   here from a float texture, so the vertex stage only shades.

   The displacement formula did not go away — it moved, intact, into
   `HG_TARGET`, where it now supplies the TARGET a per-point spring pulls
   toward instead of being the position itself. That is the difference
   between a formula and a simulation: a formula has no memory, so a point
   could only ever be exactly where the current uniforms said, which is why
   the cloud had no inertia and every point relaxed on the same clock. */
const VERT_PTS = /* glsl */ `
  attribute vec2 aRef;        // this point's texel in the sim textures
  uniform sampler2D uPosTex;  // simulated positions, owned by PointSim
  uniform float uOpacity;

  varying float vY;
  varying float vAlpha;
  varying float vOpacity;
  varying float vShade;

  ${HG_LIB}
  ${HG_UNIFORMS}
  ${HG_TARGET}

  void main() {
    /* The position attribute is now the ANCHOR — where this point belongs
       on the surface. Where it actually IS comes from the simulation.
       (No backticks anywhere in here: this is a JS template literal.) */
    vec3 base = position;
    vec3 p = texture2D(uPosTex, aRef).xyz;

    vY = p.y;
    vOpacity = uOpacity;

    float seed   = hgSeed(base);
    float a      = hgAssemble(seed);
    float frozen = hgFrozen(base);

    /* Displacement is MEASURED now, not predicted: how far the simulated
       position has ended up from the anchor. Strictly better than the old
       analytic term — it includes inertia and overshoot, so a point still
       flying reads hot even after the cursor has left, which the formula
       could not express. */
    float amt = clamp(length(p - base) * 2.2, 0.0, 1.0);

    vec3 N = normalize(normalMatrix * normal);
    vec3 lightDir = normalize(vec3(0.75, 0.55, 0.15));
    float ndotl = max(dot(N, lightDir), 0.0);
    vShade = mix(0.35, 1.0, pow(ndotl, 0.8));

    float flick = 0.75 + 0.25 * sin(p.y * 60.0 + uTime * 3.0);
    vAlpha = flick * uOpacity * a * (1.0 - frozen);

    vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp((2.5 / -mvPos.z) * 72.0, 1.0, 3.2)
                 * mix(0.75, 1.35, vShade) * mix(1.6, 1.0, a)
                 * (1.0 + amt * 0.3)
                 // A point shrinks out exactly as the ice front reaches it,
                 // so the handover happens per point, in a wave, instead of
                 // the whole cloud dimming at once.
                 * (1.0 - frozen * 0.92);
    gl_Position  = projectionMatrix * mvPos;
  }
`;
const FRAG_PTS = /* glsl */ `
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uScanY;
  varying float vY;
  varying float vAlpha;
  varying float vOpacity;
  varying float vShade;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    if (length(uv) > 0.5) discard;
    float soft = 1.0 - smoothstep(0.3, 0.5, length(uv));
    float beam = smoothstep(0.12, 0.0, abs(vY - uScanY));
    float band = mix(0.5, 1.0, sin(vY * 80.0 + uTime * 2.0) * 0.5 + 0.5);
    // Shadow-driven visibility — raised floor so idle points stay readable
    // instead of nearly vanishing, while shaded areas still read darker.
    float shadeAlpha = mix(0.4, 1.0, vShade);
    float a = soft * vAlpha * band * shadeAlpha + beam * 0.8 * soft * vOpacity;
    vec3 col = uColor * mix(0.65, 1.15, vShade);
    gl_FragColor = vec4(col + beam * 0.4 * vOpacity, clamp(a, 0.0, 1.0));
  }
`;

// ── Hover dither mesh ────────────────────────────────────
// Glitch is now a set of independent horizontal bars spanning the full
// width (Xerox/VHS-tear style) instead of a single square block — each
// bar has its own Y, thickness, and X-displacement, driven independently
// in JS below so several tear apart at once, staggered.
const VERT_DITHER = /* glsl */ `
  #define N_BARS 3
  uniform float uBarY[N_BARS];
  uniform float uBarH[N_BARS];
  uniform float uBarAmt[N_BARS];
  uniform float uRevealY;   // normalised Y wipe front (-1.5 hidden, +1.5 all shown)
  uniform float uNormScale;  // same scale used to normalise point cloud
  uniform vec3  uNormOffset; // same offset
  varying vec3  vNorm;
  varying vec3  vWorldPos;
  varying float vGlitch;
  varying float vClip;
  void main() {
    vNorm = normalize(normalMatrix * normal);
    vec3 p = position;
    float offsetX = 0.0;
    float glitchAmt = 0.0;
    for (int i = 0; i < N_BARS; i++) {
      float inBar = step(abs(p.y - uBarY[i]), uBarH[i]);
      offsetX += inBar * uBarAmt[i];
      glitchAmt += inBar * abs(uBarAmt[i]);
    }
    p.x += offsetX;
    vGlitch = clamp(glitchAmt, 0.0, 1.0);
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorldPos = wp.xyz;
    // Compute normalised Y (same transform as point cloud) for wipe
    float normY = (wp.y - uNormOffset.y) * uNormScale;
    // Wipe bottom-to-top: discard if normY > uRevealY
    // Soft-edged wipe band instead of a hard cutoff
    vClip = smoothstep(uRevealY - 0.22, uRevealY + 0.05, normY);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const FRAG_DITHER = /* glsl */ `
  uniform float uTime;
  uniform vec3  uColor;
  uniform float uOpacity;
  uniform float uDitherScale;
  varying vec3  vNorm;
  varying vec3  vWorldPos;
  varying float vGlitch;
  varying float vClip;

  void main() {
    float wipeAlpha = 1.0 - vClip;
    if (wipeAlpha <= 0.001) discard;

    vec3 N = normalize(vNorm);
    float ndotv = dot(N, vec3(0.0, 0.0, 1.0));
    vec3 lightDir = normalize(vec3(0.75, 0.55, 0.15));
    float ndotl = max(dot(N, lightDir), 0.0);
    float fres = pow(1.0 - clamp(ndotv, 0.0, 1.0), 2.5);

    float surface = clamp(ndotv * 0.2 + ndotl * 0.55 + 0.18, 0.0, 1.0);
    surface = pow(surface, 1.5);

    // Square halftone: each cell draws a literal square whose size scales
    // with surface brightness (classic square-dot halftone, not a soft
    // per-pixel threshold) — reads as unmistakably square, not blobby.
    float cellSize = uDitherScale * 4.0;
    vec2  cellCoord = gl_FragCoord.xy / cellSize;
    vec2  localUV   = fract(cellCoord) - 0.5;
    float halfSize  = surface * 0.5;
    vec2  d = abs(localUV) - halfSize;
    float dot_a = 1.0 - smoothstep(-0.015, 0.015, max(d.x, d.y));
    if (dot_a <= 0.01) discard;

    float shade = mix(0.1, 1.0, pow(ndotl, 0.85));

    float flick = 0.95 + 0.05 * sin(uTime * 8.0 + vWorldPos.y * 8.0);
    vec3 col = uColor * shade + fres * 0.25;
    // Glitch flash: bright white-hot core over each torn bar, plus a
    // chromatic red edge, so each horizontal tear reads unmistakably —
    // slight X-shift per channel gives a cheap chromatic-aberration look.
    col = mix(col, vec3(1.0), clamp(vGlitch * 3.5, 0.0, 1.0));
    col = mix(col, vec3(1.0, 0.05, 0.0), clamp(vGlitch * 1.5, 0.0, 1.0));
    col = clamp(col, 0.0, 1.0);
    gl_FragColor = vec4(col * flick, uOpacity * dot_a * wipeAlpha * 0.92);
  }
`;

/* ─── HologramModel ─────────────────────────────────────── */
function HologramModel({
  scene, active, hovered, pushEnabled, dragRot, scanYRef, color, pointCount,
  glassMode, glassNative, brush, perfScaleRef, reduced,
}: {
  /** An already-loaded model root, resolved by the wrapper below. */
  scene: THREE.Object3D;
  active: boolean;
  hovered: boolean;
  /** Opt-in pointer repulsion. Mutually exclusive with hover mode. */
  pushEnabled: boolean;
  dragRot: React.MutableRefObject<number>;
  scanYRef: React.MutableRefObject<number>;
  color: string;
  /** Total surface samples in the point cloud. Lower on weak hardware. */
  pointCount: number;
  /** Freeze the cloud into a solid refractive shell. Only offered on slots
      flagged `glass`, because it only makes sense on a closed surface. */
  glassMode: boolean;
  /** Glass in the model's OWN material (colour + maps as authored) instead
      of the palette tint. */
  glassNative: boolean;
  /** Cross-section of the repulsion zone. */
  brush: BrushShape;
  /** Live fraction of the point budget to draw, owned by PerfGuard. */
  perfScaleRef: React.MutableRefObject<number>;
  reduced: boolean;
}) {

  const groupRef      = useRef<THREE.Group>(null);
  const glassMix      = useRef(0);
  const hoverSmooth   = useRef(0);
  const autoRot       = useRef(0);
  const dragRotSmooth = useRef(0);
  const [initGlitch] = useState(() => 0.3 + Math.random() * 0.3);
  const glitchHoverT  = useRef(initGlitch);
  /* r3f already tracks the pointer in NDC and updates it on the canvas'
     own move events, so this needs no listener of its own. */
  const pointer = useThree((s) => s.pointer);
  const pushSmooth = useRef(0);
  /* Cursor → 3D. No geometry raycast and no bounding-sphere hit test: the
     shader is handed the cursor's RAY in local space and measures every
     point's distance to that line itself, which is both cheaper than a mesh
     raycast and depth-independent (see the shader for why depth was the
     problem).

     The ray the shader sees is built from a LAGGED cursor (~POINTER_LAG),
     which is what gives the cloud weight and stretches a fast sweep into a
     wake rather than a travelling circle. */
  const camera  = useThree((s) => s.camera);
  const gl      = useThree((s) => s.gl);
  const ray     = useRef(new THREE.Raycaster());
  const ndc2    = useRef(new THREE.Vector2());
  const ptrLag  = useRef({ x: 0, y: 0 });       // smoothed NDC cursor
  const localO  = useRef(new THREE.Vector3());  // ray origin, local space
  const localB  = useRef(new THREE.Vector3());  // a second point on the ray
  const localD  = useRef(new THREE.Vector3());  // ray direction, local space
  /* Cursor speed and travel, sampled on the z = 0 plane in world space. */
  const aimW      = useRef(new THREE.Vector3());
  const aimPrev   = useRef(new THREE.Vector3());
  const dragW     = useRef(new THREE.Vector3());
  const dragA     = useRef(new THREE.Vector3());
  const dragB     = useRef(new THREE.Vector3());
  const hasAim    = useRef(false);
  const speedSmooth = useRef(0);
  /* The recorded swipe: a segment in local space plus a decaying amplitude. */
  const swiping     = useRef(false);
  const scatterAmt  = useRef(0);
  const scatterTgt  = useRef(0);
  /* Whether the tube was already open last frame. On the first open frame the
     lagged cursor is snapped rather than eased, so the tube does not sweep in
     from wherever it was last parked. */
  const wasOpen = useRef(false);
  // Independent per-bar timers so the 5 horizontal tears fire staggered,
  // not all in lockstep — reads as a real scanner glitch, not one blink.
  const [initBarTimers] = useState<number[]>(() =>
    Array.from({ length: 3 }, () => 0.02 + Math.random() * 0.18),
  );
  const barTimers = useRef<number[]>(initBarTimers);
  /* Materialisation progress. A ref, not state: it changes every frame, and
     putting it in state would re-render this component ~60x/sec. */
  const assemble = useRef(active && reduced ? 1 : 0);

  /* The materials are built inside the same memo as the geometry they're
     attached to. They used to be created by assigning to a ref in the render
     body, which is a purity violation (StrictMode's second pass orphaned an
     undisposed GPU program every mount). Deriving them here instead makes
     them plain memoised values tied to the model's lifetime — created once
     per `scene`, disposed together with it, and never read from a ref during
     render. Their uniforms are still written imperatively in useFrame, which
     is the whole point of a material: it's a GPU handle, not view state. */
  /** Last draw count written, so the guard's scale is only pushed to the
      geometry when it actually changes rather than every frame. */
  const drawnCount = useRef(-1);

  const {
    ptsObj, meshObj, glassObj, ptsMat, ditherMat, glassMat, glassNativeMats,
    glassUniforms, maxR, normScale, normOffset, count, sim,
  } = useMemo(() => {
    const ptsMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: 0 },
        uScanY: { value: 0 },
        uGlitch: { value: 0 },
        uAssemble: { value: 0 },
        // Parked far outside the model until the cursor is raycast.
        uRayO: { value: new THREE.Vector3(99, 99, 99) },
        uRayD: { value: new THREE.Vector3(0, 0, -1) },
        uPush: { value: 0 },
        uRadius: { value: RADIUS },
        uRadialForce: { value: RADIAL_FORCE },
        uSwirl: { value: SWIRL_STRENGTH },
        uNormalForce: { value: NORMAL_FORCE },
        uNoiseScale: { value: NOISE_SCALE },
        uStagger: { value: RESTORE_STAGGER },
        uBurst: { value: RELEASE_BURST },
        uWander: { value: WANDER },
        uSway: { value: SWAY },
        uShape: { value: 0 },
        uSpeed: { value: 0 },
        uDragDir: { value: new THREE.Vector3(1, 0, 0) },
        uDrag: { value: BRUSH_DRAG },
        // Below zero = no ice anywhere, since a point's radius is never
        // negative. 1.25 covers the furthest point, so the model is solid.
        uFront: { value: -0.15 },
        uMaxR: { value: 1 },
        uSwipeA: { value: new THREE.Vector3(99, 99, 99) },
        uSwipeB: { value: new THREE.Vector3(99, 99, 99) },
        uSwipeAmt: { value: 0 },
        uSwipeR: { value: SWIPE_RADIUS },
        uScatterF: { value: SCATTER_FORCE },
        // Filled in by PointSim on the first simulated frame.
        uPosTex: { value: null },
      },
      vertexShader: VERT_PTS,
      fragmentShader: FRAG_PTS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const ditherMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: 0 },
        uRevealY: { value: -1.5 },
        uNormScale: { value: 1 },
        uNormOffset: { value: new THREE.Vector3() },
        uBarY: { value: new Array(3).fill(-99) },
        uBarH: { value: new Array(3).fill(0) },
        uBarAmt: { value: new Array(3).fill(0) },
        uDitherScale: { value: 1.8 },
      },
      vertexShader: VERT_DITHER,
      fragmentShader: FRAG_DITHER,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });

    scene.updateMatrixWorld(true);

    const allMeshes: THREE.Mesh[] = [];
    scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) allMeshes.push(o as THREE.Mesh); });

    const worldBox = new THREE.Box3();
    allMeshes.forEach((m) => worldBox.expandByObject(m));
    const worldSize   = new THREE.Vector3(); worldBox.getSize(worldSize);
    const worldCenter = new THREE.Vector3(); worldBox.getCenter(worldCenter);
    const scale = 2.0 / (Math.max(worldSize.x, worldSize.y, worldSize.z) || 1);

    /* ── Dense surface sampling ────────────────────────────
       Points are sampled across the triangle SURFACE, area-weighted, at a
       fixed count — they are no longer the GLB's own vertices.

       Vertex sampling is why the cloud read as sparse dust: a mesh puts
       topology wherever the modeller needed it, so points bunched on
       detailed areas and left large flat panels nearly empty, and
       decimating by a stride made that worse. The object never resolved as
       a surface, so the deformation looked like noise instead of material
       tearing. Area-weighted sampling gives even coverage at whatever
       density we ask for, independent of the mesh's topology — and the
       count is now a budget we control rather than a property of the file.

       Cost is at load, once per model, and the result is cached by the memo. */
    const areaOf = (g: THREE.BufferGeometry, s: number) => {
      const pos = g.attributes.position;
      const idx = g.index;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      const ab = new THREE.Vector3(), ac = new THREE.Vector3();
      const n = idx ? idx.count : pos.count;
      let sum = 0;
      for (let i = 0; i + 2 < n; i += 3) {
        const i0 = idx ? idx.getX(i)     : i;
        const i1 = idx ? idx.getX(i + 1) : i + 1;
        const i2 = idx ? idx.getX(i + 2) : i + 2;
        a.fromBufferAttribute(pos, i0);
        b.fromBufferAttribute(pos, i1);
        c.fromBufferAttribute(pos, i2);
        sum += ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() * 0.5;
      }
      return sum * s * s; // local → world area
    };

    const scaleOf = (m: THREE.Mesh) => {
      const v = new THREE.Vector3();
      m.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), v);
      return Math.max(v.x, v.y, v.z) || 1;
    };
    const areas = allMeshes.map((m) => areaOf(m.geometry, scaleOf(m)));
    const areaTotal = areas.reduce((s, v) => s + v, 0) || 1;

    const merged     = new Float32Array(pointCount * 3);
    const mergedNorm = new Float32Array(pointCount * 3);
    const sampleP = new THREE.Vector3();
    const sampleN = new THREE.Vector3();
    let w = 0;
    /* Radius of the furthest sample, in normalised units. The ice front and
       the glass reveal are both expressed as a fraction of this, so the
       freeze finishes exactly when it reaches the outermost point no matter
       the model's proportions. */
    let maxR = 0;
    allMeshes.forEach((m, mi) => {
      if (!m.geometry.attributes.position) return;
      if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
      // Budget split by world-space area, so a large flat panel gets as many
      // points per cm² as a dense detailed one. The last mesh absorbs the
      // rounding remainder so the buffer is always exactly full.
      const share = mi === allMeshes.length - 1
        ? pointCount - w
        : Math.min(pointCount - w, Math.round((areas[mi] / areaTotal) * pointCount));
      if (share <= 0) return;

      const sampler = new MeshSurfaceSampler(new THREE.Mesh(m.geometry)).build();
      const nrmMat = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
      for (let i = 0; i < share; i++) {
        sampler.sample(sampleP, sampleN);
        sampleP.applyMatrix4(m.matrixWorld);
        merged[w * 3]     = (sampleP.x - worldCenter.x) * scale;
        merged[w * 3 + 1] = (sampleP.y - worldCenter.y) * scale;
        merged[w * 3 + 2] = (sampleP.z - worldCenter.z) * scale;
        const rr = Math.hypot(merged[w * 3], merged[w * 3 + 1], merged[w * 3 + 2]);
        if (rr > maxR) maxR = rr;

        sampleN.applyMatrix3(nrmMat).normalize();
        mergedNorm[w * 3]     = sampleN.x;
        mergedNorm[w * 3 + 1] = sampleN.y;
        mergedNorm[w * 3 + 2] = sampleN.z;
        w++;
      }
    });

    const ptsGeo = new THREE.BufferGeometry();
    ptsGeo.setAttribute("position", new THREE.BufferAttribute(merged, 3));
    ptsGeo.setAttribute("normal", new THREE.BufferAttribute(mergedNorm, 3));
    // Guard against a model with no usable triangles leaving zeroed tail
    // samples piled up at the origin.
    if (w < pointCount) ptsGeo.setDrawRange(0, w);

    /* Each point carries the UV of its own texel in the simulation
       textures. Two floats per point against the alternative — reading the
       position from an attribute the CPU rewrites every frame — is not a
       close call. */
    const sim = new PointSim(w, merged, mergedNorm, ptsMat.uniforms, {
      // Underdamped on purpose: critical damping for this stiffness would be
      // ~13, so at 7.5 a released point overshoots its anchor and settles
      // back. That overshoot is the "scatter, then regroup" beat that used
      // to be faked with an analytic burst term.
      stiffness: 42,
      damping: 7.5,
      spread: 0.45,
    });
    ptsGeo.setAttribute(
      "aRef",
      new THREE.BufferAttribute(makeRefAttribute(pointCount, sim.size), 2),
    );
    const ptsObj = new THREE.Points(ptsGeo, ptsMat);

    const meshRoot = new THREE.Group();
    allMeshes.forEach((m) => {
      const mesh = new THREE.Mesh(m.geometry.clone(), ditherMat);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(m.matrixWorld);

      meshRoot.add(mesh);
    });
    meshRoot.scale.setScalar(scale);
    meshRoot.position.set(
      -worldCenter.x * scale,
      -worldCenter.y * scale,
      -worldCenter.z * scale,
    );

    /* ── Glass shell ───────────────────────────────────────
       A third representation of the same geometry, off by default and only
       reachable on slots flagged `glass`. MeshPhysicalMaterial with
       transmission is genuinely refractive — the renderer resolves what is
       behind it into a transmission target — so the point cloud and the
       card's grid bend through it. It stays `visible = false` until the
       freeze starts, so the transmission pass costs nothing in point mode.

       Freeze front:
       The shell reveals with the same radial front the points freeze on, so
       the two are one event: as a point crystallises, the solid appears in
       exactly its place. MeshPhysicalMaterial has no uniform for that, so
       the front is patched into its compiled shader — cheaper and far less
       fragile than reimplementing transmission by hand.

       The cut is dithered by a per-vertex hash rather than being a clean
       sphere, which is what sells it as crystal growth instead of a ball
       expanding. `discard` (not alpha) because the transmission pass reads
       depth: a merely transparent front edge would refract as if the whole
       shell were already there. */
    const glassUniforms = {
      uFront: { value: -0.15 },
      uMaxR: { value: maxR || 1 },
    };
    /** Applied to every glass variant, so tinted and native freeze alike. */
    const patchIce = (mat: THREE.MeshPhysicalMaterial) => {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uFront = glassUniforms.uFront;
        shader.uniforms.uMaxR  = glassUniforms.uMaxR;
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vIceP;\nvarying vec3 vIceRaw;")
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
             /* Normalised-space position. modelMatrix also carries the
                group's spin, but rotation preserves length, so the radius
                this yields matches the point cloud's own. */
             vIceP = (modelMatrix * vec4(position, 1.0)).xyz;
             vIceRaw = position;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec3 vIceP;\nvarying vec3 vIceRaw;\nuniform float uFront;\nuniform float uMaxR;",
          )
          .replace(
            "#include <clipping_planes_fragment>",
            `#include <clipping_planes_fragment>
             float iceR = length(vIceP) / max(uMaxR, 1e-3);
             float iceN = fract(sin(dot(vIceRaw, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
             if (iceR > uFront + iceN * 0.09) discard;`,
          );
      };
    };

    /* Palette-tinted glass: one material shared by every mesh. */
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color),
      metalness: 0,
      roughness: 0.06,
      transmission: 1,
      thickness: 0.85,
      ior: 1.46,
      side: THREE.DoubleSide,
    });
    patchIce(glassMat);

    /* ── Native glass ──────────────────────────────────────
       The same shell, but wearing the model's own authored colour and maps
       instead of the palette tint — the GLB as it looked before it came
       into this scene, only made of glass. One material per source mesh,
       since each may have its own textures. Transmission is 0.82 rather
       than 1: at full transmission the base colour and map are almost
       entirely replaced by what's behind the surface, which would throw
       away the very thing this option exists to show. */
    const glassNativeMats = allMeshes.map((m) => {
      const src = (Array.isArray(m.material) ? m.material[0] : m.material) as
        THREE.MeshStandardMaterial | undefined;
      const mat = new THREE.MeshPhysicalMaterial({
        color: src?.color ? src.color.clone() : new THREE.Color(0xffffff),
        map: src?.map ?? null,
        normalMap: src?.normalMap ?? null,
        roughnessMap: src?.roughnessMap ?? null,
        metalnessMap: src?.metalnessMap ?? null,
        emissive: src?.emissive ? src.emissive.clone() : new THREE.Color(0x000000),
        emissiveMap: src?.emissiveMap ?? null,
        roughness: src?.roughness ?? 0.12,
        metalness: src?.metalness ?? 0,
        transmission: 0.82,
        thickness: 0.7,
        ior: 1.46,
        side: THREE.DoubleSide,
      });
      patchIce(mat);
      return mat;
    });

    const glassRoot = new THREE.Group();
    allMeshes.forEach((m) => {
      const mesh = new THREE.Mesh(m.geometry, glassMat);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(m.matrixWorld);
      glassRoot.add(mesh);
    });
    glassRoot.scale.setScalar(scale);
    glassRoot.position.copy(meshRoot.position);
    glassRoot.visible = false;

    return {
      ptsObj,
      meshObj: meshRoot,
      glassObj: glassRoot,
      ptsMat,
      ditherMat,
      glassMat,
      glassNativeMats,
      glassUniforms,
      maxR: maxR || 1,
      normScale: scale,
      normOffset: worldCenter,
      count: w,
      sim,
    };
    // `color` is intentionally omitted: it only seeds the initial uniform, and
    // the effect below keeps it in sync. Including it would rebuild the whole
    // point cloud on every palette click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, pointCount]);

  /* Free the GPU handles when the model changes or unmounts. The sim owns
     four render targets and two data textures, so leaking it would be the
     most expensive leak in the section. */
  useEffect(() => {
    return () => {
      ptsMat.dispose();
      ditherMat.dispose();
      glassMat.dispose();
      glassNativeMats.forEach((m) => m.dispose());
      sim.dispose();
    };
  }, [ptsMat, ditherMat, glassMat, glassNativeMats, sim]);

  useEffect(() => {
    (ptsMat.uniforms.uColor.value as THREE.Color).set(color);
    (ditherMat.uniforms.uColor.value as THREE.Color).set(color);
    // Only the tinted shell follows the palette. The native materials keep
    // whatever the model was authored with — that's the point of them.
    glassMat.color.set(color);
  }, [color, ptsMat, ditherMat, glassMat]);

  /* Swap the shell's material rather than rebuilding it: both variants are
     compiled once, up front, so toggling can't stall a frame. */
  useEffect(() => {
    glassObj.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      mesh.material = glassNative ? (glassNativeMats[i] ?? glassMat) : glassMat;
    });
  }, [glassNative, glassObj, glassMat, glassNativeMats]);

  /* eslint-disable react-hooks/immutability -- A THREE.ShaderMaterial is a
     handle to GPU state, not React view state: driving an animation means
     writing its uniforms on every frame. The compiler's immutability rule
     can't model that (it treats any hook-derived object as frozen), and the
     alternative it suggests — setState per frame — would re-render this
     component 60x/sec, which is precisely the scroll jank this pass set out
     to remove. Suppression is scoped to the two mutation sites only. */
  useEffect(() => {
    ditherMat.uniforms.uNormScale.value = normScale;
    (ditherMat.uniforms.uNormOffset.value as THREE.Vector3).copy(normOffset);
    ptsMat.uniforms.uMaxR.value = maxR;
  }, [normScale, normOffset, ditherMat, ptsMat, maxR]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();

    const dt = Math.min(delta, 1 / 30);
    const smoothing = 1 - Math.exp(-dt / 0.16);
    hoverSmooth.current += ((hovered ? 1 : 0) - hoverSmooth.current) * smoothing;
    const raw = hoverSmooth.current;
    const h = raw * raw * (3 - 2 * raw);

    /* Opacity used to be a hard `active ? 1 : 0`, which is why switching
       tabs was a cut. Now both models cross-fade through the assemble
       curve — and, per the motion system, leaving is faster than
       arriving (0.28s out vs 0.7s in). */
    const aTarget = active ? 1 : 0;
    if (reduced) {
      assemble.current = aTarget;
    } else {
      const tau = active ? 0.7 : 0.28;
      assemble.current += (aTarget - assemble.current) * (1 - Math.exp(-dt / tau));
      if (Math.abs(aTarget - assemble.current) < 0.001) assemble.current = aTarget;
    }
    /* ── Freeze / thaw ────────────────────────────────────
       One number drives everything: a radius that grows from the model's
       core outward (1.6s to freeze, 1.0s to thaw). Points crystallise and
       vanish as it passes them; the glass shell appears behind it in the
       same frame, through the same radius. Nothing cross-fades — the state
       change is spatial, which is why it reads as ice forming rather than
       as one object dissolving into another. */
    const glassTarget = active && glassMode ? 1 : 0;
    if (reduced) {
      glassMix.current = glassTarget;
    } else {
      const gTau = glassTarget > glassMix.current ? 1.6 : 1.0;
      glassMix.current += (glassTarget - glassMix.current) * (1 - Math.exp(-dt / gTau));
      if (Math.abs(glassTarget - glassMix.current) < 0.0015) glassMix.current = glassTarget;
    }
    const gm = glassMix.current;
    // -0.15 (nothing frozen) → 1.25 (past the furthest point).
    const front = -0.15 + gm * 1.4;
    ptsMat.uniforms.uFront.value = front;
    glassUniforms.uFront.value   = front;
    // No fade anywhere: the shell is fully opaque glass from its first
    // fragment, and the reveal is entirely the discard front.
    glassObj.visible = gm > 0.002;

    ptsMat.uniforms.uAssemble.value = assemble.current;
    // No global glass fade here: individual points are faded by the front
    // inside the shader, so the unfrozen shell keeps its full brightness
    // while the core is already solid.
    ptsMat.uniforms.uOpacity.value = assemble.current * (1 - h * 0.85);
    ptsMat.uniforms.uShape.value   = BRUSH_INDEX[brush];

    ptsMat.uniforms.uTime.value  = t;
    ptsMat.uniforms.uScanY.value = scanYRef.current;

    /* Repulsion is opt-in via the panel toggle, not hover-driven: hovering
       is already the dither reveal's trigger, and the two fight (the reveal
       fades the point cloud out to 15%, so there is barely a cloud left to
       part). Arming one disables the other upstream. */
    const pushTarget = !reduced && active && pushEnabled ? 1 : 0;
    /* Asymmetric on purpose: the pocket opens in 0.12s and releases over
       RESTORE_SPEED. Equal timings read as the cursor "un-pressing" rather
       than as material relaxing.

       Note what this ramp now is and isn't: it shapes the FORCE, i.e. how
       strongly the target pulls away from the surface. The springing itself
       is per point, in the sim, with real velocity — so the return is no
       longer this curve's shape, it's the shape this curve gives the target
       plus each point's own inertia. */
    const pushTau = pushTarget > pushSmooth.current ? 0.12 : RESTORE_SPEED;
    pushSmooth.current += (pushTarget - pushSmooth.current) * (1 - Math.exp(-dt / pushTau));
    ptsMat.uniforms.uPush.value = pushSmooth.current;

    /* Skipped entirely while the tube is shut — no raycast, no matrix
       inverse, nothing, for the 99% of the time nobody has armed it. */
    if (pushSmooth.current > 0.001 && groupRef.current) {
      /* The cursor is lagged in NDC, then one ray is built from it. Lagging
         the 2D cursor is safe here in a way it was not for a point on a
         sphere: a ray is a linear function of the screen position, so the
         90ms trail is uniform everywhere on the card rather than varying
         with the depth the old hit point happened to land at. */
      if (!wasOpen.current) {
        ptrLag.current.x = pointer.x;
        ptrLag.current.y = pointer.y;
      } else {
        const k = 1 - Math.exp(-dt / POINTER_LAG);
        ptrLag.current.x += (pointer.x - ptrLag.current.x) * k;
        ptrLag.current.y += (pointer.y - ptrLag.current.y) * k;
      }
      wasOpen.current = true;

      ndc2.current.set(ptrLag.current.x, ptrLag.current.y);
      ray.current.setFromCamera(ndc2.current, camera);

      /* World → local for BOTH the origin and a second point one unit down
         the ray; the direction is then their difference. Transforming the
         direction as a point would apply the group's translation to it and
         skew the axis, and this group also rotates every frame, so the ray
         has to be re-expressed in local space each time. Doing it via two
         points needs no inverse matrix of our own. */
      localO.current.copy(ray.current.ray.origin);
      localB.current.copy(ray.current.ray.origin).add(ray.current.ray.direction);
      groupRef.current.worldToLocal(localO.current);
      groupRef.current.worldToLocal(localB.current);
      localD.current.subVectors(localB.current, localO.current).normalize();

      (ptsMat.uniforms.uRayO.value as THREE.Vector3).copy(localO.current);
      (ptsMat.uniforms.uRayD.value as THREE.Vector3).copy(localD.current);

      /* ── Cursor speed and travel direction ──────────────
         Measured on the z = 0 plane the model sits on, in world units, so
         "fast" means the same thing at any zoom or field of view. Speed
         scales the outward forces down and this drag direction up, which is
         what turns a quick sweep into a comb through the surface instead of
         a hole punched in it. */
      const rd = ray.current.ray.direction;
      const ro = ray.current.ray.origin;
      if (Math.abs(rd.z) > 1e-4) {
        aimW.current.copy(ro).addScaledVector(rd, -ro.z / rd.z);
        if (hasAim.current) {
          dragW.current.subVectors(aimW.current, aimPrev.current);
          const norm = Math.min(1, dragW.current.length() / Math.max(dt, 1e-3) / FAST_SPEED);
          speedSmooth.current += (norm - speedSmooth.current) * (1 - Math.exp(-dt / 0.14));
          if (dragW.current.lengthSq() > 1e-9) {
            dragW.current.normalize();
            // World → local as a difference of two points: the group spins,
            // so a direction can't be transformed as if it were a position.
            dragA.current.copy(aimW.current);
            dragB.current.copy(aimW.current).add(dragW.current);
            groupRef.current.worldToLocal(dragA.current);
            groupRef.current.worldToLocal(dragB.current);
            (ptsMat.uniforms.uDragDir.value as THREE.Vector3)
              .subVectors(dragB.current, dragA.current).normalize();
          }

          /* Record the stroke while it's fast. dragA is already the aim
             point in local space, so the segment travels with the model and
             the scattered swath stays where it was carved as the model
             spins. The segment keeps extending for as long as the speed
             holds; when it drops, whatever was swept is left to rebuild.

             A stroke already in progress may always extend. STARTING one is
             gated on the previous scatter having mostly rebuilt, because
             re-pinning the segment mid-rebuild moves the corridor out from
             under every point still on its way home. */
          const canStart = scatterAmt.current < RESWIPE_GATE;
          if (norm > SWIPE_TRIGGER && (swiping.current || canStart)) {
            if (!swiping.current) {
              (ptsMat.uniforms.uSwipeA.value as THREE.Vector3).copy(dragA.current);
              swiping.current = true;
            }
            (ptsMat.uniforms.uSwipeB.value as THREE.Vector3).copy(dragA.current);
            scatterTgt.current = Math.max(scatterTgt.current, Math.min(1, norm));
          } else if (norm < SWIPE_TRIGGER * 0.6) {
            swiping.current = false;
          }
        }
        aimPrev.current.copy(aimW.current);
        hasAim.current = true;
      }
    } else {
      wasOpen.current = false;
      hasAim.current = false;
      swiping.current = false;
      speedSmooth.current += (0 - speedSmooth.current) * (1 - Math.exp(-dt / 0.2));
    }
    ptsMat.uniforms.uSpeed.value = speedSmooth.current;

    /* The scatter decays whether or not the cursor is still around — the
       dispersal is a state of the cloud now, not a function of the pointer,
       which is the whole reason it reads as material being thrown.

       Two stages: the TARGET decays slowly (the rebuild), and the value
       chases the target on a short attack. That split is what makes a fresh
       stroke ramp in over a few frames instead of stepping, while the
       return stays long and staggered. Nothing here depends on the pointer
       still being over the card, so leaving mid-rebuild simply lets it
       finish. */
    scatterTgt.current = scatterTgt.current > 0.0005
      ? scatterTgt.current * Math.exp(-dt / SCATTER_DECAY)
      : 0;
    scatterAmt.current += (scatterTgt.current - scatterAmt.current)
      * (1 - Math.exp(-dt / SCATTER_ATTACK));
    if (scatterAmt.current < 0.0005 && scatterTgt.current === 0) scatterAmt.current = 0;
    ptsMat.uniforms.uSwipeAmt.value = scatterAmt.current;

    /* Runtime quality: draw a prefix of the buffer. The samples were
       generated in random order, so a prefix is an unbiased thinning of the
       same cloud — no resample, no reallocation, and nothing to warm up if
       the guard hands the budget back. Written only on change. */
    const want = Math.max(1, Math.round(count * perfScaleRef.current));
    if (want !== drawnCount.current) {
      ptsObj.geometry.setDrawRange(0, want);
      drawnCount.current = want;
    }

    /* Advance the springs. This runs last, after every uniform above has
       been written, so the simulation always integrates against the state
       the rest of this frame agreed on. dt is clamped by the same 1/30 the
       rest of the section uses: a long frame must not be allowed to inject
       energy into a spring system.

       The sim renders to its own targets and restores the previous one, so
       it is invisible to r3f's main pass, which runs after this callback. */
    sim.step(gl, dt);
    ptsMat.uniforms.uPosTex.value = sim.texture;


    if (h < 0.05) {
      glitchHoverT.current -= dt;
      if (glitchHoverT.current <= 0) {
        ptsMat.uniforms.uGlitch.value = Math.random() > 0.75 ? 1 : 0;
        glitchHoverT.current = 3 + Math.random() * 5;
      }
      ptsMat.uniforms.uGlitch.value += (0 - ptsMat.uniforms.uGlitch.value) * 0.1;
    }

    if (!active) {
      ditherMat.uniforms.uRevealY.value  = -1.5;
      ditherMat.uniforms.uOpacity.value  = 0;
      ditherMat.uniforms.uTime.value     = t;
    } else {
      const revealTarget = hovered ? 1.5 : -1.5;
      ditherMat.uniforms.uRevealY.value += (revealTarget - ditherMat.uniforms.uRevealY.value) * smoothing;
      const revealProgress = Math.max(0, Math.min(1, (ditherMat.uniforms.uRevealY.value + 1.5) / 3.0));
      // The dither reveal is suppressed while the glass shell is up: two
      // opaque representations of the same mesh on top of each other reads
      // as z-fighting, not as a material.
      ditherMat.uniforms.uOpacity.value =
        revealProgress * revealProgress * (3 - 2 * revealProgress) * (1 - gm);
      ditherMat.uniforms.uTime.value    = t;
    }

    const barY   = ditherMat.uniforms.uBarY.value as number[];
    const barH   = ditherMat.uniforms.uBarH.value as number[];
    const barAmt = ditherMat.uniforms.uBarAmt.value as number[];
    if (active && h > 0.5) {
      for (let i = 0; i < 3; i++) {
        barTimers.current[i] -= dt;
        if (barTimers.current[i] <= 0) {
          barY[i] = (Math.random() - 0.5) * 2.4;
          barH[i] = 0.01 + Math.random() * 0.025;
          barAmt[i] = (Math.random() > 0.5 ? 1 : -1) * (0.06 + Math.random() * 0.1);
          // hold at full strength for a short beat, then this bar's own
          // decay timer (separate from the re-trigger timer) fades it out
          barTimers.current[i] = 1.2 + Math.random() * 1.6;
        }
        // Time-based decay: holds near-full strength for ~1s, then fades —
        // a real glitch blip, not a frame-locked shudder.
        barAmt[i] *= Math.pow(0.02, dt / 1.0);
      }
    } else {
      for (let i = 0; i < 3; i++) {
        barY[i] = -99;
        barH[i] = 0;
        barAmt[i] = 0;
      }
    }

    if (groupRef.current) {
      autoRot.current += dt * 0.13;
      dragRotSmooth.current += (dragRot.current - dragRotSmooth.current) * (1 - Math.exp(-dt / 0.12));
      groupRef.current.rotation.y = autoRot.current + dragRotSmooth.current;
    }
  });
  /* eslint-enable react-hooks/immutability */

  return (
    <group ref={groupRef}>

      <primitive object={ptsObj} />
      <primitive object={meshObj} />
      <primitive object={glassObj} />
    </group>
  );
}

/* ─── Loader wrapper ────────────────────────────────────
   Loading is kept out of HologramModel so the model component takes an
   already-resolved root and nothing else. */
type HostProps = Omit<React.ComponentProps<typeof HologramModel>, "scene"> & {
  url: string;
};

function ModelHost({ url, ...rest }: HostProps) {
  const { scene } = useGLTF(url);
  return <HologramModel scene={scene} {...rest} />;
}

/* ─── PerfGuard ─────────────────────────────────────────
   Measures the real frame rate and walks quality down until it holds.
   Lives inside the Canvas because that's where the frame loop is, renders
   nothing, and owns exactly one number: the fraction of the point budget
   the models should draw. That number is a ref, so stepping it costs no
   React render at all — the models read it in their own useFrame. */
/* The prop is named `scaleRef`, not `scale`: the compiler's immutability
   rule permits writing through a hook argument only when the name marks it
   as a ref, which is exactly what this is — a mutable cell shared with the
   models' frame loop, deliberately outside React's render cycle. */
function PerfGuard({
  scaleRef, maxDpr,
}: {
  scaleRef: React.MutableRefObject<number>;
  maxDpr: number;
}) {
  const gl = useThree((s) => s.gl);
  const step   = useRef(0);
  const frames = useRef(0);
  const elapsed = useRef(0);
  const good   = useRef(0);

  useFrame((_, delta) => {
    frames.current += 1;
    elapsed.current += delta;
    if (elapsed.current < PERF_WINDOW) return;

    const fps = frames.current / elapsed.current;
    frames.current = 0;
    elapsed.current = 0;

    if (fps < DOWNGRADE_FPS && step.current < PERF_STEPS.length - 1) {
      step.current += 1;
      good.current = 0;
      scaleRef.current = PERF_STEPS[step.current];
      // Pixel ratio only after thinning has been tried: it costs sharpness
      // everywhere, whereas fewer points costs density the eye barely reads.
      if (step.current >= PERF_STEPS.length - 1) gl.setPixelRatio(1);
      return;
    }

    if (fps > RECOVER_FPS && step.current > 0) {
      good.current += 1;
      if (good.current >= RECOVER_HOLD) {
        step.current -= 1;
        good.current = 0;
        scaleRef.current = PERF_STEPS[step.current];
        gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
      }
    } else {
      good.current = 0;
    }
  });
  return null;
}

/* ─── Viewport progress ─────────────────────────────────
   0 when the element's top edge reaches the bottom of the viewport, 1 when
   its bottom edge leaves the top. Published through a ref, so scrolling
   causes zero React renders — the camera reads it inside the frame loop.

   The shared useSectionProgress hook is deliberately NOT used here: its
   range is `height - viewport`, which is correct for a tall sticky section
   but degenerate for one shorter than the viewport (the range clamps to 1px
   and progress explodes). This denominator is `viewport + height`, which is
   the full span over which any element of any height crosses the screen.

   Geometry is measured on mount, on resize and when the element itself
   resizes — never during a scroll event, so scrolling can't force a
   synchronous layout. */
function useViewportProgress(ref: React.RefObject<HTMLElement | null>) {
  const progressRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    let top = 0;
    let height = 0;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      top = rect.top + window.scrollY;
      height = rect.height;
    };

    const commit = () => {
      frame = 0;
      const span = window.innerHeight + height;
      const raw = (window.scrollY + window.innerHeight - top) / (span || 1);
      progressRef.current = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(commit);
    };

    const remeasure = () => { measure(); schedule(); };

    measure();
    commit();

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", remeasure);
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(remeasure) : null;
    observer?.observe(el);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", remeasure);
      observer?.disconnect();
    };
  }, [ref]);

  return progressRef;
}

/* ─── CameraRig ─────────────────────────────────────────
   Scroll drives the camera. The closest approach is at the MIDDLE of the
   pass (a bell curve on progress, not a ramp), so the model recedes as it
   enters and again as it leaves rather than ending the section jammed
   against the lens. The lift and the orbit are ramps across the same
   travel, which keeps the two readable as one continuous move.

   Everything is eased on CAM_TAU rather than applied raw: scroll arrives in
   coarse jumps — wheel notches, trackpad inertia, mobile fling — and
   feeding those straight to a transform is what makes scroll-driven 3D look
   stepped. The camera also keeps looking at the origin, so the parallax
   never turns into the model sliding out of frame.

   Under reduced motion the rig holds the mid-section framing and ignores
   scroll entirely: the composition is the same, it just doesn't move. */
function CameraRig({
  progressRef, reduced,
}: {
  progressRef: React.MutableRefObject<number>;
  reduced: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const zNow = useRef(CAM_Z_FAR);
  const yNow = useRef(0.2);
  const aNow = useRef(0);
  const primed = useRef(false);

  /* No eslint suppression needed here: the camera is reached through
     useThree and mutated via its own methods (position.set / lookAt) rather
     than by assigning to a hook-derived binding, which the immutability
     rule accepts as-is. */
  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const p = reduced ? 0.5 : progressRef.current;

    // Bell: 0 at both edges of the pass, 1 in the middle.
    const bell = Math.sin(Math.PI * p);
    const zWant = CAM_Z_FAR + (CAM_Z_NEAR - CAM_Z_FAR) * bell;
    const yWant = 0.2 + (p - 0.5) * CAM_Y_LIFT;
    const aWant = (p - 0.5) * CAM_ORBIT;

    if (!primed.current) {
      // First frame lands on the target instead of easing in from the
      // constructor's position — otherwise the section visibly settles
      // every time the canvas mounts.
      zNow.current = zWant;
      yNow.current = yWant;
      aNow.current = aWant;
      primed.current = true;
    } else {
      const k = 1 - Math.exp(-dt / CAM_TAU);
      zNow.current += (zWant - zNow.current) * k;
      yNow.current += (yWant - yNow.current) * k;
      aNow.current += (aWant - aNow.current) * k;
    }

    // Orbit on a circle of the current radius, so the dolly and the arc
    // compose instead of fighting over the same axis.
    const r = zNow.current;
    camera.position.set(Math.sin(aNow.current) * r, yNow.current, Math.cos(aNow.current) * r);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* ─── Preload all models ──────────────────────────────────
   Deliberately NOT at module scope any more: that fired ~3.7MB of GLB
   downloads the moment this chunk loaded — i.e. on page load, for a
   section far below the fold. `preloadModels()` runs once the section is
   about a screen and a half away (see the effect in HologramShowcase). */
let modelsPreloaded = false;
function preloadModels() {
  if (modelsPreloaded) return;
  modelsPreloaded = true;
  SLOTS.forEach((s) => useGLTF.preload(s.model));
}

/* ─── ScanRig ───────────────────────────────────────────
   ONE component owns the scan, and it works screen-first.

   The previous pair (ScanDriver + ScanSync) started from a world Y baked
   to ±1.2 and projected it to a screen %. Two problems fell out of that:

     · Range. ±1.2 world units is only the middle of the camera's view, so
       the line turned around well before the card's edges. It looked like
       a short line, but the travel was the bug — making the line taller
       would have masked it and clipped the caps.
     · Two useFrame callbacks each recomputed the phase, so a tab switch
       (which changes `offset`) could land them a frame apart.

   Now the phase is converted to a pixel position spanning the FULL canvas
   height (inset by the line's own half-height so its caps stay flush,
   never half-clipped by the card's overflow), and that exact same
   fraction is unprojected through the live camera onto the z = 0 plane
   the model sits on to get the shader's beam Y. One phase, one frame, one
   writer — the line and the beam are the same number by construction. */
function ScanRig({
  scanYRef, domRef, offset, startTime,
}: {
  scanYRef: React.MutableRefObject<number>;
  domRef: React.RefObject<HTMLDivElement | null>;
  offset: number;
  startTime: number;
}) {
  const { camera, size } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  // The model is centred on the origin and only ever spins about Y, so the
  // z = 0 plane is the correct place to measure its height.
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const ndc = useRef(new THREE.Vector2());
  const hit = useRef(new THREE.Vector3());

  useFrame(() => {
    const phase = scanPhase(startTime, offset);
    const h = size.height;
    if (h <= 0) return;

    const travel = Math.max(h - LINE_HALF_PX * 2, 0);
    const frac = (LINE_HALF_PX + phase * travel) / h;

    if (domRef.current) {
      domRef.current.style.top = `${(frac * 100).toFixed(3)}%`;
    }

    ndc.current.set(0, 1 - frac * 2);
    raycaster.current.setFromCamera(ndc.current, camera);
    if (raycaster.current.ray.intersectPlane(plane.current, hit.current)) {
      scanYRef.current = hit.current.y;
    }
  });
  return null;
}

/* ─── Scene ─────────────────────────────────────────────── */
// 3D floor-plane grid removed entirely per request — it was the source of
// the background-bleed complaint and the user doesn't want it at all now.
// The only remaining grid is the flat 2D CardGrid (z-0, strictly behind
// the Canvas at z-1) inside the card.
function Scene({
  activeIdx, hovered, pushEnabled, dragRot, scanYRef, scanOffset, startTime, color,
  scanDomRef, pointCount, reduced, glassOn, glassNative, brush, visited,
  perfScaleRef, maxDpr, scrollRef,
}: {
  activeIdx: number;
  hovered: boolean;
  pushEnabled: boolean;
  /** Glass toggle from the panel. Only honoured by slots flagged `glass`. */
  glassOn: boolean;
  /** Glass wears the model's own materials instead of the palette tint. */
  glassNative: boolean;
  /** Repulsion brush silhouette. */
  brush: BrushShape;
  /** Indices of slots the user has actually opened. Everything else stays
      unmounted so its GLB is never fetched by someone who never opens it. */
  visited: number[];
  dragRot: React.MutableRefObject<number>;
  scanYRef: React.MutableRefObject<number>;
  scanOffset: number;
  startTime: number;
  color: string;
  scanDomRef: React.RefObject<HTMLDivElement | null>;
  pointCount: number;
  /** Fraction of the point budget currently drawn, owned by PerfGuard. */
  perfScaleRef: React.MutableRefObject<number>;
  /** Ceiling PerfGuard restores the pixel ratio to on recovery. */
  maxDpr: number;
  /** Section's viewport progress, 0–1, written outside React. */
  scrollRef: React.MutableRefObject<number>;
  reduced: boolean;
}) {
  return (
    <>
      <PerfGuard scaleRef={perfScaleRef} maxDpr={maxDpr} />
      <CameraRig progressRef={scrollRef} reduced={reduced} />
      {/* Lights exist purely for the glass shell — the point cloud and the
          dither mesh light themselves in their own shaders. */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[2.5, 3, 2]} intensity={2.4} />
      <directionalLight position={[-2, -1.5, -2]} intensity={0.9} />

      <ScanRig
        scanYRef={scanYRef}
        domRef={scanDomRef}
        offset={scanOffset}
        startTime={startTime}
      />
      {SLOTS.map((slot, i) => (
        visited.includes(i) ? (
          <ModelHost
            key={slot.id}
            url={slot.model}
            active={i === activeIdx}
            hovered={i === activeIdx && hovered}
            pushEnabled={pushEnabled}
            dragRot={dragRot}
            scanYRef={scanYRef}
            color={color}
            pointCount={pointCount}
            glassMode={slot.glass && glassOn}
            glassNative={glassNative}
            brush={brush}
            perfScaleRef={perfScaleRef}
            reduced={reduced}
          />
        ) : null
      ))}
    </>
  );
}

/* ─── HUD corners ───────────────────────────────────────── */
function HudCorners({ hovered, color }: { hovered: boolean; color: string }) {
  const cls = "absolute w-6 h-6 pointer-events-none transition-all duration-300";
  const col = hovered ? `${color}cc` : `${color}33`;
  return (
    <>
      <span className={`${cls} top-2 left-2  border-t-2 border-l-2`} style={{ borderColor: col }} />
      <span className={`${cls} top-2 right-2 border-t-2 border-r-2`} style={{ borderColor: col }} />
      <span className={`${cls} bottom-2 left-2  border-b-2 border-l-2`} style={{ borderColor: col }} />
      <span className={`${cls} bottom-2 right-2 border-b-2 border-r-2`} style={{ borderColor: col }} />
    </>
  );
}

/* ─── CSS scan line — a dumb positioned element. Its top% is written every
   frame by ScanRig (inside the Canvas), never computed here: one writer is
   what keeps it exactly in step with the shader beam. */
function CssScanLine({
  domRef, hovered, color,
}: {
  domRef: React.RefObject<HTMLDivElement | null>;
  hovered: boolean;
  color: string;
}) {
  const sqSize = 5;
  const sqStyle: React.CSSProperties = {
    width: sqSize,
    height: sqSize,
    background: color,
    opacity: hovered ? 0.8 : 0.55,
    flexShrink: 0,
  };

  return (
    /* translateY(-50%) makes `top` mean the line's CENTRE. ScanRig then
       travels that centre from 3px to height-3px, so the caps sit flush
       against both edges instead of being half-eaten by overflow. */
    <div
      ref={domRef}
      className="absolute inset-x-0 pointer-events-none z-20"
      style={{ top: "0%", transform: "translateY(-50%)", willChange: "top" }}
    >
      {/* Scanner line with square bracket caps — flat, no glow/blur */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={sqStyle} />
        <div style={{
          flex: 1,
          height: 1,
          background: color,
          opacity: hovered ? 0.65 : 0.4,
        }} />
        <div style={sqStyle} />
      </div>
    </div>
  );
}

/* ─── Subtle grid inside the canvas card ───────────────── */
// Flat 2D CSS grid, sits strictly behind the canvas (z-0, canvas is z-1)
// so it never paints over the model. This is now the ONLY grid in the
// scene since the 3D floor plane was removed.
function CardGrid({ color }: { color: string }) {
  const alpha = "18";
  return (
    <div
      className="absolute inset-0 pointer-events-none z-0"
      style={{
        backgroundImage: [
          `linear-gradient(${color}${alpha} 1px, transparent 1px)`,
          `linear-gradient(90deg, ${color}${alpha} 1px, transparent 1px)`,
        ].join(","),
        backgroundSize: "48px 48px",
      }}
    />
  );
}

/* ─── Main export ───────────────────────────────────────── */
export default function HologramShowcase() {
  const [active, setActive]   = useState(0);
  const [visible, setVisible] = useState(false);
  /* The canvas mounts the first time the section is seen and then stays
     mounted, paused (frameloop "never") while off-screen. Unmounting on
     every exit meant re-compiling the hologram shaders and re-building the
     GPGPU sim each time you scrolled back — a visible hitch. */
  const [shown, setShown]     = useState(false);
  const [hovered, setHovered] = useState(false);
  const [color, setColor]     = useState(COLOR_PRESETS[0].hex);
  /* Repulsion is off by default — the dither hover reveal is this section's
     headline interaction and stays the default behaviour. */
  const [pushOn, setPushOn]   = useState(false);
  /* GPU capability check: the GPGPU spring simulation requires float or
     half-float render targets. On GPUs without either (some older Intel
     integrated graphics, certain mobile GPUs), the repulsion physics
     cannot run — the render targets silently return zeros and the cloud
     collapses to the origin. Detect this and disable repulsion with a
     notice rather than shipping a broken effect. */
  const gpgpuSupported = useMemo(() => isGPGPUSupported(), []);
  /* Freeze-to-glass, only offered on slots flagged `glass`. Mutually
     exclusive with repulsion — see the toggles for why. */
  const [glassOn, setGlassOn] = useState(false);
  /* Glass in the model's own authored colour/texture rather than the tint. */
  const [glassNative, setGlassNative] = useState(false);
  /* Repulsion brush silhouette. */
  const [brush, setBrush]     = useState<BrushShape>("circle");
  /* Slots that have actually been opened, so a model's GLB is only fetched
     once someone asks for it. */
  const [visited, setVisited] = useState<number[]>([0]);
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasWrap = useRef<HTMLDivElement>(null);
  const quality    = useMemo(() => getAdaptiveQuality(), []);
  const slot       = SLOTS[active];

  /* Lazy state, not `useRef(performance.now())`: reading the clock in the
     render body is impure, and on a StrictMode double-render the two passes
     read different values. The initialiser runs exactly once, and the value
     is a plain immutable number so reading it in JSX is safe. */
  const [startTime] = useState(() => performance.now());
  const scanYRef   = useRef(1.2);
  /* Live quality, measured rather than guessed. A ref: PerfGuard writes it
     inside the frame loop and the models read it there too, so a downgrade
     never touches React. */
  const perfScaleRef = useRef(1);
  /* Scroll position of this section, for the camera rig. Ref-published, so
     scrolling past the section costs no renders. */
  const scrollRef = useViewportProgress(sectionRef);
  /* Fewer points on weaker hardware, and no fly-in at all if the user has
     asked for reduced motion (the state change still happens, instantly).
     This is now an absolute sample budget rather than a stride over the
     mesh's vertices, so density no longer depends on how the GLB was built. */
  const pointCount = POINT_COUNTS[quality.tier as keyof typeof POINT_COUNTS]
    ?? POINT_COUNTS.high;
  /* `useSyncExternalStore` under the hood: correct on the first client render
     (no paint-then-correct pass), and it re-renders if the OS setting changes
     while the page is open. */
  const reduced = useReducedMotionPref();

  const scanLineDomRef = useRef<HTMLDivElement>(null);
  const dragRot    = useRef(0);
  const isDragging = useRef(false);
  const lastX      = useRef(0);

  const onPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    dragRot.current += (e.clientX - lastX.current) * 0.011;
    lastX.current = e.clientX;
  };
  const onPointerUp = () => { isDragging.current = false; };

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const stopNear = observeVisibility(
      el,
      (near) => {
        if (near) preloadModels();
      },
      "150% 0px"
    );
    const stopVisible = observeVisibility(
      el,
      (v) => {
        setVisible(v);
        if (v) setShown(true);
      },
      "0px 0px -10% 0px"
    );
    // Or warm the models during idle time once the intro has settled, so
    // the parse never lands mid-scroll (see useNearViewport for the why).
    const idle = (window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    }).requestIdleCallback;
    const warm = window.setTimeout(() => {
      if (idle) idle(preloadModels, { timeout: 4000 });
      else preloadModels();
    }, 9000);
    return () => {
      stopNear();
      stopVisible();
      window.clearTimeout(warm);
    };
  }, []);

  /* Selection marks the slot visited in the SAME update as it becomes
     active, rather than in an effect reacting to `active` — an effect there
     would set state during commit and cascade a second render for every tab
     click, which the lint rule (correctly) rejects. */
  const selectSlot = (i: number) => {
    setActive(i);
    setVisited((v) => (v.includes(i) ? v : [...v, i]));
  };

  const scanOffset = active * 2.7;

  return (
    <section
      id="hologram"
      ref={sectionRef}
      className="relative section-padding overflow-hidden"
      style={{ background: "var(--color-void)" }}
    >
      {/* Ambient glow behind everything */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: hovered
            ? `radial-gradient(ellipse 55% 45% at 50% 60%, ${color}14 0%, transparent 70%)`
            : `radial-gradient(ellipse 40% 35% at 50% 65%, ${color}08 0%, transparent 70%)`,
          transition: "background 0.6s ease",
        }}
      />

      <div className="container-narrow relative z-10">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="chapter-label mb-3">3D / HOLOGRAM SHOWCASE</p>
            <h2 className="text-section-title font-display">NRTH.</h2>
          </div>
          <p className="hidden md:block text-[var(--color-ash)] font-mono text-xs max-w-[200px] text-right leading-relaxed">
            ELRONI QUINONES.<br />NRTH.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)_200px] gap-6 items-start">

          {/* Left tabs */}
          <div className="flex md:flex-col gap-4 justify-center md:justify-start md:pt-6">
            {SLOTS.map((s, i) => (
              <button key={s.id} onClick={() => selectSlot(i)} className="text-left">
                <span
                  className="font-mono text-[10px] tracking-widest block mb-0.5"
                  style={{ color: i === active ? color : "var(--color-ash)" }}
                >
                  {s.index}
                </span>
                <span
                  className="font-mono text-xs font-semibold tracking-wider"
                  style={{ color: i === active ? color : "var(--color-silver)" }}
                >
                  {s.label}
                </span>
                <span
                  className="block h-px mt-1.5 origin-left transition-transform duration-500"
                  style={{
                    backgroundColor: color,
                    transform: `scaleX(${i === active ? 1 : 0.12})`,
                    opacity: i === active ? 1 : 0.25,
                  }}
                />
              </button>
            ))}
          </div>

          {/* Canvas card */}
          <div
            ref={canvasWrap}
            className="relative min-w-0 w-full self-start overflow-hidden rounded-sm"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => { setHovered(false); isDragging.current = false; }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{
              /* Width-driven, explicitly. With the card stretched to the row
                 height (the right column got taller as controls were added),
                 aspect-ratio was resolving the OTHER way — height first, then
                 width = 0.75 × height — which grew the 1fr track past the
                 container and pushed the info panel off-screen. self-start +
                 w-full pins the width and lets the ratio set the height. */
              aspectRatio: "3/4",
              minHeight: 420,
              border: `1px solid ${hovered ? `${color}55` : `${color}18`}`,
              transition: "border-color 0.4s ease",
              cursor: "grab",
              /* pan-y: vertical touches scroll the page as usual; horizontal
                 drags rotate the hologram. Without this the canvas eats
                 every touch and mobile visitors get stuck on the section. */
              touchAction: "pan-y",
              background: "#000",
            }}
          >
            {/* Subtle grid inside the card — strictly background (z-0) */}
            <CardGrid color={color} />

            <HudCorners hovered={hovered} color={color} />

            {/* Scan line — only rendered once canvas is visible */}
            {shown && (
              <CssScanLine
                domRef={scanLineDomRef}
                hovered={hovered}
                color={color}
              />
            )}

            <span
              className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-widest z-10 pointer-events-none whitespace-nowrap"
              style={{ color: hovered ? `${color}88` : `${color}33` }}
            >
              SCAN {slot.index} — {slot.title}
            </span>

            {shown ? (
              <Canvas
                camera={{ position: [0, 0.2, 4.2], fov: 40 }}
                dpr={[1, quality.dpr]}
                frameloop={visible ? "always" : "never"}
                gl={{ antialias: false, alpha: true, powerPreference: "high-performance", stencil: false }}
                style={{ position: "absolute", inset: 0, zIndex: 1 }}
              >
                <Suspense fallback={null}>
                  <Scene
                    activeIdx={active}
                    /* Hover mode is suppressed while repulsion is armed. */
                    hovered={hovered && !pushOn}
                    /* Armed AND the cursor actually over the card. Leaving
                       the card releases the pocket and lets the cloud spring
                       back instead of freezing the deformation in place. */
                    pushEnabled={pushOn && hovered}
                    dragRot={dragRot}
                    scanYRef={scanYRef}
                    scanOffset={scanOffset}
                    startTime={startTime}

                    color={color}
                    scanDomRef={scanLineDomRef}
                    pointCount={pointCount}
                    glassOn={glassOn}
                    glassNative={glassNative}
                    brush={brush}
                    visited={visited}
                    perfScaleRef={perfScaleRef}
                    maxDpr={quality.dpr}
                    scrollRef={scrollRef}
                    reduced={reduced}
                  />
                </Suspense>
              </Canvas>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 1 }}>
                <span className="font-mono text-xs tracking-widest animate-pulse" style={{ color: `${color}33` }}>
                  INITIALISING...
                </span>
              </div>
            )}
          </div>

          {/* Right info */}
          <div className="flex flex-col justify-center gap-5 md:pl-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={slot.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="font-mono text-[10px] tracking-widest mb-2" style={{ color }}>
                  {slot.index} — {slot.label}
                </p>
                <h3 className="font-display text-xl font-bold text-[var(--color-starlight)] mb-3 tracking-wide">
                  {slot.title}
                </h3>
                <p className="text-[var(--color-silver)] text-sm leading-relaxed">{slot.body}</p>
              </motion.div>
            </AnimatePresence>

            <div className="space-y-2 border-t pt-4" style={{ borderColor: `${color}18` }}>
              {[
                { k: "SIGNAL", v: slot.footerK },
                { k: "OUTPUT", v: slot.footerV },
                { k: "RENDER", v: "3D" },
              ].map(({ k, v }) => (
                <div key={k} className="flex justify-between font-mono text-[10px] tracking-widest">
                  <span className="text-[var(--color-ash)]">{k}</span>
                  <span style={{ color }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Pointer mode — outside the canvas card, like the palette */}
            <div className="space-y-2 border-t pt-4" style={{ borderColor: `${color}18` }}>
              <div className="flex justify-between font-mono text-[10px] tracking-widest">
                <span className="text-[var(--color-ash)]">HOVER</span>
                <span style={{ color }}>{pushOn ? "PARTICLES" : "DITHERING"}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  // Arming repulsion thaws the glass: frozen points don't
                  // react to the cursor, so having both on at once would
                  // leave a control that visibly does nothing.
                  setPushOn((v) => {
                    if (!v) setGlassOn(false);
                    return !v;
                  });
                }}
                disabled={!gpgpuSupported}
                aria-pressed={pushOn}
                aria-disabled={!gpgpuSupported}
                className="w-full border px-3 py-2 text-left font-mono text-[10px] uppercase tracking-widest transition-colors duration-200"
                style={{
                  borderColor: pushOn ? color : `${color}33`,
                  color: pushOn ? color : "var(--color-silver)",
                  background: pushOn ? `${color}14` : "transparent",
                  opacity: gpgpuSupported ? 1 : 0.4,
                  cursor: gpgpuSupported ? "pointer" : "not-allowed",
                }}
                data-cursor-hover={gpgpuSupported || undefined}
              >
                {pushOn ? "◉ Particle Sim On" : "◎ Particle Sim Off"}
              </button>
              {gpgpuSupported ? (
                <p className="font-mono text-[9px] leading-relaxed text-[var(--color-ash)]">
                  On: the particles react on the cursor and hover
                  mode is disabled.
                </p>
              ) : (
                <p className="font-mono text-[9px] leading-relaxed" style={{ color: "#ff6b4a" }}>
                  ⚠ GPU does not support the particle simulation (float render
                  targets unavailable). Particle simulation is disabled on this device.
                </p>
              )}

              {/* Brush silhouette — the influence zone is measured with an
                  SDF, so it doesn't have to be a disc. */}
              <div className="flex justify-between font-mono text-[10px] tracking-widest pt-2">
                <span className="text-[var(--color-ash)]">BRUSH</span>
                <span style={{ color }}>{brush.toUpperCase()}</span>
              </div>
              <div className="flex gap-1.5">
                {BRUSHES.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBrush(b.id)}
                    aria-pressed={brush === b.id}
                    aria-label={b.label}
                    title={b.label}
                    className="flex-1 grid place-items-center border py-1.5 transition-colors duration-200"
                    style={{
                      borderColor: brush === b.id ? color : `${color}33`,
                      background: brush === b.id ? `${color}14` : "transparent",
                    }}
                    data-cursor-hover
                  >
                    <BrushIcon
                      shape={b.id}
                      color={brush === b.id ? color : "var(--color-ash)"}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Render mode — only shown on slots that ship a glass variant */}
            {slot.glass && (
              <div className="space-y-2 border-t pt-4" style={{ borderColor: `${color}18` }}>
                <div className="flex justify-between font-mono text-[10px] tracking-widest">
                  <span className="text-[var(--color-ash)]">SURFACE</span>
                  <span style={{ color }}>{glassOn ? "SOLID" : "PARTICLES"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Freezing disarms repulsion, for the same reason as
                    // above: ice doesn't part around the cursor.
                    setGlassOn((v) => {
                      if (!v) setPushOn(false);
                      return !v;
                    });
                  }}
                  aria-pressed={glassOn}
                  className="w-full border px-3 py-2 text-left font-mono text-[10px] uppercase tracking-widest transition-colors duration-200"
                  style={{
                    borderColor: glassOn ? color : `${color}33`,
                    color: glassOn ? color : "var(--color-silver)",
                    background: glassOn ? `${color}14` : "transparent",
                  }}
                  data-cursor-hover
                >
                  {glassOn ? "◉ Solid Mode On" : "◎ Solid Mode Off"}
                </button>
                <p className="font-mono text-[9px] leading-relaxed text-[var(--color-ash)]">
                  Turns the model into solid. Disarms repulsion.
                </p>

                {/* Tint vs the model's own materials */}
                <div className="flex justify-between font-mono text-[10px] tracking-widest pt-2">
                  <span className="text-[var(--color-ash)]">SOLIDITY</span>
                  <span style={{ color }}>{glassNative ? "ORIGINAL" : "SOLID"}</span>
                </div>
                {/* Icon-only, matching the brush row: the label is already
                    in the GLASS header above, and text plus a swatch
                    overflowed this 200px column. */}
                <div className="flex gap-1.5">
                  {([false, true] as const).map((native) => (
                    <button
                      key={String(native)}
                      type="button"
                      onClick={() => setGlassNative(native)}
                      aria-pressed={glassNative === native}
                      aria-label={native ? "Model's own colour and texture" : "Palette tint"}
                      title={native ? "Model's own colour and texture" : "Palette tint"}
                      className="flex-1 grid place-items-center border py-1.5 transition-colors duration-200"
                      style={{
                        borderColor: glassNative === native ? color : `${color}33`,
                        background: glassNative === native ? `${color}14` : "transparent",
                      }}
                      data-cursor-hover
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          background: native
                            ? "linear-gradient(135deg,#e8e8e8 0%,#9a9a9a 50%,#5c5c5c 100%)"
                            : color,
                          opacity: glassNative === native ? 1 : 0.45,
                          display: "inline-block",
                        }}
                      />
                    </button>
                  ))}
                </div>
                <p className="font-mono text-[9px] leading-relaxed text-[var(--color-ash)]">
                  Solid applies the palette tint to the model.
                  Original keeps the logo&apos;s original colour and textures it was intended.
                </p>
              </div>
            )}

            {/* Color customization — deliberately placed outside the canvas box */}

            <div className="space-y-2 border-t pt-4" style={{ borderColor: `${color}18` }}>
              <div className="flex justify-between font-mono text-[10px] tracking-widest">
                <span className="text-[var(--color-ash)]">COLORS</span>
                <span style={{ color }}>{COLOR_PRESETS.find((p) => p.hex === color)?.name ?? "CUSTOM"}</span>
              </div>
              <div className="flex gap-2">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.hex}
                    onClick={() => setColor(p.hex)}
                    aria-label={`Set hologram color to ${p.name}`}
                    /* 36px hit-area button; the swatch itself stays a 16px
                       dot so the visual is unchanged but the target meets
                       the touch minimum. */
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200"
                    style={{
                      transform: p.hex === color ? "scale(1.15)" : "scale(1)",
                    }}
                  >
                    <span
                      className="h-4 w-4 rounded-full"
                      style={{
                        background: p.hex,
                        boxShadow: p.hex === color ? `0 0 8px 2px ${p.hex}99` : "none",
                        outline: p.hex === color ? `1px solid ${p.hex}` : "1px solid transparent",
                        outlineOffset: 2,
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              {SLOTS.map((s, i) => (
                /* Same trick as the color swatches: 32px hit-area around an
                   8px visual dot. */
                <button
                  key={s.id}
                  onClick={() => selectSlot(i)}
                  aria-label={`Select hologram slot ${s.label}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-300"
                  style={{
                    transform: i === active ? "scale(1.5)" : "scale(1)",
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full transition-colors duration-300"
                    style={{
                      backgroundColor: i === active ? color : "var(--color-smoke)",
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-10 text-center font-mono text-[10px] tracking-widest text-[var(--color-ash)]">
          DWN · NRTH · RON
        </p>
      </div>
    </section>
  );
}