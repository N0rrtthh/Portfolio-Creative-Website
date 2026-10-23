/* ══════════════════════════════════════════════════════════
   ASSET PATHS
   ──────────────────────────────────────────────────────────
   The site deploys to GitHub Pages under a basePath. Next only
   rewrites basePath for *routed* URLs and statically-imported
   images — a raw string handed to <Image unoptimized> or <img>
   is emitted verbatim and 404s in production.

   Anything that lives in /public and is referenced by string
   must go through `asset()`. Prefer a static import where the
   file is known at build time (see data/projectImages.ts).
   ══════════════════════════════════════════════════════════ */

/* Same source as next.config's `basePath`: the GitHub Pages workflow sets
   NEXT_PUBLIC_BASE_PATH=/Portfolio-Website, every other host (Vercel,
   custom domain, local preview) serves from the root. Hard-coding the
   Pages prefix for every production build made root-hosted deploys
   request /Portfolio-Website/3d/*.glb, 404, and crash the whole page. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix a /public path with the deployment basePath. */
export function asset(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${clean}`;
}
