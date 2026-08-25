"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Mail, MapPin } from "lucide-react";
import dynamic from "next/dynamic";

import ContactForm from "@/components/ui/ContactForm";
import ChapterLabel from "@/components/ui/ChapterLabel";
import ContactField from "@/components/ui/ContactField";
import GlobeField from "@/components/ui/GlobeField";
import AnimeTraceLine from "@/components/ui/AnimeTraceLine";
import { Magnetic, GlowTrail } from "@/components/ui/anime/AnimeInteractions";
import { GLOBE_CONFIG, MANILA_ARCS } from "@/lib/globeData";

const World = dynamic(
  () => import("@/components/ui/globe").then((m) => m.World),
  { ssr: false }
);




import { CONTACT_EMAIL, SOCIAL_LINKS } from "@/lib/data";
import { GitHubIcon, XIcon } from "@/components/ui/BrandIcons";
import { DUR, EASE } from "@/lib/motion";

/* ══════════════════════════════════════════════════════════
   CLASSIC // Contact
   ──────────────────────────────────────────────────────────
   Layout: the headline is its own full-width band, then the columns
   start underneath it. Previously the headline lived at the top of the
   LEFT column, so its height had no counterpart on the right and the
   left rail opened with a tall dead gap before the paragraph — visible
   as several hundred px of nothing beside the form.

   The headline is also plain text now, not `RevealText`. That component
   parks every word at `opacity: 0` until an IntersectionObserver fires;
   when it doesn't fire, the heading is invisible but still occupies its
   box, which is exactly the empty band that showed up here. A headline
   is the one thing in the section that must never depend on an observer.

   The rest of the premium read:
     · opens with a live availability state rather than a heading
     · left rail is one dividered block of facts at a single rhythm
       instead of one lonely card
     · the form sits in a gradient hairline ring (a 1px gradient wrapper,
       not a blurred glow) with its own header row
   ══════════════════════════════════════════════════════════ */

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  github: GitHubIcon,
  twitter: XIcon,
};

/* Globe config + flight data live in `lib/globeData` — the EVA comms
   pane renders the same globe, so both consumers share one source. */

const FACTS = [
  {
    icon: Mail,
    label: "Direct email",
    value: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
  },
  {
    icon: MapPin,
    label: "Location",
    value: "Cavite, Philippines",
    href: undefined,
  },
];


