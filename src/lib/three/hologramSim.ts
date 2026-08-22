/**
 * GPGPU point simulation for the hologram cloud.
 *
 * WHY THIS EXISTS
 * ---------------
 * Until now every point's displacement was a pure function of the current
 * uniforms, evaluated fresh in the vertex shader each frame. That has no
 * memory, so a point could only ever sit exactly where the formula said it
 * should be — the "spring" was a single global ease on the force, shared by
 * all 34,000 points. Two consequences you could see:
 *
 *   · no inertia. A point stopped the instant the cursor stopped, because
 *     nothing carried its motion forward.
 *   · no independence. Every point relaxed on the same time constant, which
 *     is why the return read as one elastic sheet rather than a swarm.
 *
 * Real springs need state — position and velocity, per point, surviving
 * between frames. There is nowhere to put that in a vertex shader, so it
 * goes in a float texture instead: one texel per point, ping-ponged between
 * two render targets each frame. The formula that used to BE the position
 * now only supplies the TARGET the spring pulls toward.
 *
 * The maths itself is unchanged and lives in `HG_TARGET` below, shared
 * verbatim by the simulation and (for shading terms) the render pass. That
 * sharing is the point of this module: two copies of the displacement
 * function would drift apart within a week.
 *
 * COST
 * ----
 * Two fragment passes over a 185×185 target (~34k texels) per frame, which
 * is a rounding error next to the point cloud itself. No per-point CPU work,
 * no buffer uploads after setup.
 */

import * as THREE from "three";
import { getFloatTargetSupport, FloatTargetSupport } from "./webglCapabilities";

/* ─── Shared GLSL ─────────────────────────────────────── */

/** Hashes and the brush SDFs. Needed by both the sim and the render pass. */
export const HG_LIB = /* glsl */ `
  float hash11(float n) { return fract(sin(n) * 43758.5453123); }

  /* iq's isosceles-triangle SDF: apex at the origin, base of half-width q.x
     at height q.y. */
  float sdTriIso(vec2 p, vec2 q) {
    p.x = abs(p.x);
    vec2 a = p - q * clamp(dot(p, q) / dot(q, q), 0.0, 1.0);
    vec2 b = p - q * vec2(clamp(p.x / q.x, 0.0, 1.0), 1.0);
    float s = -sign(q.y);
    vec2 d = min(vec2(dot(a, a), s * (p.x * q.y - p.y * q.x)),
                 vec2(dot(b, b), s * (p.y - q.y)));
    return -sqrt(d.x) * sign(d.y);
  }

  /* Hard-cornered box SDF. Negative inside, positive outside, so the same
     falloff maths works for it as for the disc. */
  float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }
`;

/** Every uniform the target function reads. Declared once, included by both
    shaders, so the two can never disagree about the interface. */
export const HG_UNIFORMS = /* glsl */ `
  uniform float uTime;
  uniform float uGlitch;
  uniform float uAssemble;   // 0 = dispersed dust, 1 = fully materialised
  uniform vec3  uRayO;       // cursor ray origin,    model LOCAL space
  uniform vec3  uRayD;       // cursor ray direction, model LOCAL space
  uniform float uPush;       // 0 = pointer ignored, 1 = full repulsion
  uniform float uRadius;
  uniform float uRadialForce;
  uniform float uSwirl;
  uniform float uNormalForce;
  uniform float uNoiseScale;
  uniform float uStagger;
  uniform float uBurst;
  uniform float uWander;
  uniform float uSway;
  uniform float uShape;      // brush silhouette index
  uniform float uSpeed;      // 0 = still cursor, 1 = fast sweep
  uniform vec3  uDragDir;
  uniform float uDrag;
  uniform float uFront;      // ice front radius, normalised (<0 = no ice)
  uniform float uMaxR;
  uniform vec3  uSwipeA;
  uniform vec3  uSwipeB;
  uniform float uSwipeAmt;
  uniform float uSwipeR;
  uniform float uScatterF;
`;

/**
 * The displacement formula, verbatim from the original vertex shader, now
 * expressed as "where should this point WANT to be". The spring in the sim
 * decides how it actually gets there, which is the whole change.
 */
