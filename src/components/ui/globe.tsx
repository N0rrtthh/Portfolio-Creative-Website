"use client";

import { useEffect, useRef, useState } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from "three";
import ThreeGlobe from "three-globe";
import {
  Canvas,
  extend,
  useFrame,
  type ThreeElement,
} from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import countries from "@/data/globe.json";

/**
 * World — interactive globe (gobold-style wireframe Earth, re-themed).
 *
 *  · SURFACE — transparent black interior: a near-black, theme-tinted
 *    sphere with a faint back-side line pass shining through, so the
 *    globe reads as a wireframe hologram. No filled continents, no
 *    textures, no oceans, no grid lines.
 *  · GEOGRAPHY = DATA — the country GeoJSON coastlines/borders are
 *    both the map and the data structure. At rest they breathe with
 *    subtle growth; under the cursor they peel off the surface with
 *    a smooth, aggressive lift and garble into corrupted, jagged
 *    lines that flare bright — then settle back when the cursor
 *    moves on (gobold-style, graceful motion). A faint static
 *    imprint stays behind where the lines lifted from.
 *  · DATA — hundreds of chaotic generative structures (vertical
 *    spikes, angular traces, floating polygon fragments, network
 *    chords, coordinate ticks) concentrated across the northern
 *    hemisphere around Europe / Northern Africa / Russia / Asia, some
 *    protruding past the surface. Deterministic seed — the same
 *    skyline every load and theme switch — and alive: structures
 *    rise and fall on smooth sine waves, lifting gracefully
 *    under the cursor.
 *  · BEACON — a warm pulsing point on Manila emitting staggered
 *    radar pings, with great-circle arcs radiating outward in
 *    staggered cycles (draw → hold → fade).
 *  · INTERACTION — cinematic HUD layer: a pulsing reticle ring rides
 *    the surface under the cursor.
 *  · COMPOSITION — full globe in frame: camera pulled back and
 *    levelled so the entire sphere floats with a little headroom.
 *  · COLORS — nothing is hardcoded. Every colour resolves live from the
 *    design tokens on <html>, so Classic/EVA × dark/light retint the
 *    whole scene automatically on theme switch.
 */

declare module "@react-three/fiber" {
  interface ThreeElements {
    threeGlobe: ThreeElement<typeof ThreeGlobe>;
  }
}

extend({ ThreeGlobe });

const DEG2RAD = Math.PI / 180;
const GLOBE_R = 100; // three-globe default globe radius
const UNIT_Z = new Vector3(0, 0, 1); // rings face +Z before orienting

/* Composition: the full globe in frame — camera pulled back and
   levelled so the entire sphere is visible with a little headroom. */
const CAMERA_POS: [number, number, number] = [0, 40, 320];
const ORBIT_TARGET: [number, number, number] = [0, 0, 0];
const ORBIT_DIST = Math.hypot(
  CAMERA_POS[0] - ORBIT_TARGET[0],
  CAMERA_POS[1] - ORBIT_TARGET[1],
  CAMERA_POS[2] - ORBIT_TARGET[2]
);

/* First-mount orientation — face the data-dense hemisphere (Europe →
   Asia) toward the camera. */
const INITIAL_FOCUS = { lat: 25, lng: 50 };

/* Country outlines as the living data structure — at rest they
   breathe with subtle growth; under the cursor they peel off
   smoothly (aggressive height, graceful motion) and garble into
   corrupted, jagged coastlines. */
const OUTLINE_HOVER_RADIUS = 0.55; // radians of cursor influence
const OUTLINE_HOVER_LIFT = 22; // max radial peel at the cursor centre
const OUTLINE_EASE_UP = 0.14; // peel easing per frame (smooth snap)
const OUTLINE_EASE_DOWN = 0.06; // settle easing per frame
const OUTLINE_GARBLE_RADIAL = 5; // max radial garble under the cursor
const OUTLINE_GARBLE_TANGENT = 3; // max sideways garble under the cursor

/* Manila beacon + radiating great-circle arcs. */
const ORIGIN = { lat: 14.5995, lng: 120.9842 }; // Manila
const ARC_SEGMENTS = 64; // vertices per arc curve
const ARC_CYCLE = 7.0; // seconds per full arc cycle
const ARC_DRAW = 2.2; // seconds to draw the arc out
const ARC_HOLD_END = 5.2; // fully drawn, holding until here
const ARC_STAGGER = 0.55; // delay between arc orders

/* Country outlines. */
const OUTLINE_ALT = 0.6;
const MAX_JUMP_DEG = 12; // skip antimeridian-wrapping artefacts

/* Cinematic interaction layer — radar pings and hover reticle. */
const PING_COUNT = 2; // staggered radar pings from the beacon
const PING_PERIOD = 2.6; // seconds per ping cycle
const PING_MAX_R = 22; // ping ring scale at end of cycle
const RETICLE_ALT = 1.5; // reticle altitude above the surface

/* Chaotic data structures over the northern hemisphere — the upward
   data skyline (vertical spikes, angular traces, floating polygon
   fragments, network chords, coordinate ticks). Deterministic seed:
   the same skyline every load and theme switch. */
const DATA_STRUCTURES = 780; // seeds (each emits 1–6 segments)
const DATA_HOVER_RADIUS = 0.85; // radians of cursor influence (wide field)
const DATA_HOVER_LIFT = 26; // max outward lift at the cursor centre

export type GlobeConfig = {
  showAtmosphere?: boolean;
  atmosphereAltitude?: number;
  initialPosition?: { lat: number; lng: number };
  autoRotate?: boolean;
  autoRotateSpeed?: number;
};

/* Arc payload — one great-circle flight out of Manila. */
export type Position = {
  order: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  arcAlt: number;
};

