"use client";

import { motion } from "framer-motion";

/* ══════════════════════════════════════════════════════════
   GlobeField — CRT/VHS degradation stack laid over a globe
   ──────────────────────────────────────────────────────────
   Shared by the EVA comms pane (always on, full pane) and the
   classic contact card's optional close-up framing. The pane
   itself is decorative — pointer-events stay off it entirely;
   a consumer that wants its globe grabbable opts the canvas
   wrapper back in with `pointer-events-auto`.

   Props:
   · still  — skip the moving overlays (scan sweep, tracking roll)
   · active — fade the whole CRT sheet in/out (classic close-up
              toggle); the globe itself stays mounted throughout
   · hud    — the ORBITAL RELAY / LIVE UPLINK captions (EVA only)

   The old mobile contrast scrim is gone: the EVA pane and the
   content lane no longer overlap at any width, so nothing needs
   the extra contrast layer.
   ══════════════════════════════════════════════════════════ */

/* Analog grain — inline SVG turbulence tiled over the globe. */
const GRAIN_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
  );

export default function GlobeField({
  children,
  className = "",
  still,
  active = true,
  hud = true,
}: {
  children?: React.ReactNode;
  className?: string;
  still: boolean;
  active?: boolean;
  hud?: boolean;
}) {
  return (
    <div
      className={`pointer-events-none absolute overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* The globe render — the consumer positions/oversizes it */}
      {children}

      {/* CRT stack — one sheet that fades as a whole when `active`
          toggles, so the classic card can zoom in and out of the
          degraded framing without remounting the canvas. */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          active ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Bright light source around the globe's upper-left limb */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 14% 8%, rgba(210,228,255,0.38), rgba(130,165,255,0.14) 36%, transparent 62%)",
          }}
        />

        {/* Horizontal CRT scanlines */}
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              "repeating-linear-gradient(to bottom, rgba(0,0,0,0.34) 0px, rgba(0,0,0,0.34) 1px, transparent 1px, transparent 3px)",
          }}
        />

        {/* Tiled analog grain */}
        <div
          className="absolute inset-0 opacity-[0.16] mix-blend-overlay"
          style={{
            backgroundImage: `url("${GRAIN_URI}")`,
            backgroundSize: "160px 160px",
          }}
        />

        {/* Slow scan sweep */}
        {!still && (
          <motion.div
            className="absolute inset-x-0 top-0 h-[16%]"
            style={{
              background:
                "linear-gradient(to bottom, transparent, rgba(255,255,255,0.055), transparent)",
            }}
            animate={{ y: ["-110%", "720%"] }}
            transition={{ duration: 7.5, repeat: Infinity, ease: "linear" }}
          />
        )}

        {/* VHS tracking roll — a disturbed band rolling through every ~9s */}
        {!still && (
          <motion.div
            className="absolute inset-x-0 top-0 h-[7%]"
            style={{
              background:
                "linear-gradient(to bottom, transparent, rgba(255,255,255,0.10) 38%, rgba(140,190,255,0.09) 58%, transparent)",
            }}
            animate={{ y: ["-160%", "1560%"], opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              repeatDelay: 6.5,
              ease: "easeInOut",
            }}
          />
        )}

        {/* Melt into the content side + edge vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, transparent 44%, var(--color-void) 97%), radial-gradient(ellipse at 28% 50%, transparent 52%, rgba(0,0,0,0.55) 100%)",
          }}
        />

        {/* HUD captions */}
        {hud && (
          <>
            <div className="absolute left-4 top-4 font-mono text-[10px] font-bold tracking-[0.25em] text-white/45">
              ORBITAL RELAY // SIG-07
            </div>
            <div className="absolute bottom-4 left-4 flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.25em] text-white/45">
              <span className="inline-block h-2 w-2 animate-pulse bg-[var(--color-accent-warm)]" />
              LIVE UPLINK
            </div>
          </>
        )}
      </div>
    </div>
  );
}