export const HG_TARGET = /* glsl */ `
  float hgSeed(vec3 base) { return dot(base, vec3(12.9898, 78.233, 37.719)); }

  /** Materialisation progress for one point, staggered per point so the
      surface knits itself together instead of snapping in as a block. */
  float hgAssemble(float seed) {
    float delay = hash11(seed) * 0.42;
    float a = clamp((uAssemble - delay) / (1.0 - delay), 0.0, 1.0);
    return a * a * (3.0 - 2.0 * a);
  }

  /** How frozen a point is. The glass grows OUTWARD from the core, so the
      front is a radius and each point crystallises as it passes. */
  float hgFrozen(vec3 base) {
    float pr = length(base) / max(uMaxR, 1e-3);
    return smoothstep(uFront + 0.06, uFront - 0.06, pr);
  }

  /** Scatter direction for the assemble fly-in, reused by the swipe as a
      fallback when a point sits exactly on the recorded stroke. */
  vec3 hgDir(float seed) {
    return normalize(vec3(
      hash11(seed + 1.7) - 0.5,
      hash11(seed + 5.3) - 0.5,
      hash11(seed + 9.1) - 0.5
    ) + 1e-5);
  }

  vec3 hgTarget(vec3 base, vec3 nrm) {
    float seed   = hgSeed(base);
    float a      = hgAssemble(seed);
    float frozen = hgFrozen(base);
    vec3  dir    = hgDir(seed);

    vec3 p = base;
    float spread = 0.55 + hash11(seed + 3.1) * 0.85;
    p = mix(p + dir * spread, p, a);

    /* Cursor tube. Distance is measured to the cursor's RAY, not to a point
       on a bounding sphere, so the influence zone is a cylinder bored along
       the line of sight: whatever is under the cursor is inside it, at any
       depth, including the far side. */
    vec3  rel    = p - uRayO;
    vec3  toAxis = rel - dot(rel, uRayD) * uRayD;
    float dC     = length(toAxis);

    /* Brush silhouette, as a 2D signed distance in the plane perpendicular
       to the view ray — which is what lets it be a shape and not a radius. */
    vec3 bRight = normalize(cross(uRayD, vec3(0.0, 1.0, 0.0)) + 1e-5);
    vec3 bUp    = cross(bRight, uRayD);
    vec2 q      = vec2(dot(toAxis, bRight), dot(toAxis, bUp)) / max(uRadius, 1e-3);

    float sd;
    if (uShape < 0.5)      sd = length(q) - 1.0;
    else if (uShape < 1.5) sd = sdTriIso(q + vec2(0.0, 0.95), vec2(0.95, 1.9));
    else if (uShape < 2.5) sd = sdBox(q, vec2(0.85, 0.85));
    else if (uShape < 3.5) sd = sdBox(q, vec2(1.55, 0.22));
    else                   sd = sdBox(q, vec2(0.22, 1.55));

    float fall = uShape < 0.5
      ? smoothstep(0.0, -1.0, sd)
      : smoothstep(0.05, -0.5, sd);
    float vary = 0.88 + 0.24 * hash11(seed * uNoiseScale + 13.7);

    /* Per-point threshold on the global push ramp. With springs this is no
       longer the only source of stagger — the spring constant varies per
       point too — but it still shapes WHEN a point lets go. */
    float stag = hash11(seed + 21.3) * uStagger;
    float pv   = clamp((uPush - stag) / max(1.0 - stag, 1e-3), 0.0, 1.0);
    pv = pv * pv * (3.0 - 2.0 * pv);

    float creep = 0.72 + 0.28 * sin(uTime * 0.45 + seed * 3.1);
    float forceScale = mix(1.0, 0.2, uSpeed);
    float amt = fall * pv * a * vary * creep * (1.0 - frozen);
    float burst = 4.0 * pv * (1.0 - pv);

    vec3 dirC = dC > 1e-4 ? toAxis / dC : vec3(0.0, 1.0, 0.0);
    vec3 tang = normalize(cross(uRayD, dirC));
    p += (dirC * (uRadialForce + uBurst * burst) * forceScale
        + tang * uSwirl
        + normalize(nrm) * uNormalForce * forceScale) * amt;

    p += uDragDir * (uDrag * uSpeed) * fall * a * (1.0 - frozen);

    vec3 wob = vec3(
      sin(uTime * 1.7 + seed * 1.1),
      sin(uTime * 2.3 + seed * 1.7),
      sin(uTime * 1.3 + seed * 2.3)
    );
    p += wob * uWander * amt;

    /* Coral current: phase is a smooth function of position, so a region
       leans together like a frond rather than each point shimmering alone. */
    float ph = p.y * 1.7 + p.x * 0.9 + p.z * 0.5;
    vec3 swayV = vec3(
      sin(uTime * 0.55 + ph),
      sin(uTime * 0.40 + ph * 1.3 + 1.7) * 0.5,
      cos(uTime * 0.50 + ph * 0.8)
    );
    p += swayV * uSway * a * (1.0 - frozen);

    /* Swipe corridor, treated as a capsule. */
    vec3  ab   = uSwipeB - uSwipeA;
    float tSeg = clamp(dot(p - uSwipeA, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    vec3  away = p - (uSwipeA + ab * tSeg);
    float dAway = length(away);
    float swf   = smoothstep(uSwipeR, 0.0, dAway);
    float sstag = hash11(seed + 47.1) * 0.55;
    float sAmt  = clamp((uSwipeAmt - sstag) / max(1.0 - sstag, 1e-3), 0.0, 1.0);
    sAmt = sAmt * sAmt * (3.0 - 2.0 * sAmt);
    // A point sitting exactly on the stroke has a near-zero away vector;
    // normalising that amplifies float noise into a flipping direction.
    vec3 an   = dAway > 1e-4 ? away / dAway : dir;
    vec3 sdir = normalize(mix(an, dir, 0.45));
    p += sdir * (swf * sAmt * uScatterF * (0.6 + hash11(seed + 91.3) * 0.8))
       * a * (1.0 - frozen);

    p.x += sin(p.y * 37.0 + uTime * 9.0) * uGlitch * 0.04;
    return p;
  }
`;

