import type { NextConfig } from "next";

/**
 * basePath is driven by an env var so the same codebase can deploy
 * anywhere without 404s:
 *  - GitHub Pages (repo `Portfolio-Website`): the Actions workflow sets
 *    NEXT_PUBLIC_BASE_PATH=/Portfolio-Website at build time.
 *  - Vercel / custom domain / local `npm start` preview: no env var →
 *    the site is served from the site root.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  basePath,
  allowedDevOrigins: ["192.168.0.120", "localhost"],
};

export default nextConfig;