interface WorldProps {
  data?: Position[];
  globeConfig: GlobeConfig;
}

/* Stable empty arc list — avoids rebuilding the scene when no data is
   passed (a fresh [] literal would change identity every render). */
const NO_ARCS: Position[] = [];

/* GeoJSON shapes consumed from globe.json (Natural Earth admin-0). */
type GeoRing = [number, number][]; // [lng, lat]
type GeoFeature = {
  geometry?: {
    type: "Polygon" | "MultiPolygon";
    coordinates: GeoRing[] | GeoRing[][];
  };
};

/* ── Theme palette ────────────────────────────────────────────────────
   Read the design tokens off <html>. The surface stays dark in every
   theme (the globe reads as a display), tinted toward the accent. */
type GlobePalette = {
  /** Country outlines — the bright geography lines. */
  outline: [number, number, number];
  /** Data structures at rest + fur base. */
  dataDim: [number, number, number];
  /** Bright data lines + fur tips. */
  dataLit: [number, number, number];
  /** Beacon + radar pings — the warm accent point (Manila). */
  warm: string;
  /** Arc lines radiating from the beacon. */
  arc: string;
  /** Atmosphere rim. */
  atmo: string;
  /** Globe surface (near-black, theme-tinted). */
  ocean: string;
  /** Surface emissive tint (deep navy glow). */
  emissive: string;
  /** Globe surface opacity (transparent-black interior). */
  oceanOpacity: number;
};

const FALLBACK_PALETTE: GlobePalette = {
  outline: [0.42, 0.5, 0.96],
  dataDim: [0.32, 0.38, 0.87],
  dataLit: [0.76, 0.78, 0.98],
  warm: "#fbbf24",
  arc: "#4361ee",
  atmo: "#6366f1",
  ocean: "#05060f",
  emissive: "#0e1534",
  oceanOpacity: 0.82,
};

function resolvePalette(): GlobePalette {
  if (typeof window === "undefined") return FALLBACK_PALETTE;
  const css = getComputedStyle(document.documentElement);
  const read = (token: string, fallback: string) => {
    const v = css.getPropertyValue(token).trim();
    return v.length > 0 ? v : fallback;
  };

  const black = new Color("#000000");
  const white = new Color("#ffffff");
  const primary = new Color(read("--color-accent-primary", "#4361ee"));
  const secondary = new Color(read("--color-accent-secondary", "#818cf8"));
  const atmo = read("--color-accent-glow", "#6366f1");
  const voidC = new Color(read("--color-void", "#020204"));

  /* Surface: void pulled hard toward black, then tinted with the accent
     so the globe belongs to the active theme instead of one fixed hue. */
  const ocean =
    "#" + voidC.clone().lerp(black, 0.7).lerp(primary, 0.1).getHexString();
  const emissive = "#" + primary.clone().lerp(black, 0.78).getHexString();

  /* Line colours: outlines and data structures carry the accent (the
     reference's neon role); the beacon takes the warm token. */
  const outline = primary.clone().lerp(white, 0.28);
  const dataDim = primary.clone().lerp(black, 0.25);
  const dataLit = secondary.clone().lerp(white, 0.45);
  const warm = read("--color-accent-warm", "#fbbf24");

  return {
    outline: [outline.r, outline.g, outline.b],
    dataDim: [dataDim.r, dataDim.g, dataDim.b],
    dataLit: [dataLit.r, dataLit.g, dataLit.b],
    warm,
    arc: "#" + primary.getHexString(),
    atmo,
    ocean,
    emissive,
    oceanOpacity: 0.82,
  };
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/* Deterministic RNG (mulberry32) — the data skyline must be identical
   on every load and every theme switch. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Deterministic per-direction hash — grid vertices that share a
   position (segment joins) must share motion parameters so the lines
   stay connected while animating. */
function dirHash(x: number, y: number, z: number, salt: number): number {
  const s =
    Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + salt * 53.3) * 43758.5453;
  return s - Math.floor(s);
}

/* lat/lng → 3D point on a sphere of radius r. MUST mirror three-globe's
   internal polar2Cartesian exactly (phi = 90-lat, theta = 90-lng). */
function latLngToVec3(lat: number, lng: number, r: number): Vector3 {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (90 - lng) * DEG2RAD;
  const phiSin = Math.sin(phi);
  return new Vector3(
    r * phiSin * Math.cos(theta),
    r * Math.cos(phi),
    r * phiSin * Math.sin(theta)
  );
}

/* Animated country outlines: per-vertex radial direction + tangent,
   rest radius, idle-growth params, garble seed/strength and the
   eased hover-lift state — mutated in the frame loop. */
type DataFx = {
  posAttr: Float32BufferAttribute;
  colAttr: Float32BufferAttribute;
  baseCol: Float32Array;
  dir: Float32Array; // unit radial direction per vertex
  tan: Float32Array; // unit tangent per vertex (sideways garble)
  baseR: Float32Array; // rest radius per vertex
  amp: Float32Array; // idle breathing amplitude
  phase: Float32Array; // idle phase
  speed: Float32Array; // idle speed
  garblePhase: Float32Array; // per-vertex garble seed
  garbleAmp: Float32Array; // per-vertex garble strength (0..1)
  lift: Float32Array; // eased hover lift state
};

/* Manila beacon + radiating arcs state, animated in the frame loop. */
type ArcField = {
  beacon: Mesh;
  arcs: Array<{
    line: Line;
    mat: LineBasicMaterial;
    vertexCount: number;
    delay: number;
    dot: Mesh;
    dotMat: MeshBasicMaterial;
  }>;
};

