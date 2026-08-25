"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { ArrowUpRight, ChevronsUp } from "lucide-react";
import ContactForm from "@/components/ui/ContactForm";
import GlobeField from "@/components/ui/GlobeField";
import { CONTACT_EMAIL, SOCIAL_LINKS } from "@/lib/data";
import { GLOBE_CONFIG, MANILA_ARCS } from "@/lib/globeData";

/* ══════════════════════════════════════════════════════════
   EVA // Comms uplink — GOBOLD-reference composition
   ──────────────────────────────────────────────────────────
   The globe is the left-dominant visual; the content column is
   pushed right so the two read as one asymmetric composition
   instead of a centred stack.

   Globe: the same `World` component the classic contact section
   renders (config + flights shared from `lib/globeData`), but the
   canvas is oversized 190% × 150% and shifted (-95% / -25%) so
   the globe's centre sits on the pane's left edge — only the
   right hemisphere enters frame, cropped and zoomed. Over it sits
   the CRT/VHS stack (GlobeField): scanlines, tiled grain, bloom,
   side fade, vignette, plus the scan sweep and VHS tracking roll
   (both skipped under reduced motion). The canvas itself takes a
   blur + saturation/contrast boost so the render reads as footage
   through a degraded monitor.

   The pane is decorative: pointer-events stay off it entirely, so
   OrbitControls never engages and the canvas never captures a
   drag. aria-hidden keeps it out of the accessibility tree.

   Content: "Comms // Uplink Terminal" heading + click-to-open bay
   deck (banner over composer, single grid cell, no runway). On
   mobile the globe becomes a backdrop layer behind a void scrim.

   Bay deck mechanics (banner over composer):
   The banner is the trigger, and the two panels are a deck of two
   cards. The composer is permanently mounted as the bottom card;
   the banner sits on top of it in the same grid cell
   (`[grid-area:1/1]`). Pressing the button takes the top card off
   — the banner lifts 7% and fades, and the composer underneath is
   simply uncovered. It never moves. The section is always as tall
   as the taller panel, so its height never changes on open — no
   reflow, and the page bottom stays where it is.
   Motion: transform + opacity only, so it stays on the compositor.
   ══════════════════════════════════════════════════════════ */

const World = dynamic(
  () => import("@/components/ui/globe").then((m) => m.World),
  { ssr: false }
);

function Heading() {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 border-b-2 border-[var(--color-accent-primary)] pb-4">
      <h2 className="font-display text-3xl font-bold uppercase tracking-wider text-[var(--color-accent-primary)]">
        Comms // Uplink Terminal
      </h2>
    </div>
  );
}

