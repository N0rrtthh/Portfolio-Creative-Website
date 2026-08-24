"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MotionValue } from "framer-motion";
import { useTheme } from "@/components/providers/ThemeProvider";
import { getAdaptiveQuality, observeVisibility } from "@/lib/performance";

function ScrollRig({ progress }: { progress?: MotionValue<number> }) {
  const { camera } = useThree();

  /* eslint-disable react-hooks/immutability */
  useFrame(() => {
    const p = progress?.get() ?? 0;
    camera.position.z = 8.5 - p * 5.5;
    camera.position.y = p * -1.2;
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 42 + p * 16;
      camera.updateProjectionMatrix();
    }
  });
  /* eslint-enable react-hooks/immutability */

  return null;
}

/** Multi-Layered Particle Swarm: Foreground, Midground, Background */
function LayeredParticleSwarm({ progress }: { progress?: MotionValue<number> }) {
  const { mode, design } = useTheme();
  const bgPointsRef = useRef<THREE.Points>(null);
  const midPointsRef = useRef<THREE.Points>(null);
  const fgPointsRef = useRef<THREE.Points>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const quality = useMemo(() => getAdaptiveQuality(), []);

  const isEva = design === "eva";

  const [bgPositions] = useState(() => {
    const count = quality.particleBg;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 5.0 + Math.random() * 5.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  });

  const [midPositions] = useState(() => {
    const count = quality.particleMid;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 3.0 + Math.random() * 3.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5;
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  });

  const [fgPositions] = useState(() => {
    const count = quality.particleFg;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 1.5 + Math.random() * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.4;
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  });

  const particleColor = useMemo(() => {
    if (isEva) return mode === "dark" ? "#39ff14" : "#ff6a00";
    return mode === "dark" ? "#818cf8" : "#4361ee";
  }, [isEva, mode]);

  const bgMatRef = useRef<THREE.PointsMaterial>(null);
  const midMatRef = useRef<THREE.PointsMaterial>(null);
  const targetColor = useMemo(() => new THREE.Color(particleColor), [particleColor]);

  // Hologram-style glow core: a soft additive sprite at the center that lights
  // up when the mouse hovers near it (like the Hologram showcase), then eases
  // back down when the pointer leaves.
  const glowRef = useRef<THREE.Sprite>(null);
  const glowMatRef = useRef<THREE.SpriteMaterial>(null);
  const glowLevel = useRef(0);

  const glowTexture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, "rgba(255,255,255,0.9)");
      grad.addColorStop(0.35, "rgba(255,255,255,0.35)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }, []);

  const glowColor = useMemo(() => {
    if (isEva) return mode === "dark" ? "#39ff14" : "#ff6a00";
    return mode === "dark" ? "#818cf8" : "#4361ee";
  }, [isEva, mode]);

  useFrame(({ clock, pointer }) => {
    mouse.current.x += (pointer.x - mouse.current.x) * 0.02;
    mouse.current.y += (pointer.y - mouse.current.y) * 0.02;

    const t = clock.getElapsedTime();
    const p = progress?.get() ?? 0;
    const slow = quality.reduceContinuousFx ? 0.6 : 1;

    if (bgMatRef.current) bgMatRef.current.color.lerp(targetColor, 0.08);
    if (midMatRef.current) midMatRef.current.color.lerp(targetColor, 0.08);

    if (bgPointsRef.current) {
      bgPointsRef.current.rotation.y =
        t * 0.015 * slow + mouse.current.x * 0.1 + p * 0.5;
      bgPointsRef.current.rotation.x = mouse.current.y * 0.05 + p * 0.2;
    }

    if (midPointsRef.current) {
      midPointsRef.current.rotation.y =
        t * 0.035 * slow + mouse.current.x * 0.25 + p * 1.0;
      midPointsRef.current.rotation.x = mouse.current.y * 0.15 + p * 0.4;
    }

    if (fgPointsRef.current) {
      fgPointsRef.current.rotation.y =
        -t * 0.06 * slow + mouse.current.x * 0.4 + p * 1.5;
      fgPointsRef.current.rotation.x = -mouse.current.y * 0.25;
    }

    // Glow core: proximity of the pointer to the center drives the target
    // level; ease toward it so it blooms and settles smoothly.
    const dist = Math.hypot(pointer.x, pointer.y);
    const target = Math.max(0, 1 - dist / 0.55);
    glowLevel.current += (target - glowLevel.current) * 0.06;
    const lvl = glowLevel.current;
    if (glowMatRef.current) {
      glowMatRef.current.opacity = 0.1 + lvl * 0.55;
    }
    if (glowRef.current) {
      const gs = 2.2 + lvl * 1.6 + Math.sin(t * 1.6) * 0.08;
      glowRef.current.scale.set(gs, gs, 1);
    }
  });

  return (
    <group>
      <points ref={bgPointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[bgPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={bgMatRef}
          size={0.025}
          color={particleColor}
          transparent
          opacity={0.3}
          sizeAttenuation
          depthWrite={false}
        />
      </points>

      <points ref={midPointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[midPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={midMatRef}
          size={0.04}
          color={particleColor}
          transparent
          opacity={0.5}
          sizeAttenuation
          depthWrite={false}
        />
      </points>

      <points ref={fgPointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[fgPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.06}
          color={isEva ? "#7a00ff" : "#fbbf24"}
          transparent
          opacity={0.65}
          sizeAttenuation
          depthWrite={false}
        />
      </points>

      {/* Center glow core — blooms on mouse hover like the hologram showcase. */}
      <sprite ref={glowRef} position={[0, 0, -0.5]}>
        <spriteMaterial
          ref={glowMatRef}
          map={glowTexture}
          color={glowColor}
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}

function WireframeIcosahedron({ progress }: { progress?: MotionValue<number> }) {
  const { mode, design } = useTheme();
  const ref = useRef<THREE.Mesh>(null);
  const isEva = design === "eva";
  const wireColor = isEva ? (mode === "dark" ? "#39ff14" : "#ff3333") : "#4361ee";

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const p = progress?.get() ?? 0;
    ref.current.rotation.x = t * 0.06 + p * 0.6;
    ref.current.rotation.y = t * 0.09 + p * 1.0;
    ref.current.position.y = Math.sin(t * 0.5) * 0.25 - p * 0.6;
    ref.current.position.z = -1 + p * 2.2;
    const scale = 1 + p * 1.4;
    ref.current.scale.set(scale, scale, scale);
  });

  return (
    <mesh ref={ref} position={[2.6, 0.3, -1]}>
      <icosahedronGeometry args={[1.2, 1]} />
      <meshBasicMaterial color={wireColor} wireframe transparent opacity={0.25} />
    </mesh>
  );
}

export default function ParticleField({
  scrollProgress,
}: {
  scrollProgress?: MotionValue<number>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  const quality = useMemo(() => getAdaptiveQuality(), []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    return observeVisibility(el, setActive, "15% 0px");
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 8.5], fov: 42 }}
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
        <ScrollRig progress={scrollProgress} />
        <LayeredParticleSwarm progress={scrollProgress} />
        {!quality.reduceContinuousFx && (
          <WireframeIcosahedron progress={scrollProgress} />
        )}
      </Canvas>
    </div>
  );
}