/* Beacon ping: an ever-looping expanding radar ring at the origin. */
type Ping = { mesh: Mesh; mat: MeshBasicMaterial };

/* Animated data-structure lines: per-vertex base position/colour,
   radial direction, amplitude and flicker phase/speed — mutated in
   the frame loop (breathing motion + hover reaction). */
type StructFx = {
  posAttr: Float32BufferAttribute;
  colAttr: Float32BufferAttribute;
  basePos: Float32Array;
  baseCol: Float32Array;
  dir: Float32Array;
  amp: Float32Array;
  phase: Float32Array;
  speed: Float32Array;
  lift: Float32Array;
};

/* ── Globe surface (three-globe): transparent-black sphere + atmosphere.
      Outlines (the living data layer) / beacon are custom, built in
      <GlobeFX>. ── */
function Globe({
  globeRef,
  globeConfig,
  palette,
}: {
  globeRef: React.RefObject<ThreeGlobe | null>;
  globeConfig: GlobeConfig;
  palette: GlobePalette;
}) {
  const oriented = useRef(false);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const mat = globe.globeMaterial() as unknown as {
      color: Color;
      emissive: Color;
      emissiveIntensity: number;
      shininess: number;
      transparent: boolean;
      opacity: number;
    };
    mat.color = new Color(palette.ocean);
    mat.emissive = new Color(palette.emissive);
    mat.emissiveIntensity = 0.5;
    mat.shininess = 0.6;
    /* Transparent-black interior — the faint back-side line pass shines
       through, so the sphere reads as a wireframe hologram. */
    mat.transparent = true;
    mat.opacity = palette.oceanOpacity;

    /* Face the data-dense hemisphere toward the camera on first mount
       only — a theme switch must not undo where the user spun it. */
    if (!oriented.current) {
      const focus = globeConfig.initialPosition ?? INITIAL_FOCUS;
      const focusPos = latLngToVec3(focus.lat, focus.lng, GLOBE_R);
      globe.rotation.y = Math.atan2(-focusPos.x, focusPos.z);
      oriented.current = true;
    }

    globe
      .showAtmosphere(globeConfig.showAtmosphere ?? true)
      .atmosphereColor(palette.atmo)
      .atmosphereAltitude(globeConfig.atmosphereAltitude ?? 0.1);

    /* Draw order: faint back-side lines (0) → sphere (1) → sharp front
       lines (2+). The sphere keeps writing depth, so front-pass
       geometry is properly hidden past the horizon. */
    globe.renderOrder = 1;
  }, [globeRef, globeConfig, palette]);

  return <threeGlobe ref={globeRef} />;
}

/* ── Country outlines (the living data layer) + radial spike field +
      Manila beacon/arcs + cinematic interaction (reticle / pings).
      All parented to the globe so they rotate with it. ── */
