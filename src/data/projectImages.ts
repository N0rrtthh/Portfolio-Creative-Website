import type { StaticImageData } from "next/image";

import bidabossPortalImg from "@/../public/projects/bidaboss-portal.webp";
import bidabossMobileDashboardImg from "@/../public/projects/bidaboss-mobile-dashboard.webp";
import bidabossMobileSplashImg from "@/../public/projects/bidaboss-mobile-splash.webp";
import waterwiseImg from "@/../public/projects/waterwise.webp";
import quickAttendImg from "@/../public/projects/quick-attend.webp";
import resumakerImg from "@/../public/projects/resumaker.webp";
import jasfocusImg from "@/../public/projects/jasfocus.webp";
import wavelengthImg from "@/../public/projects/wavelength.webp";

/* ══════════════════════════════════════════════════════════
   PROJECT IMAGES — one shared, build-verified source
   ──────────────────────────────────────────────────────────
   Why static imports and not the `image: "/projects/x.png"`
   strings that used to live in lib/data.ts:

   · `images.unoptimized` + a raw string src means Next emits the
     path verbatim. Under the GitHub Pages basePath the browser
     then requests /projects/x.png instead of
     /Portfolio-Website/projects/x.png → 404 → broken image.
     That is exactly why EVA (static imports) worked and Classic
     (strings) did not.
   · A static import is resolved by the bundler, so the basePath is
     baked in *and* a missing file becomes a build error instead of
     a silent 404 in production.

   Keyed by Project.id so both layouts read the same map — no
   duplicated asset lists to drift apart.

   Images are pre-sized WebP (≤1600px wide): `images.unoptimized`
   ships files as-is, so a 2500px PNG cost every visitor ~1.4MB.
   ══════════════════════════════════════════════════════════ */

export const PROJECT_IMAGES: Record<string, StaticImageData> = {
  "bidaboss-portal": bidabossPortalImg,
  waterwise: waterwiseImg,
  "quick-attend": quickAttendImg,
  resumaker: resumakerImg,
  jasfocus: jasfocusImg,
  wavelength: wavelengthImg,
};

/* Mobile apps are shown as device mockups rather than a flat cover:
   screens are captured from the Android Studio Pixel 9 Pro XL emulator
   (898×2000 native, already masked to the rounded display). First entry
   is the hero screen, the rest stand behind it. */
export const PROJECT_SCREENS: Record<string, StaticImageData[]> = {
  "bidaboss-mobile": [bidabossMobileDashboardImg, bidabossMobileSplashImg],
};

export function getProjectImage(id: string): StaticImageData | undefined {
  return PROJECT_IMAGES[id];
}

export function getProjectScreens(id: string): StaticImageData[] | undefined {
  return PROJECT_SCREENS[id];
}
