"use client";

import { Suspense, useMemo, useRef } from "react";
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
const TRACE_VERT = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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

  void main() {
    float ny = (vPos.y - uMinY) / uHeight;        // 0 at base, 1 at top
    float phase = fract(ny - uTime * 0.16);       // band traveling upward
    float trail = pow(1.0 - phase, 2.2);          // bright head, wide trail
    float base = 0.10;                            // faint skeleton line
    float alpha = (base + trail * 1.6) * uOpacity * uBoost;
    // Overdrive the color on the trail for an additive glow bloom.
    vec3 col = uColor * (0.7 + trail * 2.0);
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

/* ── BACKGROUND side models: visible only in the hero ── */
const SIDE_STOPS = [0, 0.22, 0.33, 1];
const SIDE_OPACITY = [0.32, 0.32, 0, 0];

/* Side models: visible, angled inward, pushed back. */
const SIDE_REST_X = 2.9;
const SIDE_Z = -2.2;
const SIDE_SCALE = 1.4;
const SIDE_ENTER_FROM = 9.0;
const SIDE_Y_OFFSET = -0.4;

/* Point sizing. */
const MAIN_POINT_SIZE = 0.04;
const SIDE_POINT_SIZE = 0.032;

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
  const sparkLeftRef = useRef<THREE.PointsMaterial>(null);
  const sparkRightRef = useRef<THREE.PointsMaterial>(null);
  const traceLinesRef = useRef<THREE.LineSegments>(null);
  const traceMatRef = useRef<THREE.ShaderMaterial>(null);
  const haloLinesRef = useRef<THREE.LineSegments>(null);
  const haloMatRef = useRef<THREE.ShaderMaterial>(null);

  const mouse = useRef({ x: 0, y: 0 });
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
  const traceUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(sparkColor) },
      uOpacity: { value: 0 },
      uMinY: { value: bounds.minY },
      uHeight: { value: bounds.height },
      uBoost: { value: 1.0 },
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
    }),
    [sparkColor, bounds]
  );

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

    /* ── MAIN transform ── */
    const floatY = Math.sin(t * 0.5 * slow) * 0.1;
    const maxX = viewport.width * 0.38;
    main.position.set(Math.min(mainX.get(), maxX), mainY.get() + floatY, 0);
    const mScale = mainS.get() * easePop;
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
      traceMatRef.current.uniforms.uOpacity.value = mainOpacity * wm;
    }
    if (haloMatRef.current) {
      haloMatRef.current.uniforms.uTime.value = t;
      haloMatRef.current.uniforms.uOpacity.value = mainOpacity * wm;
    }

    /* Hero particles. */
    if (sparkMainRef.current) {
      sparkMainRef.current.opacity = mainOpacity * wm * 0.8;
      sparkMainRef.current.size = MAIN_POINT_SIZE;
    }

    /* Ch.02+ read: grey solid. */
    if (solidRef.current) {
      solidRef.current.opacity = solidOp.get() * easeFade;
    }

    /* ── SIDE models ── */
    const enterT = easeOutCubic(clamp01((t - 0.6) / 1.8));
    const sideOpacity = sideO.get() * enterT * easeFade;
    const restX = Math.min(SIDE_REST_X, viewport.width * 0.46);
    const sx = lerp(SIDE_ENTER_FROM, restX, enterT);

    const bobL = Math.sin(t * 0.4 * slow) * 0.07;
    const bobR = Math.sin(t * 0.4 * slow + Math.PI) * 0.07;

    left.position.set(-sx, SIDE_Y_OFFSET + bobL, SIDE_Z);
    right.position.set(sx, SIDE_Y_OFFSET + bobR, SIDE_Z);
    left.scale.set(SIDE_SCALE, SIDE_SCALE, SIDE_SCALE);
    right.scale.set(SIDE_SCALE, SIDE_SCALE, SIDE_SCALE);
    /* Angled inward toward centre. */
    left.rotation.y = 0.4 + (-t * 0.12 * slow * enterT);
    right.rotation.y = -0.4 + (t * 0.12 * slow * enterT);

    if (sparkLeftRef.current) {
      sparkLeftRef.current.opacity = sideOpacity;
      sparkLeftRef.current.size = SIDE_POINT_SIZE;
    }
    if (sparkRightRef.current) {
      sparkRightRef.current.opacity = sideOpacity;
      sparkRightRef.current.size = SIDE_POINT_SIZE;
    }

    /* Hide side models entirely once faded for perf. */
    const sideVisible = sideOpacity > 0.005;
    left.visible = sideVisible;
    right.visible = sideVisible;
  });

  if (!geometry || !pointsGeo || !sidePointsGeo) return null;

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

      {/* LEFT supporting model. */}
      <group ref={leftRef}>
        <points geometry={sidePointsGeo} renderOrder={1}>
          <pointsMaterial
            ref={sparkLeftRef}
            color={sideSparkColor}
            size={SIDE_POINT_SIZE}
            transparent
            opacity={0}
            sizeAttenuation
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>

      {/* RIGHT supporting model. */}
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

  // Side model particle color — visible but subordinate.
  const sideSparkColor = useMemo(() => {
    if (isEva) return mode === "dark" ? "#166534" : "#9a3412";
    return mode === "dark" ? "#475569" : "#64748b";
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