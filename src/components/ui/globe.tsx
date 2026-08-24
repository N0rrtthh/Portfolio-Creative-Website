"use client";

import { useEffect, useRef } from "react";
import { Color, Vector3 } from "three";
import ThreeGlobe from "three-globe";
import { Canvas, extend, type ThreeElement } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import countries from "@/data/globe.json";

/**
 * World — Aceternity-style interactive globe built on `three-globe`, with a
 * fully restructured animation:
 *
 *  · The ONLY persistent point is the Philippines origin (Manila) — a red
 *    beacon that gently pulses forever.
 *  · There are NO static destination points. Instead, each cycle an arc
 *    travels from the Philippines to a major city; when it arrives, a point
 *    blooms at that city, holds briefly, then SLOWLY VANISHES (shrinks away)
 *    and the animation repeats, staggered per city.
 *  · Country polygons render as a hex lattice; atmosphere glow and
 *    drag-to-rotate OrbitControls stay cinematic.
 */

declare module "@react-three/fiber" {
  interface ThreeElements {
    threeGlobe: ThreeElement<typeof ThreeGlobe>;
  }
}

extend({ ThreeGlobe });

const cameraZ = 300;
const DEG2RAD = Math.PI / 180;

/* Origin beacon — Manila, Philippines. The one point that never leaves. */
const ORIGIN = { lat: 14.5995, lng: 120.9842 };

/* Per-city animation cycle (ms). Cities are staggered so the globe always
   has 2–3 arcs in flight without ever feeling busy.
   local 0.00 → 0.35 : arc travels from PH to the city
   local 0.35 → 0.45 : point blooms in at the city
   local 0.45 → 0.95 : point slowly vanishes (radius eases to nothing)
   local 0.95 → 1.00 : rest beat, then the cycle repeats               */
const CYCLE = 7000;
const STAGGER = 900;
const TRAVEL_END = 0.35;
const POINT_IN = 0.45;
const POINT_GONE = 0.95;
const ARC_LINGER = 0.6; // arc line stays until the point is mid-fade

export type Position = {
  order: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  arcAlt: number;
  color: string;
};

export type GlobeConfig = {
  globeColor?: string;
  showAtmosphere?: boolean;
  atmosphereColor?: string;
  atmosphereAltitude?: number;
  emissive?: string;
  emissiveIntensity?: number;
  shininess?: number;
  polygonColor?: string;
  ambientLight?: string;
  directionalLeftLight?: string;
  directionalTopLight?: string;
  pointLight?: string;
  arcTime?: number;
  arcLength?: number;
  initialPosition?: { lat: number; lng: number };
  autoRotate?: boolean;
  autoRotateSpeed?: number;
};

interface WorldProps {
  globeConfig: GlobeConfig;
  data: Position[];
}

/* A live point on the globe. Color alpha can't be expressed through
   THREE.Color, so the "slow vanish" is driven by `radius` shrinking to
   nothing instead — reads identically and is renderer-proof. */