export default function Contact() {
  const reduced = useReducedMotion();
  const still = reduced ?? false;

  /* Framing option for the globe: the default framed orbit, or the
     EVA-style close-up — the canvas oversizes and shifts so only the
     right hemisphere enters the card, under the CRT stack. One wrapper,
     two class sets, CSS-transitioned: the change reads as a camera zoom
     and the canvas never remounts. */
  const [closeUp, setCloseUp] = useState(false);

  /* Fields, validation and submission live in `ui/ContactForm` so EVA's
     uplink panel renders the same form instead of a second copy of it. */
  return (
    <section
      id="contact"
      className="section-padding relative flex flex-col justify-center"
    >
      {/* Ambient Radial Gradient Background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="animate-breathe pointer-events-none absolute bottom-0 left-1/2 h-[600px] w-[900px] -translate-x-1/2"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(67,97,238,0.12), transparent 70%)",
          }}
        />
      </div>


      <div className="container-narrow relative z-10">
        {/* ── Headline band ─────────────────────────────────── */}
        <div className="pb-2">

          <div className="max-w-2xl">

            <ChapterLabel
              index={8}
              classic="Contact"
              eva="TRANSMISSION UPLINK"
              className="mb-5"
            />

            <h2 className="text-section-title font-display text-[var(--color-starlight)]">
              Let&apos;s build something{" "}
              <span className="text-[var(--color-accent-primary)]">
                together.
              </span>
            </h2>

            <p className="mt-4 max-w-prose font-body text-base leading-relaxed text-[var(--color-silver)]">
              Open to full-stack engineering, mobile development, and creative
              UI/UX roles. Have a project in mind or an inquiry? Send a
              transmission and I&apos;ll get back to you.
            </p>
          </div>
          {/* The "Available for new work" pill was removed on request. With it
              gone the band no longer needs to be a two-column flex row. */}
        </div>

        {/* Divider — the static 1px rule is now a self-drawing trace with a
            node riding it. Same job, and it replaces dead border space with
            motion rather than adding a new element to the page. */}
        <AnimeTraceLine className="mb-6 md:mb-8" height={24} />

        {/* ── Interactive globe — full-width band ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: DUR.reveal * 1.4, ease: EASE.out }}
          className="relative mb-10 md:mb-14"
        >
          <div className="relative h-[420px] w-full overflow-hidden rounded-3xl border border-[var(--color-glass-border)] bg-[var(--color-void)]/60 sm:h-[500px] lg:h-[560px]">
            {/* Framing toggle — swaps between the framed orbit and the
                EVA-style close-up (zoomed, left-cropped, CRT stack).
                Bottom-right so it never collides with the hint label. */}
            <button
              type="button"
              onClick={() => setCloseUp((v) => !v)}
              aria-pressed={closeUp}
              className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-void)]/70 px-3.5 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-silver)] backdrop-blur-sm transition-colors hover:border-[var(--color-accent-primary)]/70 hover:text-[var(--color-starlight)]"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  closeUp
                    ? "bg-[var(--color-accent-primary)]"
                    : "bg-[var(--color-ash)]"
                }`}
              />
              {closeUp ? "Orbit view" : "Close-up"}
            </button>

            <GlobeField
              still={still}
              active={closeUp}
              scrim={false}
              hud={false}
              className="inset-0"
            >
              {/* One wrapper, two framings — position and size are
                  CSS-transitioned so the swap reads as a camera move.
                  The close-up numbers are the EVA pane's: canvas
                  190% × 150%, shifted -95% / -25%, globe centre on
                  the card's left edge. */}
              <div
                className={`absolute pointer-events-auto transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  closeUp
                    ? "-left-[95%] -top-[25%] h-[150%] w-[190%]"
                    : "left-0 top-0 h-full w-full"
                }`}
                style={{
                  filter: closeUp
                    ? "blur(1.1px) saturate(1.3) contrast(1.12) brightness(0.9)"
                    : "blur(0px) saturate(1) contrast(1) brightness(1)",
                }}
              >
                <World data={MANILA_ARCS} globeConfig={GLOBE_CONFIG} />
              </div>
            </GlobeField>
            {/* Single hint label — no location text */}
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 flex justify-end p-5 transition-opacity duration-500 ${
                closeUp ? "opacity-0" : "opacity-100"
              }`}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ash)]">
                Drag to explore
              </span>
            </div>
            {/* Gradient vignette for depth */}
            <div
              className={`pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,var(--color-void)_100%)] transition-opacity duration-500 ${
                closeUp ? "opacity-0" : "opacity-100"
              }`}
            />
          </div>
        </motion.div>



        {/* ── Columns — both start at the same line ─────────── */}
        <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            {/* Facts — one rhythm, dividers instead of three separate cards */}
            <div className="divide-y divide-[var(--color-glass-border)] overflow-hidden rounded-2xl border border-[var(--color-glass-border)] glass">
              {FACTS.map(({ icon: Icon, label, value, href }) => {
                const body = (
                  <>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] transition-transform duration-200 group-hover:scale-110">
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-mono text-[10px] uppercase tracking-widest text-[var(--color-ash)]">
                        {label}
                      </span>
                      <span className="block truncate font-mono text-sm font-semibold text-[var(--color-starlight)]">
                        {value}
                      </span>
                    </span>
                  </>
                );

                return href ? (
                  <a
                    key={label}
                    href={href}
                    className="group flex items-center gap-4 p-4 transition-colors hover:bg-[var(--color-glass-highlight)]"
                    data-cursor-hover
                  >
                    {body}
                  </a>
                ) : (
                  <div key={label} className="group flex items-center gap-4 p-4">
                    {body}
                  </div>
                );
              })}
            </div>

            {/* Social Connection Links */}
            <div className="mt-7 flex items-center gap-4">

              <span className="font-mono text-xs text-[var(--color-ash)]">
                Connect:
              </span>
              {SOCIAL_LINKS.map((link) => {
                const Icon = ICONS[link.icon];
                return (
                  /* Magnetic: the icon leans ~8px toward the cursor and springs
                     back. Kept under the tile's own padding so the visual and
                     the hit area never disagree. */
                  <Magnetic key={link.href} strength={8}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.label}
                    className="flex h-10 w-10 items-center justify-center rounded-xl glass border border-[var(--color-glass-border)] text-[var(--color-silver)] transition-[color,border-color,background-color,transform] duration-200 ease-out hover:border-[var(--color-accent-primary)] hover:text-[var(--color-starlight)] active:scale-[0.97]"
                    data-cursor-hover
                  >
                    {Icon ? <Icon size={18} /> : link.label}
                  </a>
                  </Magnetic>
                );
              })}
            </div>

          </div>

          {/* ── The form, in a ringed card ────────────────────── */}
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: DUR.reveal, ease: EASE.out }}
              /* Gradient hairline ring: a 1px padded wrapper whose background
                 is the gradient, with the real card inset inside it. Cheaper
                 and crisper than a blurred pseudo-element glow. */
              className="rounded-[26px] bg-gradient-to-b from-[var(--color-accent-primary)]/50 via-[var(--color-glass-border)] to-transparent p-px shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
            >
              <div className="glass rounded-[25px] p-6 sm:p-8 md:p-10">
                <div className="mb-8 flex items-end justify-between gap-4 border-b border-[var(--color-glass-border)] pb-5">
                  <div>
                    <h3 className="font-display text-2xl font-bold text-[var(--color-starlight)]">
                      Send a message
                    </h3>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-[var(--color-ash)]">
                      All fields required
                    </p>
                  </div>
                  <span className="hidden shrink-0 rounded-full border border-[var(--color-glass-border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-silver)] sm:block">
                    Encrypted
                  </span>
                </div>

                <ContactForm />
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── Signal field ───────────────────────────────────
            A dot lattice drawn in one canvas, unboxed and full-bleed. Two
            earlier versions are worth knowing about before touching this: a
            9×64 grid of tweened divs (correct, but 576 animated elements)
            and a WebGL shader (one draw call, and invisible on screen —
            additive premultiplied output over this near-black section came
            out at a few percent luminance). Canvas 2D was the third answer
            because the colour you write is the colour you get.
            Also: an early 4×36 version was a one-line strip with no room
            for the cursor to travel, which is why the band is tall. */}

        <div className="mt-10 md:mt-12">
          <div className="mb-3 flex items-baseline justify-between gap-4">

            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-ash)]">
              Signal field
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-ash)]">
              Move or press to ripple
            </span>
          </div>
          {/* Glow at 150px: sized to the taller field, and still short of the
              220px that used to wash the entire strip rather than lighting
              the points near the cursor. GlowTrail clips to its own bounds,
              so the radius is what actually contains it. */}

          <GlowTrail size={150}>
            {/* No card around this any more. The ripple field IS the surface
                the section rests on, and a border turned it into a widget
                sitting on the page instead. Full-bleed and interactive:
                move over it to pull the lattice, click to drop a wave. */}
            <ContactField />
          </GlowTrail>

        </div>

      </div>
    </section>

  );
}