function GlobeFX({
  globeRef,
  palette,
  data,
}: {
  globeRef: React.RefObject<ThreeGlobe | null>;
  palette: GlobePalette;
  data: Position[];
}) {
  const dataFxRef = useRef<DataFx | null>(null);
  const structFxRef = useRef<StructFx | null>(null);
  const arcsRef = useRef<ArcField | null>(null);
  const pingsRef = useRef<Ping[]>([]);
  const reticleRef = useRef<Group | null>(null);
  const reticleMatRef = useRef<MeshBasicMaterial | null>(null);
  const hoverSphereRef = useRef<Mesh | null>(null);
  const hoverNormal = useRef<Vector3 | null>(null);
  const raycaster = useRef(new Raycaster());

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const group = new Group();
    const disposables: Array<{ dispose: () => void }> = [];

    /* ── Country outlines: the GeoJSON rings as precise thin vector
          coastlines/borders wrapped on the surface — and the living
          data structure. The faint back pass stays static (a ghost
          imprint); the bright front pass breathes subtly at rest and
          peels off + garbles under the cursor. ── */
    const outlineSegs: number[] = [];
    const features = (countries as unknown as { features: GeoFeature[] })
      .features;
    for (const f of features) {
      const geom = f.geometry;
      if (!geom) continue;
      const polys =
        geom.type === "Polygon"
          ? [geom.coordinates as GeoRing[]]
          : (geom.coordinates as GeoRing[][]);
      for (const poly of polys) {
        for (const ring of poly) {
          for (let i = 0; i < ring.length - 1; i++) {
            const [lng1, lat1] = ring[i];
            const [lng2, lat2] = ring[i + 1];
            if (Math.abs(lng2 - lng1) > MAX_JUMP_DEG) continue;
            const a = latLngToVec3(lat1, lng1, GLOBE_R + OUTLINE_ALT);
            const b = latLngToVec3(lat2, lng2, GLOBE_R + OUTLINE_ALT);
            outlineSegs.push(a.x, a.y, a.z, b.x, b.y, b.z);
          }
        }
      }
    }

    /* Back pass — static ghost imprint (also visible through the
       transparent surface). */
    const outlineGeo = new BufferGeometry();
    outlineGeo.setAttribute(
      "position",
      new Float32BufferAttribute(outlineSegs, 3)
    );
    const outlineMatBack = new LineBasicMaterial({
      color: new Color(...palette.outline),
      transparent: true,
      opacity: 0.14,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    const outlineBack = new LineSegments(outlineGeo, outlineMatBack);
    outlineBack.renderOrder = 0;
    group.add(outlineBack);

    /* Front pass — the animated data layer (lift + garble). */
    const vertexCount = outlineSegs.length / 3;
    const outlinePosAttr = new Float32BufferAttribute(outlineSegs, 3);
    outlinePosAttr.setUsage(DynamicDrawUsage);
    const outlineColArr = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
      outlineColArr[i * 3] = palette.outline[0];
      outlineColArr[i * 3 + 1] = palette.outline[1];
      outlineColArr[i * 3 + 2] = palette.outline[2];
    }
    const outlineColAttr = new Float32BufferAttribute(outlineColArr, 3);
    outlineColAttr.setUsage(DynamicDrawUsage);
    const outlineFxGeo = new BufferGeometry();
    outlineFxGeo.setAttribute("position", outlinePosAttr);
    outlineFxGeo.setAttribute("color", outlineColAttr);
    const outlineMatFront = new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const outlineFront = new LineSegments(outlineFxGeo, outlineMatFront);
    outlineFront.renderOrder = 2;
    group.add(outlineFront);
    disposables.push(outlineGeo, outlineMatBack, outlineFxGeo, outlineMatFront);

    /* Per-vertex motion params — derived from the direction hash so
       the duplicated vertices at segment joins animate identically
       (coastlines bend and garble but never tear apart). */
    const dirArr = new Float32Array(vertexCount * 3);
    const tanArr = new Float32Array(vertexCount * 3);
    const baseRArr = new Float32Array(vertexCount);
    const ampArr = new Float32Array(vertexCount);
    const phaseArr = new Float32Array(vertexCount);
    const speedArr = new Float32Array(vertexCount);
    const garblePhaseArr = new Float32Array(vertexCount);
    const garbleAmpArr = new Float32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      const x = outlineSegs[i * 3];
      const y = outlineSegs[i * 3 + 1];
      const z = outlineSegs[i * 3 + 2];
      const r = Math.sqrt(x * x + y * y + z * z);
      const dx = x / r;
      const dy = y / r;
      const dz = z / r;
      dirArr[i * 3] = dx;
      dirArr[i * 3 + 1] = dy;
      dirArr[i * 3 + 2] = dz;
      baseRArr[i] = r;
      /* Sideways-garble tangent (horizontal, ≈ east). */
      let tx = dz;
      let tz = -dx;
      const tlen = Math.hypot(tx, tz);
      if (tlen < 1e-4) {
        tx = 1; // pole fallback
        tz = 0;
      } else {
        tx /= tlen;
        tz /= tlen;
      }
      tanArr[i * 3] = tx;
      tanArr[i * 3 + 1] = 0;
      tanArr[i * 3 + 2] = tz;
      const h = (salt: number) => dirHash(dx, dy, dz, salt);
      ampArr[i] = 0.25 + h(1) * 0.65; // subtle idle growth
      phaseArr[i] = h(2) * Math.PI * 2;
      speedArr[i] = 0.25 + h(3) * 0.8;
      garblePhaseArr[i] = h(4) * Math.PI * 2;
      garbleAmpArr[i] = 0.3 + h(5) * 0.7;
    }
    dataFxRef.current = {
      posAttr: outlinePosAttr,
      colAttr: outlineColAttr,
      baseCol: Float32Array.from(outlineColArr),
      dir: dirArr,
      tan: tanArr,
      baseR: baseRArr,
      amp: ampArr,
      phase: phaseArr,
      speed: speedArr,
      garblePhase: garblePhaseArr,
      garbleAmp: garbleAmpArr,
      lift: new Float32Array(vertexCount),
    };

    /* ── Chaotic data structures over the northern hemisphere:
          vertical spikes, angular traces, floating polygon fragments,
          network chords and coordinate ticks. Deterministic seed. ── */
    const rand = mulberry32(1337);
    const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;

    /* lat, lng, weight, spread(deg) — densest around Europe, Northern
       Africa, Russia and Asia; sparser elsewhere for asymmetry. */
    const HOTSPOTS: Array<[number, number, number, number]> = [
      [48, 8, 1.6, 12],
      [52, 30, 1.2, 10],
      [58, 70, 1.5, 18],
      [50, 110, 1.2, 15],
      [35, 115, 1.3, 12],
      [28, 45, 1.0, 10],
      [28, 15, 0.9, 12],
      [22, 78, 0.8, 9],
      [12, 121, 0.7, 8],
      [42, -95, 0.7, 14],
      [-15, -55, 0.4, 10],
      [-26, 25, 0.4, 8],
      [-25, 135, 0.4, 8],
    ];
    const totalWeight = HOTSPOTS.reduce((s, h) => s + h[2], 0);
    const pickSpot = (): [number, number] => {
      let t = rand() * totalWeight;
      for (const [lat, lng, w, spread] of HOTSPOTS) {
        t -= w;
        if (t <= 0) {
          return [lat + gauss() * spread, lng + gauss() * spread];
        }
      }
      return [HOTSPOTS[0][0], HOTSPOTS[0][1]];
    };

    const tangentFrame = (n: Vector3): [Vector3, Vector3] => {
      const up =
        Math.abs(n.y) > 0.93 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
      const t1 = new Vector3().crossVectors(n, up).normalize();
      const t2 = new Vector3().crossVectors(n, t1).normalize();
      return [t1, t2];
    };

    const structPos: number[] = [];
    const structCol: number[] = [];
    const structDir: number[] = [];
    const structAmp: number[] = [];
    const structPhase: number[] = [];
    const structSpeed: number[] = [];
    /* Per-structure motion/flicker params, assigned before each
       structure. */
    let seedPhase = 0;
    let seedSpeed = 1;
    let seedAmp = 1;
    const pushSeg = (a: Vector3, b: Vector3, lit: boolean) => {
      const c = lit ? palette.dataLit : palette.dataDim;
      structPos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      structCol.push(c[0], c[1], c[2], c[0], c[1], c[2]);
      structPhase.push(seedPhase, seedPhase);
      structSpeed.push(seedSpeed, seedSpeed);
      /* Radial direction + altitude-scaled amplitude: vertices higher
         above the surface travel further (spike tips bob, bases stay
         anchored, fragments float). */
      for (const v of [a, b]) {
        const r = v.length();
        const inv = r > 0.0001 ? 1 / r : 0;
        structDir.push(v.x * inv, v.y * inv, v.z * inv);
        structAmp.push(seedAmp * clamp((r - GLOBE_R) / 12, 0.12, 1));
      }
    };
    for (let s = 0; s < DATA_STRUCTURES; s++) {
      seedPhase = rand() * Math.PI * 2;
      seedSpeed = 0.9 + rand() * 1.6;
      seedAmp = 3 + rand() * 6;
      const [lat, lng] = pickSpot();
      const n = latLngToVec3(lat, lng, 1).normalize();
      const [t1, t2] = tangentFrame(n);
      const lit = rand() < 0.16; // subtle glow on selected lines
      const kind = rand();

      if (kind < 0.34) {
        /* Vertical spike — the tall ones protrude past the surface. */
        const tall = rand() < 0.09;
        const len = tall ? 24 + rand() * 18 : 2.5 + rand() * 14;
        const r0 = GLOBE_R + 0.5;
        pushSeg(
          n.clone().multiplyScalar(r0),
          n.clone().multiplyScalar(r0 + len),
          lit || tall
        );
        if (tall && rand() < 0.6) {
          /* Glitched coordinate tick across the tip. */
          const tip = n.clone().multiplyScalar(r0 + len);
          const side = t1.clone().multiplyScalar(1.6 + rand() * 2);
          pushSeg(tip.clone().sub(side), tip.clone().add(side), true);
        }
      } else if (kind < 0.58) {
        /* Angular random-walk trace hugging the surface. */
        let cur = n.clone();
        let alt = 0.6 + rand() * 2.5;
        const steps = 3 + Math.floor(rand() * 4);
        for (let i = 0; i < steps; i++) {
          const [u1, u2] = tangentFrame(cur);
          const next = cur
            .clone()
            .add(u1.multiplyScalar((rand() - 0.5) * 0.22))
            .add(u2.multiplyScalar((rand() - 0.5) * 0.22))
            .normalize();
          const nextAlt = 0.6 + rand() * 4;
          pushSeg(
            cur.clone().multiplyScalar(GLOBE_R + alt),
            next.clone().multiplyScalar(GLOBE_R + nextAlt),
            lit
          );
          cur = next;
          alt = nextAlt;
        }
      } else if (kind < 0.74) {
        /* Irregular polygon fragment floating above the surface. */
        const sides = 3 + Math.floor(rand() * 3);
        const alt = 2 + rand() * 7;
        const angR = (2 + rand() * 4.5) / GLOBE_R;
        const pts: Vector3[] = [];
        for (let i = 0; i < sides; i++) {
          const ang = (i / sides) * Math.PI * 2 + rand() * 0.8;
          const dir = n
            .clone()
            .add(t1.clone().multiplyScalar(Math.cos(ang) * angR))
            .add(t2.clone().multiplyScalar(Math.sin(ang) * angR))
            .normalize();
          pts.push(dir.multiplyScalar(GLOBE_R + alt + (rand() - 0.5) * 2));
        }
        for (let i = 0; i < sides; i++) {
          pushSeg(pts[i], pts[(i + 1) % sides], lit);
        }
      } else if (kind < 0.9) {
        /* Network chord to a nearby point, lifted off the surface. */
        const m = latLngToVec3(
          lat + gauss() * 9,
          lng + gauss() * 9,
          1
        ).normalize();
        const a = n.clone().multiplyScalar(GLOBE_R + 0.6);
        const b = m.clone().multiplyScalar(GLOBE_R + 0.6);
        const mid = n
          .clone()
          .add(m)
          .normalize()
          .multiplyScalar(GLOBE_R + 3.5 + rand() * 4);
        pushSeg(a, mid, lit);
        pushSeg(mid, b, lit);
      } else {
        /* Radial tick cluster — fragmented 3D coordinates. */
        const ticks = 2 + Math.floor(rand() * 3);
        for (let i = 0; i < ticks; i++) {
          const dir = n
            .clone()
            .add(t1.clone().multiplyScalar((rand() - 0.5) * 0.3))
            .add(t2.clone().multiplyScalar((rand() - 0.5) * 0.3))
            .normalize();
          const r0 = GLOBE_R + 0.5 + rand() * 5;
          const len = 1 + rand() * 3.5;
          pushSeg(
            dir.clone().multiplyScalar(r0),
            dir.clone().multiplyScalar(r0 + len),
            lit
          );
        }
      }
    }

    const structGeo = new BufferGeometry();
    const structPosAttr = new Float32BufferAttribute(structPos, 3);
    structPosAttr.setUsage(DynamicDrawUsage);
    structGeo.setAttribute("position", structPosAttr);
    const structColAttr = new Float32BufferAttribute(structCol, 3);
    structColAttr.setUsage(DynamicDrawUsage);
    structGeo.setAttribute("color", structColAttr);
    const structMat = new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const structLines = new LineSegments(structGeo, structMat);
    structLines.renderOrder = 2;
    group.add(structLines);
    disposables.push(structGeo, structMat);
    structFxRef.current = {
      posAttr: structPosAttr,
      colAttr: structColAttr,
      basePos: Float32Array.from(structPos),
      baseCol: Float32Array.from(structCol),
      dir: Float32Array.from(structDir),
      amp: Float32Array.from(structAmp),
      phase: Float32Array.from(structPhase),
      speed: Float32Array.from(structSpeed),
      lift: new Float32Array(structPos.length / 3),
    };

    /* ── Manila beacon — warm pulsing point emitting staggered radar
          pings, the single origin of every arc. ── */
    const originPos = latLngToVec3(ORIGIN.lat, ORIGIN.lng, GLOBE_R + 1.2);
    const beaconMat = new MeshBasicMaterial({
      color: new Color(palette.warm),
      transparent: true,
      opacity: 1,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const beacon = new Mesh(new SphereGeometry(2.2, 16, 16), beaconMat);
    beacon.position.copy(originPos);
    beacon.renderOrder = 3;
    group.add(beacon);

    const pingGeo = new RingGeometry(0.94, 1, 48);
    const pingNormal = originPos.clone().normalize();
    const pings: Ping[] = [];
    for (let i = 0; i < PING_COUNT; i++) {
      const mat = new MeshBasicMaterial({
        color: new Color(palette.warm),
        transparent: true,
        opacity: 0,
        side: DoubleSide,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new Mesh(pingGeo, mat);
      mesh.position.copy(originPos);
      mesh.quaternion.setFromUnitVectors(UNIT_Z, pingNormal);
      mesh.scale.setScalar(0.001);
      mesh.renderOrder = 3;
      group.add(mesh);
      pings.push({ mesh, mat });
      disposables.push(mat);
    }
    pingsRef.current = pings;
    disposables.push(beacon.geometry, beaconMat, pingGeo);

    /* ── Great-circle arcs radiating out of Manila — staggered by
          order, each cycling: draw → hold → fade → repeat. ── */
    const arcFxs: ArcField["arcs"] = [];
    for (const p of data) {
      const a = latLngToVec3(p.startLat, p.startLng, 1).normalize();
      const b = latLngToVec3(p.endLat, p.endLng, 1).normalize();
      const angle = Math.max(a.angleTo(b), 0.001);
      const pts: Vector3[] = [];
      for (let i = 0; i <= ARC_SEGMENTS; i++) {
        const t = i / ARC_SEGMENTS;
        const dir = a
          .clone()
          .multiplyScalar(Math.sin((1 - t) * angle))
          .add(b.clone().multiplyScalar(Math.sin(t * angle)))
          .divideScalar(Math.sin(angle))
          .normalize();
        const r = GLOBE_R + 0.8 + Math.sin(Math.PI * t) * p.arcAlt * GLOBE_R;
        pts.push(dir.multiplyScalar(r));
      }
      const arcGeo = new BufferGeometry().setFromPoints(pts);
      const arcMat = new LineBasicMaterial({
        color: new Color(palette.arc),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const line = new Line(arcGeo, arcMat);
      line.renderOrder = 2;
      line.geometry.setDrawRange(0, 0);
      group.add(line);

      const dotMat = new MeshBasicMaterial({
        color: new Color(...palette.dataLit),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const dot = new Mesh(new SphereGeometry(1.4, 12, 12), dotMat);
      dot.position.copy(pts[ARC_SEGMENTS]);
      dot.scale.setScalar(0.001);
      dot.renderOrder = 3;
      group.add(dot);

      arcFxs.push({
        line,
        mat: arcMat,
        vertexCount: ARC_SEGMENTS + 1,
        delay: p.order * ARC_STAGGER,
        dot,
        dotMat,
      });
      disposables.push(arcGeo, arcMat, dot.geometry, dotMat);
    }
    arcsRef.current = { beacon, arcs: arcFxs };

    /* ── Invisible raycast sphere (catches the pointer). ── */
    const hoverSphere = new Mesh(
      new SphereGeometry(GLOBE_R, 32, 32),
      new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hoverSphereRef.current = hoverSphere;
    group.add(hoverSphere);

    /* ── Hover reticle — a pulsing ring + dot that rides the surface
          under the cursor. ── */
    const reticleMat = new MeshBasicMaterial({
      color: new Color(...palette.outline),
      transparent: true,
      opacity: 0,
      side: DoubleSide,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const reticle = new Group();
    const reticleRing = new Mesh(new RingGeometry(3.2, 3.9, 40), reticleMat);
    const reticleDot = new Mesh(new SphereGeometry(0.9, 10, 10), reticleMat);
    reticleRing.renderOrder = 3;
    reticleDot.renderOrder = 3;
    reticle.add(reticleRing);
    reticle.add(reticleDot);
    reticle.visible = false;
    reticleRef.current = reticle;
    reticleMatRef.current = reticleMat;
    group.add(reticle);
    disposables.push(reticleRing.geometry, reticleDot.geometry, reticleMat);

    globe.add(group);

    return () => {
      globe.remove(group);
      disposables.forEach((d) => d.dispose());
      (hoverSphere.material as MeshBasicMaterial).dispose();
      hoverSphere.geometry.dispose();
      dataFxRef.current = null;
      structFxRef.current = null;
      arcsRef.current = null;
      pingsRef.current = [];
      reticleRef.current = null;
      reticleMatRef.current = null;
    };
  }, [globeRef, palette, data]);

  /* eslint-disable react-hooks/immutability -- Three.js objects are
     handles to GPU state, not React view state: animating the data
     outlines, data structures, beacon and arcs means writing their attributes
     on every frame. The compiler's immutability rule does not model
     R3F frame loops. */
  useFrame((state, delta) => {
    const globe = globeRef.current;
    if (!globe) return;
    /* ── Hover: raycast to find the surface point under the cursor. ── */
    const hoverSphere = hoverSphereRef.current;
    if (hoverSphere) {
      raycaster.current.setFromCamera(state.pointer, state.camera);
      const hits = raycaster.current.intersectObject(hoverSphere, false);
      if (hits.length > 0) {
        hoverNormal.current = globe
          .worldToLocal(hits[0].point.clone())
          .normalize();
      } else {
        hoverNormal.current = null;
      }
    }

    /* ── The country outlines are alive: subtle growth breathing at
          rest; under the cursor they peel off smoothly (aggressive
          height, graceful easing — never jittery) and garble into
          jagged, corrupted coastlines that flare bright. ── */
    const dataFx = dataFxRef.current;
    if (dataFx) {
      const t = state.clock.elapsedTime;
      const pos = dataFx.posAttr.array as Float32Array;
      const col = dataFx.colAttr.array as Float32Array;
      const hn = hoverNormal.current;
      const cosRadius = Math.cos(OUTLINE_HOVER_RADIUS);
      for (let i = 0; i < dataFx.lift.length; i++) {
        const i3 = i * 3;
        const dx = dataFx.dir[i3];
        const dy = dataFx.dir[i3 + 1];
        const dz = dataFx.dir[i3 + 2];

        /* Idle: subtle smooth growth. */
        const w = 0.5 + 0.5 * Math.sin(t * dataFx.speed[i] + dataFx.phase[i]);
        const grow = w * w * (3 - 2 * w);
        const idle = dataFx.amp[i] * grow;

        /* Hover proximity → eased lift: aggressive height, graceful
           motion (snap up, settle down — no jitter). */
        let target = 0;
        if (hn) {
          const cosAng = dx * hn.x + dy * hn.y + dz * hn.z;
          if (cosAng > cosRadius) {
            const prox = (cosAng - cosRadius) / (1 - cosRadius);
            target = prox * prox * (3 - 2 * prox) * OUTLINE_HOVER_LIFT;
          }
        }
        const ease =
          target > dataFx.lift[i] ? OUTLINE_EASE_UP : OUTLINE_EASE_DOWN;
        dataFx.lift[i] += (target - dataFx.lift[i]) * ease;
        const lift = dataFx.lift[i];
        const heat = lift / OUTLINE_HOVER_LIFT; // eased hover intensity

        /* Garble: per-vertex random offsets — smooth in time, jagged
           in space — so lifted lines read as corrupted data. */
        const gp = dataFx.garblePhase[i];
        const gAmt = heat * dataFx.garbleAmp[i];
        const gRad =
          Math.sin(t * 2.1 + gp * 13) * 0.65 +
          Math.sin(t * 4.7 + gp * 29) * 0.35;
        const gTan = Math.sin(t * 3.3 + gp * 17);
        const r =
          dataFx.baseR[i] + idle + lift + gAmt * OUTLINE_GARBLE_RADIAL * gRad;
        const side = gAmt * OUTLINE_GARBLE_TANGENT * gTan;

        pos[i3] = dx * r + dataFx.tan[i3] * side;
        pos[i3 + 1] = dy * r + dataFx.tan[i3 + 1] * side;
        pos[i3 + 2] = dz * r + dataFx.tan[i3 + 2] * side;

        /* Gentle glow while growing; hot flare while peeling. */
        const bright = 0.8 + 0.2 * grow + heat * 1.6;
        col[i3] = Math.min(1, dataFx.baseCol[i3] * bright);
        col[i3 + 1] = Math.min(1, dataFx.baseCol[i3 + 1] * bright);
        col[i3 + 2] = Math.min(1, dataFx.baseCol[i3 + 2] * bright);
      }
      dataFx.posAttr.needsUpdate = true;
      dataFx.colAttr.needsUpdate = true;
    }

    /* ── Data structures breathe — each vertex rises and falls along
          its radial direction on one smooth sine; brightness
          swells gently with the motion. Hover lifts structures
          gracefully toward the cursor and flares them. ── */
    const structFx = structFxRef.current;
    if (structFx) {
      const t = state.clock.elapsedTime;
      const pos = structFx.posAttr.array as Float32Array;
      const col = structFx.colAttr.array as Float32Array;
      const hn = hoverNormal.current;
      const cosRadius = Math.cos(DATA_HOVER_RADIUS);
      const ease = Math.min(1, delta * 5);
      for (let i = 0; i < structFx.phase.length; i++) {
        /* Idle: one smooth sine — a clear, gentle up-and-down bob. */
        const w = Math.sin(t * structFx.speed[i] + structFx.phase[i]);
        const bob = structFx.amp[i] * w;
        /* Brightness breathes with the motion — no hard flashes. */
        let bright = 0.5 + 0.45 * (0.5 + 0.5 * w);

        /* Hover: ease each vertex's lift toward its target so
           structures rise and settle gracefully near the cursor. */
        let target = 0;
        if (hn) {
          const dx = structFx.dir[i * 3];
          const dy = structFx.dir[i * 3 + 1];
          const dz = structFx.dir[i * 3 + 2];
          const cosAng = dx * hn.x + dy * hn.y + dz * hn.z;
          if (cosAng > cosRadius) {
            const prox = (cosAng - cosRadius) / (1 - cosRadius);
            const smooth = prox * prox * (3 - 2 * prox);
            target = smooth * DATA_HOVER_LIFT;
          }
        }
        structFx.lift[i] += (target - structFx.lift[i]) * ease;
        const hoverF = Math.min(1, structFx.lift[i] / DATA_HOVER_LIFT);
        if (hoverF > 0.01) {
          bright = Math.max(bright, 0.6 + 0.5 * hoverF);
        }
        const off = bob + structFx.lift[i];

        pos[i * 3] = structFx.basePos[i * 3] + structFx.dir[i * 3] * off;
        pos[i * 3 + 1] =
          structFx.basePos[i * 3 + 1] + structFx.dir[i * 3 + 1] * off;
        pos[i * 3 + 2] =
          structFx.basePos[i * 3 + 2] + structFx.dir[i * 3 + 2] * off;
        col[i * 3] = Math.min(1, structFx.baseCol[i * 3] * bright);
        col[i * 3 + 1] = Math.min(1, structFx.baseCol[i * 3 + 1] * bright);
        col[i * 3 + 2] = Math.min(1, structFx.baseCol[i * 3 + 2] * bright);
      }
      structFx.posAttr.needsUpdate = true;
      structFx.colAttr.needsUpdate = true;
    }

    /* ── Beacon radar pings — staggered looping rings. ── */
    const tPing = state.clock.elapsedTime;
    pingsRef.current.forEach((p, i) => {
      const phase =
        (((tPing + (i * PING_PERIOD) / PING_COUNT) % PING_PERIOD) +
          PING_PERIOD) %
        PING_PERIOD;
      const pt = phase / PING_PERIOD;
      p.mesh.scale.setScalar(Math.max(0.001, easeOutCubic(pt) * PING_MAX_R));
      p.mat.opacity = (1 - pt) * 0.5;
    });

    /* ── Hover reticle rides the surface under the cursor. ── */
    const reticle = reticleRef.current;
    const reticleMat = reticleMatRef.current;
    if (reticle && reticleMat) {
      const hn = hoverNormal.current;
      if (hn) {
        reticle.visible = true;
        reticle.position.copy(hn.clone().multiplyScalar(GLOBE_R + RETICLE_ALT));
        reticle.quaternion.setFromUnitVectors(UNIT_Z, hn);
        reticle.scale.setScalar(1 + 0.12 * Math.sin(tPing * 5.5));
        reticleMat.opacity += (0.9 - reticleMat.opacity) * 0.2;
      } else {
        reticleMat.opacity += (0 - reticleMat.opacity) * 0.2;
        if (reticleMat.opacity < 0.02) reticle.visible = false;
      }
    }

    /* ── Beacon pulse + arc cycle (draw → hold → fade → repeat). ── */
    const arcFx = arcsRef.current;
    if (arcFx) {
      const t = state.clock.elapsedTime;
      /* Beacon breathes. */
      arcFx.beacon.scale.setScalar(1 + 0.22 * Math.sin(t * 2.6));

      for (const arc of arcFx.arcs) {
        if (t < arc.delay) {
          arc.mat.opacity = 0;
          arc.line.geometry.setDrawRange(0, 0);
          arc.dotMat.opacity = 0;
          arc.dot.scale.setScalar(0.001);
          continue;
        }
        const tt = (t - arc.delay) % ARC_CYCLE;
        let draw = 1;
        let opacity = 0.85;
        if (tt < ARC_DRAW) {
          draw = easeOutCubic(tt / ARC_DRAW);
          opacity = 0.85 * Math.min(1, tt / 0.3);
        } else if (tt >= ARC_HOLD_END) {
          const fade = (tt - ARC_HOLD_END) / (ARC_CYCLE - ARC_HOLD_END);
          opacity = 0.85 * (1 - fade);
        }
        arc.mat.opacity = opacity;
        arc.line.geometry.setDrawRange(
          0,
          draw <= 0 ? 0 : Math.max(2, Math.floor(draw * arc.vertexCount))
        );
        /* Destination dot pops in once the arc lands. */
        const landed = draw > 0.98 && opacity > 0.05;
        arc.dotMat.opacity = landed ? opacity : 0;
        arc.dot.scale.setScalar(
          landed ? 1 + 0.3 * Math.sin(t * 3 + arc.delay) : 0.001
        );
      }
    }
  });
  /* eslint-enable react-hooks/immutability */

  return null;
}

export function World({ data, globeConfig }: WorldProps) {
  const globeRef = useRef<ThreeGlobe | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  /* Theme-aware palette: read the design tokens off <html> (lazy
     initializer) and re-read them whenever the ThemeProvider flips the
     `data-mode` / `data-design` attributes (theme or mode switch). */
  const [palette, setPalette] = useState<GlobePalette>(() => resolvePalette());

  useEffect(() => {
    const mo = new MutationObserver(() => setPalette(resolvePalette()));
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-mode", "data-design"],
    });
    return () => mo.disconnect();
  }, []);

  /* Pause the entire frame loop while the globe is off-screen — this is
     what stops the globe from taxing the GPU on other chapters. */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? false),
      { rootMargin: "240px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="h-full w-full"
      style={{ touchAction: "pan-y", cursor: "grab" }}
    >
      <Canvas
        frameloop={inView ? "always" : "never"}
        camera={{ position: CAMERA_POS, fov: 45, near: 0.5, far: 2000 }}
        dpr={[1, 1.5]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
          stencil: false,
        }}
      >
        {/* Neutral lights — the surface tint comes from the theme palette,
            not from coloured lights. */}
        <ambientLight intensity={0.7} />
        <directionalLight position={new Vector3(-400, 100, 400)} intensity={0.8} />
        <directionalLight position={new Vector3(-200, 500, 200)} intensity={0.6} />

        <Globe globeRef={globeRef} globeConfig={globeConfig} palette={palette} />
        <GlobeFX globeRef={globeRef} palette={palette} data={data ?? NO_ARCS} />

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          target={ORBIT_TARGET}
          minDistance={ORBIT_DIST}
          maxDistance={ORBIT_DIST}
          autoRotateSpeed={globeConfig.autoRotateSpeed ?? 0.5}
          autoRotate={globeConfig.autoRotate ?? true}
          minPolarAngle={Math.PI / 3.5}
          maxPolarAngle={Math.PI - Math.PI / 3}
        />
      </Canvas>
    </div>
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