/* ─── Simulation shaders ──────────────────────────────── */

/** Full-target pass-through. The quad is already in clip space. */
const SIM_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * Velocity integration. Semi-implicit Euler with exponential damping:
 * damping as exp(-c·dt) rather than (1 - c·dt) is what keeps the spring
 * stable when a frame runs long, which the naive form does not.
 */
const SIM_FRAG_VEL = /* glsl */ `
  precision highp float;
  uniform sampler2D uAnchorTex;
  uniform sampler2D uNormalTex;
  uniform sampler2D uPosTex;
  uniform sampler2D uVelTex;
  uniform float uDt;
  uniform float uK;      // spring stiffness
  uniform float uDamp;   // velocity decay rate
  uniform float uSpread; // per-point variation in stiffness, 0..1
  varying vec2 vUv;

  ${HG_LIB}
  ${HG_UNIFORMS}
  ${HG_TARGET}

  void main() {
    vec3 base = texture2D(uAnchorTex, vUv).xyz;
    vec3 nrm  = texture2D(uNormalTex, vUv).xyz;
    vec3 p    = texture2D(uPosTex, vUv).xyz;
    vec3 v    = texture2D(uVelTex, vUv).xyz;

    vec3 tgt = hgTarget(base, nrm);

    /* Per-point stiffness. This is where the "swarm" comes from now: two
       neighbouring points pulled to the same target arrive at different
       times because their springs differ, without any extra state. */
    float seed = hgSeed(base);
    float k = uK * mix(1.0 - uSpread, 1.0 + uSpread, hash11(seed + 61.7));

    v += (tgt - p) * k * uDt;
    v *= exp(-uDamp * uDt);

    /* Frozen points hold still: ice has no springs. Snapping the velocity
       rather than letting it decay avoids a shell that keeps humming after
       it has visibly turned solid. */
    v *= (1.0 - hgFrozen(base));

    gl_FragColor = vec4(v, 0.0);
  }
`;

/** Position integration. Reads the velocity written this frame. */
const SIM_FRAG_POS = /* glsl */ `
  precision highp float;
  uniform sampler2D uPosTex;
  uniform sampler2D uVelTex;
  uniform float uDt;
  varying vec2 vUv;
  void main() {
    vec3 p = texture2D(uPosTex, vUv).xyz;
    vec3 v = texture2D(uVelTex, vUv).xyz;
    gl_FragColor = vec4(p + v * uDt, 1.0);
  }
`;

/**
 * Seeds both position targets on the first frame — at the DISPERSED shell,
 * not at the anchors. Seeding at the anchors would have every point start
 * on the surface, spring outward to the pre-assemble target and only then
 * come home, so the section would open with a bloom outward instead of the
 * fly-in. This is the same spread the target function uses at uAssemble = 0,
 * so the very first simulated frame is already correct.
 */
