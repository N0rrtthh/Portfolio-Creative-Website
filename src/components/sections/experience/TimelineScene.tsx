"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { TIMELINE_DATA } from "@/data/experience";
import {
  CURVE_SAMPLE_COUNT,
  NODE_FRACTIONS,
  createFlightCurve,
  samplePath,
} from "@/lib/three/path";
import type { AdaptiveQuality } from "@/lib/performance";

/** Distance (world units) at which the dossier card starts / finishes fading. */
const CARD_FADE_NEAR = 26;
const CARD_FADE_FAR = 46;

/* ── Theme-aware scene palette ─────────────────────────────────────
   The flight scene is always dark, but its accents follow the active
   site theme: tokens are read live off <html> and re-read whenever
   ThemeProvider flips data-mode / data-design. */
type ScenePalette = {
  primary: string;
  secondary: string;
  warm: string;
};

const SCENE_FALLBACK: ScenePalette = {
  primary: "#4361ee",
  secondary: "#818cf8",
  warm: "#fbbf24",
};

function readScenePalette(): ScenePalette {
  if (typeof window === "undefined") return SCENE_FALLBACK;
  const css = getComputedStyle(document.documentElement);
  const read = (token: string, fallback: string) => {
    const v = css.getPropertyValue(token).trim();
    return v.length > 0 ? v : fallback;
  };
  return {
    primary: read("--color-accent-primary", SCENE_FALLBACK.primary),
    secondary: read("--color-accent-secondary", SCENE_FALLBACK.secondary),
    warm: read("--color-accent-warm", SCENE_FALLBACK.warm),
  };
}

function useScenePalette(): ScenePalette {
  const [palette, setPalette] = useState<ScenePalette>(() =>
    readScenePalette()
  );
  useEffect(() => {
    const mo = new MutationObserver(() => setPalette(readScenePalette()));
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-mode", "data-design"],
    });
    return () => mo.disconnect();
  }, []);
  return palette;
}

/* Deterministic PRNG (mulberry32) — keeps the starfield pure and stable
   across re-renders, per the react-hooks/purity rule. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ─────────────────────────── Starfield ─────────────────────────── */

const Starfield = memo(function Starfield({
  count = 60,
  color = "#818cf8",
}: {
  count?: number;
  color?: string;
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const rand = mulberry32(0x5eed);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      pos[i] = (rand() - 0.5) * 60;
      pos[i + 1] = (rand() - 0.5) * 60;
      pos[i + 2] = (rand() - 0.5) * 160 - 45;
    }
    return pos;
  }, [count]);

  useFrame((_, delta) => {
    if (pointsRef.current) pointsRef.current.rotation.z += delta * 0.03;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.25}
        color={color}
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
});

/* ──────────────────── Neon directional pointer ─────────────────── */

const TimelineArrowPointer = memo(function TimelineArrowPointer({
  progressRef,
  samples,
  accent,
}: {
  progressRef: React.RefObject<number>;
  samples: THREE.Vector3[];
  accent: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const currentPos = useMemo(() => new THREE.Vector3(), []);
  const forwardPoint = useMemo(() => new THREE.Vector3(), []);
  const smoothProgress = useRef(0);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    smoothProgress.current = THREE.MathUtils.damp(
      smoothProgress.current,
      THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1),
      14,
      delta
    );

    samplePath(samples, smoothProgress.current, currentPos);
    samplePath(samples, Math.min(smoothProgress.current + 0.05, 0.98), forwardPoint);

    group.position.copy(currentPos);
    dummy.position.copy(currentPos);
    dummy.lookAt(forwardPoint);
    group.quaternion.copy(dummy.quaternion);
  });

  return (
    <group ref={groupRef}>
      {/* Cone head */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.4]}>
        <coneGeometry args={[0.38, 1.0, 4]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={2.2}
          metalness={0.9}
          roughness={0.1}
          flatShading
        />
      </mesh>

      {/* Shaft */}
      <mesh position={[0, 0, 0.2]}>
        <boxGeometry args={[0.22, 0.14, 0.85]} />
        <meshStandardMaterial
          color="#0f172a"
          metalness={0.95}
          roughness={0.15}
          emissive="#1e1b4b"
        />
      </mesh>

      {/* Rear wing fins */}
      <mesh position={[0, 0, 0.5]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.75, 0.06, 0.35]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1.2}
        />
      </mesh>
    </group>
  );
});