type LivePoint = {
  lat: number;
  lng: number;
  color: string;
  radius: number;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function Globe({ globeConfig, data }: WorldProps) {
  const globeRef = useRef<ThreeGlobe>(null);

  const defaultProps = {
    atmosphereColor: "#ffffff",
    showAtmosphere: true,
    atmosphereAltitude: 0.1,
    polygonColor: "rgba(255,255,255,0.7)",
    globeColor: "#1d072e",
    emissive: "#000000",
    emissiveIntensity: 0.1,
    shininess: 0.9,
    arcTime: 2450, // ≈ TRAVEL_END * CYCLE — dash lands as the point blooms
    arcLength: 0.9,
    ...globeConfig,
  };

  // Material + country lattice + timeline. One effect owns the whole show.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    /* Globe surface material. */
    const mat = globe.globeMaterial() as unknown as {
      color: Color;
      emissive: Color;
      emissiveIntensity: number;
      shininess: number;
    };
    mat.color = new Color(defaultProps.globeColor);
    mat.emissive = new Color(defaultProps.emissive);
    mat.emissiveIntensity = defaultProps.emissiveIntensity;
    mat.shininess = defaultProps.shininess;

    /* Face the Philippines toward the camera on load. */
    const focus = defaultProps.initialPosition ?? ORIGIN;
    const phi = (90 - focus.lat) * DEG2RAD;
    const theta = (focus.lng + 180) * DEG2RAD;
    const fx = -Math.sin(phi) * Math.cos(theta);
    const fz = Math.sin(phi) * Math.sin(theta);
    globe.rotation.y = -Math.atan2(fx, fz);

    /* Country hex lattice + atmosphere. */
    globe
      .hexPolygonsData((countries as { features: object[] }).features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.7)
      .showAtmosphere(defaultProps.showAtmosphere)
      .atmosphereColor(defaultProps.atmosphereColor)
      .atmosphereAltitude(defaultProps.atmosphereAltitude)
      .hexPolygonColor(() => defaultProps.polygonColor);

    /* Arc layer — accessors set once; the DATA array is swapped each tick.
       The `data` objects keep stable identity (module constants upstream),
       so three-globe's identity diff preserves in-flight dash animation. */
    globe
      .arcsData([])
      .arcStartLat((d: object) => (d as Position).startLat)
      .arcStartLng((d: object) => (d as Position).startLng)
      .arcEndLat((d: object) => (d as Position).endLat)
      .arcEndLng((d: object) => (d as Position).endLng)
      .arcColor((d: object) => (d as Position).color)
      .arcAltitude((d: object) => (d as Position).arcAlt)
      .arcDashLength(defaultProps.arcLength)
      .arcDashGap(4)
      .arcDashAnimateTime(() => defaultProps.arcTime);

    /* Point layer — rebuilt every tick: the red PH beacon plus whichever
       destination points are alive in the current cycle phase. */
    globe
      .pointsData([])
      .pointLat((d: object) => (d as LivePoint).lat)
      .pointLng((d: object) => (d as LivePoint).lng)
      .pointColor((d: object) => (d as LivePoint).color)
      .pointRadius((d: object) => (d as LivePoint).radius)
      .pointAltitude(0.01)
      .pointsMerge(true);

    const start = Date.now();
    const tick = setInterval(() => {
      const now = Date.now() - start;

      const phaseOf = (i: number) => {
        const local = ((now - i * STAGGER) % CYCLE + CYCLE) % CYCLE;
        return local / CYCLE;
      };

      /* Arcs: only cities inside their travel→linger window. */
      globe.arcsData(data.filter((_, i) => phaseOf(i) < ARC_LINGER));

      /* Points: the eternal red Philippines beacon (pulsing)… */
      const pts: LivePoint[] = [
        {
          lat: ORIGIN.lat,
          lng: ORIGIN.lng,
          color: "#ff3b3b",
          radius: 3.6 + 0.9 * Math.sin(now / 420),
        },
      ];

      /* …plus transient city points: bloom in, hold, slowly vanish. */
      data.forEach((arc, i) => {
        const local = phaseOf(i);
        let radius = 0;
        if (local >= TRAVEL_END && local < POINT_IN) {
          // Bloom in with an ease-out.
          radius = 3.2 * easeOutCubic((local - TRAVEL_END) / (POINT_IN - TRAVEL_END));
        } else if (local >= POINT_IN && local < POINT_GONE) {
          // Slow vanish — radius eases down to nothing over ~3.5s.
          radius = 3.2 * (1 - (local - POINT_IN) / (POINT_GONE - POINT_IN));
        }
        if (radius > 0.12) {
          pts.push({
            lat: arc.endLat,
            lng: arc.endLng,
            color: arc.color,
            radius,
          });
        }
      });

      globe.pointsData(pts);
    }, 90);

    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return <threeGlobe ref={globeRef} />;
}

export function World({ globeConfig, data }: WorldProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, cameraZ], fov: 45 }}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        stencil: false,
      }}
    >
      <ambientLight color={globeConfig.ambientLight} intensity={0.6} />
      <directionalLight
        color={globeConfig.directionalLeftLight}
        position={new Vector3(-400, 100, 400)}
      />
      <directionalLight
        color={globeConfig.directionalTopLight}
        position={new Vector3(-200, 500, 200)}
      />
      <pointLight
        color={globeConfig.pointLight}
        position={new Vector3(-200, 500, 200)}
        intensity={1}
      />
      <Globe globeConfig={globeConfig} data={data} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minDistance={cameraZ}
        maxDistance={cameraZ}
        autoRotateSpeed={globeConfig.autoRotateSpeed ?? 0.5}
        autoRotate={globeConfig.autoRotate ?? true}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={Math.PI - Math.PI / 3}
      />
    </Canvas>
  );
}

export function hexToRgb(hex: string) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const expanded = hex.replace(shorthandRegex, (_m, r, g, b) => {
    return r + r + g + g + b + b;
  });

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(expanded);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}