const SIM_FRAG_INIT = /* glsl */ `
  precision highp float;
  uniform sampler2D uAnchorTex;
  varying vec2 vUv;

  ${HG_LIB}

  void main() {
    vec3 base = texture2D(uAnchorTex, vUv).xyz;
    float seed = dot(base, vec3(12.9898, 78.233, 37.719));
    vec3 dir = normalize(vec3(
      hash11(seed + 1.7) - 0.5,
      hash11(seed + 5.3) - 0.5,
      hash11(seed + 9.1) - 0.5
    ) + 1e-5);
    float spread = 0.55 + hash11(seed + 3.1) * 0.85;
    gl_FragColor = vec4(base + dir * spread, 1.0);
  }
`;

/* ─── PointSim ────────────────────────────────────────── */

/** Texture type used by the sim. Set once at construction based on the
    probed GPU capability, then used consistently for render targets and
    data textures. Half-float has less precision (~3 decimal digits) but
    the sim's value range (positions within a few units, velocities well
    under 10) fits comfortably, and it works on far more GPUs. */
let SIM_TEX_TYPE: THREE.TextureDataType = THREE.FloatType;

function makeRT(size: number) {
  return new THREE.WebGLRenderTarget(size, size, {
    type: SIM_TEX_TYPE,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
}

function makeDataTex(size: number, src: Float32Array, count: number) {
  // RGBA rather than RGB: three-channel float textures aren't universally
  // renderable/samplable, and the alpha channel costs nothing here.
  if (SIM_TEX_TYPE === THREE.HalfFloatType) {
    // Half-float data textures need Uint16Array with IEEE 754 half values.
    const data = new Uint16Array(size * size * 4);
    for (let i = 0; i < count; i++) {
      data[i * 4]     = THREE.DataUtils.toHalfFloat(src[i * 3]);
      data[i * 4 + 1] = THREE.DataUtils.toHalfFloat(src[i * 3 + 1]);
      data[i * 4 + 2] = THREE.DataUtils.toHalfFloat(src[i * 3 + 2]);
      data[i * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.HalfFloatType);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }

  const data = new Float32Array(size * size * 4);
  for (let i = 0; i < count; i++) {
    data[i * 4]     = src[i * 3];
    data[i * 4 + 1] = src[i * 3 + 1];
    data[i * 4 + 2] = src[i * 3 + 2];
    data[i * 4 + 3] = 1;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

/** UV of each point's texel, as a vertex attribute. Sampled at texel
    CENTRES — sampling on the boundary would let a nearest fetch land on a
    neighbour and swap two points' positions. */
export function makeRefAttribute(count: number, size: number) {
  const ref = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    ref[i * 2]     = ((i % size) + 0.5) / size;
    ref[i * 2 + 1] = (Math.floor(i / size) + 0.5) / size;
  }
  return ref;
}

export interface PointSimOptions {
  /** Spring stiffness. Higher = snappier return. */
  stiffness?: number;
  /** Velocity decay rate. Near-critical for the stiffness above. */
  damping?: number;
  /** Per-point stiffness variation, 0–1. This is the swarm dial. */
  spread?: number;
}

/**
 * True when the GPU can run the GPGPU simulation at all (float or half).
 * Callers should check this and fall back to a static or CPU-driven cloud
 * when it returns false.
 */
export function isGPGPUSupported(): boolean {
  return getFloatTargetSupport() !== "none";
}

/**
 * Owns the ping-ponged position/velocity textures and the two passes that
 * advance them. Deliberately not a React component: it's GPU state with a
 * lifetime tied to a model, created and disposed by the memo that builds
 * that model's geometry.
 */
export class PointSim {
  readonly size: number;
  readonly count: number;
  /** The texture type actually used, for diagnostics. */
  readonly texType: FloatTargetSupport;

  private posRT: THREE.WebGLRenderTarget[];
  private velRT: THREE.WebGLRenderTarget[];
  private cur = 0;
  private seeded = false;

  private anchorTex: THREE.DataTexture;
  private normalTex: THREE.DataTexture;

  private velMat: THREE.ShaderMaterial;
  private posMat: THREE.ShaderMaterial;
  private initMat: THREE.ShaderMaterial;

  private scene: THREE.Scene;
  private cam: THREE.Camera;
  private quad: THREE.Mesh;

  /**
   * @param shared Uniform objects owned by the render material. They are
   * referenced, NOT copied, so whoever drives the animation keeps writing
   * to exactly one set of uniforms and the sim sees it for free.
   */
  constructor(
    count: number,
    anchors: Float32Array,
    normals: Float32Array,
    shared: Record<string, THREE.IUniform>,
    opts: PointSimOptions = {},
  ) {
    // Probe GPU capability ONCE and set the module-level texture type.
    // This must happen before makeRT / makeDataTex are called.
    const support = getFloatTargetSupport();
    this.texType = support;
    SIM_TEX_TYPE = support === "half" ? THREE.HalfFloatType : THREE.FloatType;

    this.count = count;
    this.size = Math.max(2, Math.ceil(Math.sqrt(count)));
    const s = this.size;

    this.anchorTex = makeDataTex(s, anchors, count);
    this.normalTex = makeDataTex(s, normals, count);

    this.posRT = [makeRT(s), makeRT(s)];
    this.velRT = [makeRT(s), makeRT(s)];

    const simTextures = {
      uAnchorTex: { value: this.anchorTex },
      uNormalTex: { value: this.normalTex },
      uPosTex: { value: null as THREE.Texture | null },
      uVelTex: { value: null as THREE.Texture | null },
      uDt: { value: 1 / 60 },
      uK: { value: opts.stiffness ?? 42 },
      uDamp: { value: opts.damping ?? 7.5 },
      uSpread: { value: opts.spread ?? 0.45 },
    };

    this.velMat = new THREE.ShaderMaterial({
      // Spread copies the uniform OBJECTS by reference, which is the whole
      // trick: the caller's existing per-frame writes drive the sim too.
      uniforms: { ...shared, ...simTextures },
      vertexShader: SIM_VERT,
      fragmentShader: SIM_FRAG_VEL,
      depthTest: false,
      depthWrite: false,
    });

    this.posMat = new THREE.ShaderMaterial({
      uniforms: {
        uPosTex: { value: null },
        uVelTex: { value: null },
        uDt: simTextures.uDt,
      },
      vertexShader: SIM_VERT,
      fragmentShader: SIM_FRAG_POS,
      depthTest: false,
      depthWrite: false,
    });

    this.initMat = new THREE.ShaderMaterial({
      uniforms: { uAnchorTex: { value: this.anchorTex } },
      vertexShader: SIM_VERT,
      fragmentShader: SIM_FRAG_INIT,
      depthTest: false,
      depthWrite: false,
    });

    this.scene = new THREE.Scene();
    this.cam = new THREE.Camera();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.initMat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  /** The texture the render pass should read positions from. */
  get texture(): THREE.Texture {
    return this.posRT[this.cur].texture;
  }

  private blit(gl: THREE.WebGLRenderer, mat: THREE.Material, target: THREE.WebGLRenderTarget) {
    const prev = gl.getRenderTarget();
    this.quad.material = mat;
    gl.setRenderTarget(target);
    gl.render(this.scene, this.cam);
    gl.setRenderTarget(prev);
  }

  /** Advance one frame. `dt` is clamped by the caller. */
  step(gl: THREE.WebGLRenderer, dt: number) {
    if (!this.seeded) {
      // Both position targets start at the anchors; velocity targets are
      // cleared to zero by the renderer's own clear on first write.
      this.blit(gl, this.initMat, this.posRT[0]);
      this.blit(gl, this.initMat, this.posRT[1]);
      this.seeded = true;
    }

    const read = this.cur;
    const write = 1 - this.cur;

    // Velocity first, from the previous position and velocity...
    this.velMat.uniforms.uDt.value = dt;
    this.velMat.uniforms.uPosTex.value = this.posRT[read].texture;
    this.velMat.uniforms.uVelTex.value = this.velRT[read].texture;
    this.blit(gl, this.velMat, this.velRT[write]);

    // ...then position, using the velocity just written. Reading the NEW
    // velocity (semi-implicit) rather than the old one is what makes the
    // integrator stable at stiffnesses this high.
    this.posMat.uniforms.uPosTex.value = this.posRT[read].texture;
    this.posMat.uniforms.uVelTex.value = this.velRT[write].texture;
    this.blit(gl, this.posMat, this.posRT[write]);

    this.cur = write;
  }

  dispose() {
    this.posRT.forEach((rt) => rt.dispose());
    this.velRT.forEach((rt) => rt.dispose());
    this.anchorTex.dispose();
    this.normalTex.dispose();
    this.velMat.dispose();
    this.posMat.dispose();
    this.initMat.dispose();
    this.quad.geometry.dispose();
  }
}
