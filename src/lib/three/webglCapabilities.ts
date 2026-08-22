/**
 * WebGL capability detection for GPU-dependent features.
 *
 * WHY THIS EXISTS
 * ---------------
 * The hologram simulation (PointSim) renders to float textures, which
 * requires specific GPU capabilities. Some GPUs/drivers cannot render to
 * float textures — the render target silently returns zeros, breaking the
 * particle system. This module probes capability ONCE and exposes a tier:
 *
 *   "float" → 32-bit float render targets work.
 *   "half"  → Only 16-bit half-float render targets work.
 *   "none"  → No usable float render targets.
 *
 * DETECTION STRATEGY (v2 — extension + framebuffer completeness)
 * --------------------------------------------------------------
 * An earlier version did a full render-and-readback test. That produced
 * FALSE NEGATIVES on perfectly capable hardware: some drivers reject the
 * specific readPixels type/format pairing even though rendering to the
 * target works fine, so the probe read zeros and wrongly reported "none".
 *
 * The reliable signal is what three.js itself relies on:
 *   1. The color-buffer extension is present:
 *        EXT_color_buffer_float       → render to RGBA32F AND RGBA16F
 *        EXT_color_buffer_half_float  → render to RGBA16F
 *   2. A framebuffer with the target attached reports FRAMEBUFFER_COMPLETE.
 *
 * Extension presence + completeness is exactly the condition under which
 * rendering to the target is valid, and it does not depend on a readback
 * round-trip that drivers implement inconsistently.
 *
 * DEBUGGING / OVERRIDES
 * ---------------------
 * The probe result is logged once. To force a tier while debugging:
 *   · append `?gpgpu=float|half|none` to the URL, or
 *   · run localStorage.setItem("gpgpu-override", "half") and reload.
 * Clear with localStorage.removeItem("gpgpu-override").
 */

export type FloatTargetSupport = "float" | "half" | "none";

let cached: FloatTargetSupport | null = null;

/**
 * Probe the GPU's ability to render to float textures.
 * Results are cached — call freely on every mount.
 */
export function getFloatTargetSupport(): FloatTargetSupport {
  if (cached !== null) return cached;

  if (typeof window === "undefined") {
    // SSR: assume the best, client will re-probe.
    return "float";
  }

  const override = getOverride();
  cached = override ?? probeFloatTargets();

  // One diagnostic line, easy to spot in the console.
  // eslint-disable-next-line no-console
  console.info(
    `[hologram] float render target support: ${cached.toUpperCase()}` +
      (override ? " (forced by override)" : ""),
  );

  return cached;
}

/** Force a re-probe (useful after context loss or for debugging). */
export function resetFloatTargetCache(): void {
  cached = null;
}

/* ─── Override ───────────────────────────────────────────── */

function getOverride(): FloatTargetSupport | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("gpgpu");
    const stored = window.localStorage.getItem("gpgpu-override");
    const v = fromUrl ?? stored;
    if (v === "float" || v === "half" || v === "none") return v;
  } catch {
    // localStorage can throw in private mode etc. — overrides are optional.
  }
  return null;
}

/* ─── Internal probe ─────────────────────────────────────── */

function probeFloatTargets(): FloatTargetSupport {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;

  const gl2 = canvas.getContext("webgl2", {
    failIfMajorPerformanceCaveat: false,
  });

  if (gl2) {
    // EXT_color_buffer_float covers BOTH 32F and 16F render targets.
    const extFloat = gl2.getExtension("EXT_color_buffer_float");
    // EXT_color_buffer_half_float covers 16F only.
    const extHalf = gl2.getExtension("EXT_color_buffer_half_float");

    if (extFloat && isRenderable(gl2, gl2.RGBA32F, gl2.FLOAT)) {
      cleanup(gl2, canvas);
      return "float";
    }
    if ((extFloat || extHalf) && isRenderable(gl2, gl2.RGBA16F, gl2.HALF_FLOAT)) {
      cleanup(gl2, canvas);
      return "half";
    }

    cleanup(gl2, canvas);
    return "none";
  }

  // WebGL1 fallback path
  const gl1 = canvas.getContext("webgl", {
    failIfMajorPerformanceCaveat: false,
  }) as WebGLRenderingContext | null;

  if (gl1) {
    const floatExt = gl1.getExtension("OES_texture_float");
    const floatBufExt = gl1.getExtension("WEBGL_color_buffer_float");
    const halfFloatExt = gl1.getExtension("OES_texture_half_float");
    const halfBufExt = gl1.getExtension("EXT_color_buffer_half_float");

    if (floatExt && (floatBufExt || isRenderableWebGL1(gl1, gl1.FLOAT))) {
      cleanup(gl1, canvas);
      return "float";
    }
    if (halfFloatExt && (halfBufExt || isRenderableWebGL1(gl1, halfFloatExt.HALF_FLOAT_OES))) {
      cleanup(gl1, canvas);
      return "half";
    }

    cleanup(gl1, canvas);
    return "none";
  }

  // No WebGL at all
  return "none";
}

/**
 * WebGL2: attach a texture of the given format to a framebuffer and check
 * completeness. No readback — completeness is the authoritative signal for
 * whether rendering to this target is valid.
 */
function isRenderable(
  gl: WebGL2RenderingContext,
  internalFormat: number,
  type: number,
): boolean {
  let tex: WebGLTexture | null = null;
  let fb: WebGLFramebuffer | null = null;
  try {
    tex = gl.createTexture();
    if (!tex) return false;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, internalFormat, 2, 2, 0,
      gl.RGBA, type, null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    fb = gl.createFramebuffer();
    if (!fb) return false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0,
    );

    return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  } catch {
    return false;
  } finally {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (fb) gl.deleteFramebuffer(fb);
    if (tex) gl.deleteTexture(tex);
  }
}

/** WebGL1 variant of the completeness check. */
function isRenderableWebGL1(
  gl: WebGLRenderingContext,
  type: number,
): boolean {
  let tex: WebGLTexture | null = null;
  let fb: WebGLFramebuffer | null = null;
  try {
    tex = gl.createTexture();
    if (!tex) return false;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0,
      gl.RGBA, type, null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    fb = gl.createFramebuffer();
    if (!fb) return false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0,
    );

    return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  } catch {
    return false;
  } finally {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (fb) gl.deleteFramebuffer(fb);
    if (tex) gl.deleteTexture(tex);
  }
}

function cleanup(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  canvas: HTMLCanvasElement,
): void {
  try {
    const ext = gl.getExtension("WEBGL_lose_context");
    if (ext) ext.loseContext();
  } catch {
    // Ignore — cleanup is best-effort.
  }
  canvas.width = 0;
  canvas.height = 0;
}