/* ───────────────── Floating spatial tech beacons ───────────────── */

const SpatialTechObjects = memo(function SpatialTechObjects({
  animate = true,
  palette,
}: {
  animate?: boolean;
  palette: ScenePalette;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const beacons = useMemo<
    {
      key: string;
      position: [number, number, number];
      rotation: [number, number, number];
      radius: number;
      color: string;
      emissive: string;
    }[]
  >(
    () => [
      {
        key: "a",
        position: [-6, 4, -15],
        rotation: [0.4, 0.5, 0],
        radius: 1.2,
        color: palette.primary,
        emissive: palette.primary,
      },
      {
        key: "b",
        position: [7, -3, -45],
        rotation: [0.2, 0.8, 0],
        radius: 1.4,
        color: palette.secondary,
        emissive: palette.secondary,
      },
      {
        key: "c",
        position: [-7, -4, -75],
        rotation: [0.6, 0.2, 0],
        radius: 1.1,
        color: palette.warm,
        emissive: palette.warm,
      },
    ],
    [palette]
  );

  useFrame((_, delta) => {
    if (animate && groupRef.current) groupRef.current.rotation.y += delta * 0.08;
  });

  return (
    <group ref={groupRef}>
      {beacons.map((b) => (
        <mesh key={b.key} position={b.position} rotation={b.rotation}>
          <octahedronGeometry args={[b.radius]} />
          <meshStandardMaterial
            color={b.color}
            emissive={b.emissive}
            emissiveIntensity={0.6}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
      ))}
    </group>
  );
});

/* ───────────────────────── Timeline node ───────────────────────── */

const TimelineNode = memo(function TimelineNode({
  position,
  isActive,
  palette,
}: {
  position: THREE.Vector3;
  isActive: boolean;
  palette: ScenePalette;
}) {
  return (
    <group position={position}>
      <mesh>
        <torusGeometry args={[4.8, 0.04, 6, 32]} />
        <meshBasicMaterial
          color={isActive ? palette.warm : palette.primary}
          transparent
          opacity={isActive ? 0.9 : 0.4}
        />
      </mesh>

      {/* Scale (not geometry args) so the active pulse never rebuilds a buffer */}
      <mesh scale={isActive ? 0.6 : 0.35}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial
          color={isActive ? palette.primary : "#475569"}
          emissive={isActive ? palette.primary : "#1e293b"}
          emissiveIntensity={isActive ? 2.4 : 0.4}
          roughness={0.1}
        />
      </mesh>
    </group>
  );
});

/* ──────────────────────────── Scene ───────────────────────────── */

export interface TimelineSceneProps {
  /** Raw scroll progress (0-1) of the section, updated outside React. */
  progressRef: React.RefObject<number>;
  activeNode: number;
  quality: AdaptiveQuality;
  /**
   * DOM overlay that gets parked at the active node's projected screen
   * coordinates. Written to imperatively — never via React state — so the
   * scroll thread stays free of re-renders. Replaces drei's <Html>, which
   * re-reads layout and writes a matrix3d every single frame.
   */
  cardHostRef: React.RefObject<HTMLDivElement | null>;
}

const TimelineScene = memo(function TimelineScene({
  progressRef,
  activeNode,
  quality,
  cardHostRef,
}: TimelineSceneProps) {
  const palette = useScenePalette();

  const curve = useMemo(() => createFlightCurve(), []);
  const linePoints = useMemo(() => curve.getPoints(120), [curve]);
  const pathSamples = useMemo(() => curve.getPoints(CURVE_SAMPLE_COUNT), [curve]);
  const nodePositions = useMemo(
    () => NODE_FRACTIONS.map((f) => curve.getPoint(f)),
    [curve]
  );

  const shipPoint = useMemo(() => new THREE.Vector3(), []);
  const cameraTarget = useMemo(() => new THREE.Vector3(), []);
  const projected = useMemo(() => new THREE.Vector3(), []);
  const smoothProgress = useRef(0);

  // Last committed overlay values — skips redundant style writes each frame.
  const lastX = useRef(-9999);
  const lastY = useRef(-9999);
  const lastOpacity = useRef(-1);

  useFrame((state, delta) => {
    smoothProgress.current = THREE.MathUtils.damp(
      smoothProgress.current,
      THREE.MathUtils.clamp(progressRef.current ?? 0, 0, 1),
      18,
      delta
    );

    samplePath(pathSamples, smoothProgress.current, shipPoint);

    cameraTarget.set(shipPoint.x, shipPoint.y + 0.6, shipPoint.z - 8.5);
    state.camera.position.lerp(cameraTarget, 0.18);
    state.camera.lookAt(shipPoint);

    /* Project the active node into screen space for the DOM dossier card.
       Only transform + opacity are touched (compositor-only properties) and
       the card is never scaled, so its text rasterizes exactly once. */
    const host = cardHostRef.current;
    const node = nodePositions[activeNode];
    if (!host || !node) return;

    const distance = state.camera.position.distanceTo(node);
    projected.copy(node).project(state.camera);

    const visible = projected.z <= 1 && distance <= CARD_FADE_FAR;
    const rawOpacity = !visible
      ? 0
      : distance <= CARD_FADE_NEAR
        ? 1
        : 1 - (distance - CARD_FADE_NEAR) / (CARD_FADE_FAR - CARD_FADE_NEAR);

    // Quantize so we only write on meaningful change.
    const opacity = Math.round(rawOpacity * 20) / 20;
    if (opacity !== lastOpacity.current) {
      lastOpacity.current = opacity;
      host.style.opacity = String(opacity);
      host.style.pointerEvents = opacity > 0.5 ? "auto" : "none";
      host.style.visibility = opacity > 0 ? "visible" : "hidden";
    }

    if (opacity === 0) return;

    const { width, height } = state.size;
    const marginX = Math.min(220, width / 2);
    const marginY = Math.min(170, height / 2);
    const x = THREE.MathUtils.clamp(
      (projected.x * 0.5 + 0.5) * width,
      marginX,
      width - marginX
    );
    const y = THREE.MathUtils.clamp(
      (-projected.y * 0.5 + 0.5) * height,
      marginY,
      height - marginY
    );

    if (Math.abs(x - lastX.current) > 0.5 || Math.abs(y - lastY.current) > 0.5) {
      lastX.current = x;
      lastY.current = y;
      host.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
    }
  });

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight
        position={[10, 20, 15]}
        intensity={2.0}
        color={palette.primary}
      />
      <directionalLight
        position={[-10, -10, -10]}
        intensity={1.0}
        color={palette.secondary}
      />

      <SpatialTechObjects
        animate={!quality.reduceContinuousFx}
        palette={palette}
      />
      <Starfield count={quality.sparkleCount || 60} color={palette.secondary} />

      {/* Laser flight path */}
      <Line
        points={linePoints}
        color={palette.primary}
        lineWidth={3.5}
        transparent
        opacity={0.85}
      />

      <TimelineArrowPointer
        progressRef={progressRef}
        samples={pathSamples}
        accent={palette.primary}
      />

      {TIMELINE_DATA.map((item, index) => (
        <TimelineNode
          key={item.id}
          position={nodePositions[index]}
          isActive={activeNode === index}
          palette={palette}
        />
      ))}
    </>
  );
});

export default TimelineScene;
