"use client";

import { Component, type ReactNode } from "react";

/* ══════════════════════════════════════════════════════════
   SceneBoundary — keeps a decorative WebGL scene from taking the
   page down with it.
   ──────────────────────────────────────────────────────────
   useGLTF throws when a model fails to load (404, flaky network,
   blocked CDN). Without a boundary that error unwinds to the root
   and Next replaces the whole site with "This page couldn't load".
   These scenes are ambience, not content: on failure render the
   fallback (nothing, by default) and let the rest of the page live.
   ══════════════════════════════════════════════════════════ */
export default class SceneBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[scene] decorative 3D scene disabled:", error);
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