function Banner({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="relative h-full min-h-[60svh] overflow-hidden border border-[var(--color-accent-warm)] bg-[var(--color-accent-primary)] p-8 text-white md:p-14">

      {/* Background stripe pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #000 0, #000 2px, transparent 2px, transparent 10px)",
        }}
        aria-hidden
      />

      <div className="relative z-10 flex h-full flex-col justify-between gap-10">
        <div>
          <span className="mb-4 block font-mono text-xs font-bold tracking-[0.2em] text-[var(--color-accent-warm)]">
            &gt; ESTABLISH TRANSMISSION LINK
          </span>

          <p className="font-display text-4xl font-black uppercase leading-[0.95] md:text-6xl">
            SEND
            <br />
            MESSAGE
          </p>

          {/* The trigger. It was "keep scrolling" copy before, which is the
              instruction that required the runway to exist. */}
          <button
            type="button"
            onClick={onOpen}
            className="mt-6 inline-flex items-center gap-2 border-2 border-[var(--color-accent-warm)] bg-black/30 px-5 py-3 font-mono text-xs font-black uppercase tracking-[0.2em] text-[var(--color-accent-warm)] transition-colors duration-150 hover:bg-[var(--color-accent-warm)] hover:text-black active:scale-[0.98]"
            data-cursor-hover
          >
            <ChevronsUp size={14} />
            Open the bay
          </button>

          <p className="mt-4 font-mono text-[11px] tracking-wider text-white/70">
            or mail{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="underline decoration-dotted hover:text-white"
              data-cursor-hover
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <span className="block font-mono text-xs font-bold tracking-widest text-[var(--color-accent-warm)]">
            &gt; EXTERNAL NODES
          </span>
          <div className="flex flex-wrap gap-6">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 border-b border-white pb-1 font-mono text-xs font-bold uppercase transition-colors duration-150 hover:border-[var(--color-accent-warm)] hover:text-[var(--color-accent-warm)]"
                data-cursor-hover
              >
                {link.label} <ArrowUpRight size={14} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Composer() {
  return (
    <div className="relative border-2 border-black bg-[var(--color-accent-warm)] p-5 sm:p-7">
      {/* Door rail */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-black" aria-hidden />

      <div className="mb-5">
        <span className="block font-mono text-[10px] font-black uppercase tracking-[0.28em] text-black/70">
          HANGAR BAY 03 // MESSAGE COMPOSER
        </span>
        <p className="mt-1 font-display text-xl font-black uppercase tracking-wide text-black sm:text-2xl">
          Compose transmission
        </p>
      </div>

      <ContactForm variant="eva" />
    </div>
  );
}

export default function EvaContact() {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const still = reduced ?? false;

  return (
    <section
      id="contact"
      className="relative overflow-hidden pt-24 pb-12 lg:pt-32 lg:pb-16"
    >
      {/* Globe pane — left-dominant, decorative, full-bleed.
          GlobeField carries the CRT/VHS stack; its mobile contrast
          scrim and the ORBITAL RELAY / LIVE UPLINK captions stay on
          (their defaults), which is what this pane wants. */}
      <GlobeField still={still} className="inset-0">
        {/* Canvas oversized 190% × 150% and shifted so the globe's
            centre sits on the pane's left edge — only the right
            hemisphere enters frame. The filter makes the render read
            as footage through a degraded monitor. */}
        <div
          className="absolute -left-[95%] -top-[25%] h-[150%] w-[190%]"
          style={{
            filter: "blur(1.1px) saturate(1.3) contrast(1.12) brightness(0.9)",
          }}
        >
          <World data={MANILA_ARCS} globeConfig={GLOBE_CONFIG} />
        </div>
      </GlobeField>

      {/* Content column — pushed right of the globe's mass */}
      <div className="container-narrow relative z-10 lg:ml-[40%]">
        <Heading />

        {reduced ? (
          /* Reduced motion: both panels, stacked, no swap at all. */
          <div className="space-y-8">
            <Banner onOpen={() => undefined} />
            <Composer />
          </div>
        ) : (
          /* Single cell — the two panels swap inside it, so the section
             height is whichever panel is currently mounted and nothing
             scrolls past it. min-h is the banner's height, kept on the
             wrapper rather than only on the banner: without it the
             section was banner-tall while closed and composer-tall
             (shorter) once open, so finishing the animation yanked the
             layout. Now the box never changes size, only its contents
             move. */
          <div className="relative grid min-h-[60svh] w-full overflow-hidden">
            {/* Bottom card: always mounted, top-aligned, uncovered rather
                than introduced. It only eases its last 1.5% of
                scale/opacity so the reveal has something of its own. */}
            <motion.div
              className="[grid-area:1/1] self-start"
              initial={false}
              animate={{ opacity: open ? 1 : 0.9, scale: open ? 1 : 0.985 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: open ? 0.1 : 0 }}
            >
              <Composer />
            </motion.div>

            {/* Top card. It is lifted off, not flown away: -7% and out
                over 0.55s. */}
            <AnimatePresence initial={false}>
              {!open && (
                <motion.div
                  key="banner"
                  exit={{ y: "-7%", opacity: 0, scale: 1.015 }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  className="z-10 [grid-area:1/1] self-start"
                >
                  <Banner onOpen={() => setOpen(true)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}

