"use client";

import { useEffect, useLayoutEffect, useRef, useState, useMemo, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { useLenis } from "@/components/providers/SmoothScrollProvider";
import {
  BadgeCheck,
  Search,
  BookOpen,
  Globe,
  X,
  CheckCircle2,
  Layers,
  Brain,
  BarChart3,
  ShieldCheck,
  Code2,
  CircuitBoard,
  Briefcase,
  Cpu,
  Cloud,
} from "lucide-react";
import ChapterLabel from "@/components/ui/ChapterLabel";
import RevealText from "@/components/ui/RevealText";
import { asset } from "@/lib/assets";
import certPreviews from "@/data/certPreviews.json";
import certificationData from "@/data/certifications.json";

/* Pre-rendered certificate images (scripts/build-cert-previews.mjs):
   variant id → [width, height]. */
const CERT_PREVIEWS = certPreviews as unknown as Record<string, [number, number]>;

/* Subject → drawn icon. The badges used to be emoji glyphs — a
   placeholder standing in for an icon system. One lucide set now:
   the same stroke and weight on every badge, sized by the caller,
   coloured by currentColor. */
const SUBJECT_ICONS: Record<
  string,
  ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
> = {
  AI: Brain,
  Cloud: Cloud,
  "Data Science": BarChart3,
  Cybersecurity: ShieldCheck,
  "Software Engineering": Code2,
  "Systems & IoT": CircuitBoard,
  "Business & Professional": Briefcase,
};

function SubjectIcon({
  subject,
  size,
  className = "",
}: {
  subject: RealCertification["subject"];
  size: number;
  className?: string;
}) {
  const Icon = SUBJECT_ICONS[subject] ?? Cpu;
  return <Icon size={size} className={className} strokeWidth={1.75} aria-hidden />;
}

/* Badge/artwork URLs are usually remote (Credly, imgur…). A path starting
   with "/" is a file in /public (uploaded by the Cert Manager into
   public/badges/) and needs the GitHub Pages basePath. */
const imgSrc = (u?: string) => (u && u.startsWith("/") ? asset(u) : u);

const EASING = [0.22, 1, 0.36, 1] as const;
/* The issuer pill used to run a very stiff spring (stiffness 480). A stiff
   spring overshoots its target and settles with a visible bounce; combined
   with the content cross-fade happening underneath, that read as the tab
   "glitching" on click. A softer, critically-damped spring glides to the
   new tab and stops dead — no overshoot, no wobble. */
const TAB_SPRING = { type: "spring", stiffness: 300, damping: 32, mass: 0.8 } as const;

/* ══════════════════════════════════════════════════════════
   Certificate viewer — why it's scaled the way it is
   ──────────────────────────────────────────────────────────
   The preview is a CROSS-ORIGIN iframe pointing at pdfhost.io's own
   HTML viewer. We cannot read or set anything inside it: no zoom API,
   no `#zoom=` fragment (that only works for the browser's built-in PDF
   plugin, not for a third-party HTML viewer), and no postMessage
   contract. So the zoom is not ours to set directly.

   What IS ours is the viewport the viewer thinks it has. That's the
   actual cause of the "opens at ~240% on mobile" report: given a
   ~340px-wide frame, pdfhost takes its small-screen layout path and
   fits the page to that width, so the certificate's text renders at
   roughly 2.4x the density you'd see on a desktop.

   Fix: give the iframe a fixed DESKTOP width (`FRAME_VIRTUAL_WIDTH`)
   so the viewer always takes its desktop layout path, then scale the
   whole frame down to whatever space we actually have. The apparent
   zoom becomes containerWidth / 900 — a number we control exactly,
   identical in behaviour on every device. This also replaces the old
   `h-[185%] w-[185%] scale-[0.54]` magic numbers, which hard-coded one
   ratio and therefore only ever looked right at one width.
   ══════════════════════════════════════════════════════════ */
const FRAME_VIRTUAL_WIDTH = 900;

function ScaledFrame({ src, title }: { src: string; title: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = (w: number) => {
      if (w > 0) setScale(w / FRAME_VIRTUAL_WIDTH);
    };
    measure(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => measure(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="absolute inset-0 overflow-hidden">
      {/* Rendered only once the real width is known — mounting at a
          guessed scale would make the viewer lay out twice and flash. */}
      {scale > 0 && (
        <iframe
          src={src}
          title={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute left-0 top-0 border-0"
          style={{
            width: FRAME_VIRTUAL_WIDTH,
            // Percentage of the host box, pre-scale, so that after the
            // transform the frame covers exactly the host's height.
            height: `${100 / scale}%`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   CertPreview — the whole certificate, no scrolling
   ──────────────────────────────────────────────────────────
   pdfhost's viewer (ScaledFrame below) draws the page at 100% under its
   own toolbars, so a landscape certificate never fit and visitors had to
   scroll inside the frame to read it. The pre-rendered image is sized to
   the space the inspector actually has: full width, unless that would
   make it taller than the viewport minus the pinned header/actions/tabs —
   then it shrinks by height instead, keeping its own aspect ratio.
   Clicking it opens the full pdfhost page, same as the button above.
   ══════════════════════════════════════════════════════════ */
function CertPreview({ variant, title }: { variant: CertVariant; title: string }) {
  const dims = CERT_PREVIEWS[variant.id];
  /* Badge-only credentials (e.g. AWS Educate) have no certificate page to
     embed — Credly refuses to be framed — so show the badge art itself. */
  if (!variant.viewWebUrl) {
    const href = variant.credlyPublicUrl;
    const img = variant.credlyBadgeImageUrl;
    return (
      <div className="relative w-full rounded-2xl border border-[var(--color-glass-border)] bg-gradient-to-b from-[var(--color-starlight)]/[0.05] to-transparent py-8 sm:py-10 flex flex-col items-center gap-4">
        {img ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imgSrc(img)}
            alt={title}
            className="h-40 w-40 sm:h-52 sm:w-52 object-contain drop-shadow-[0_22px_28px_rgba(0,0,0,0.6)]"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <BadgeCheck size={72} className="text-amber-400" />
        )}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-ash)] hover:text-[var(--color-starlight)] transition-colors"
          >
            Digital badge · view on Credly ↗
          </a>
        )}
      </div>
    );
  }
  if (!dims) {
    return (
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-starlight)]/[0.04] overflow-hidden">
        <ScaledFrame src={variant.viewWebUrl} title={title} />
      </div>
    );
  }
  const [w, h] = dims;
  const ratio = w / h;
  return (
    <a
      href={variant.viewWebUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${title} — open the full certificate in a new tab`}
      className="group/cert relative mx-auto block cursor-zoom-in overflow-hidden rounded-xl border border-[var(--color-glass-border)] bg-white shadow-[0_18px_50px_-20px_rgba(0,0,0,0.45)]"
      style={{
        aspectRatio: `${w} / ${h}`,
        width: `min(100%, calc(max(11rem, 100svh - 30rem) * ${ratio.toFixed(4)}))`,
      }}
    >
      {/* Remote-free, pre-sized static asset; next/image adds nothing with
          images.unoptimized. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset(`/certs/${variant.id}.webp`)}
        alt={title}
        width={w}
        height={h}
        decoding="async"
        className="h-full w-full object-contain"
      />
      <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/70 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-white opacity-0 transition-opacity duration-200 group-hover/cert:opacity-100">
        Open full certificate ↗
      </span>
    </a>
  );
}

export interface CertVariant {
  id: string;
  name: string; // e.g. "Cisco Networking Academy", "IBM SkillsBuild", "DICT-ITU DTC Initiative"
  viewWebUrl?: string; // pdfhost URL; omitted for badge-only credentials
  previewPdfUrl?: string;
  previewImageUrl?: string;
  credlyBadgeId?: string;
  credlyPublicUrl?: string;
  credlyBadgeImageUrl?: string;
}

export interface RealCertification {
  id: string;
  title: string;
  /** Known subjects get their own icon + filter tab; any other string still
      works (it gets a filter tab of its own and a generic icon). */
  subject: string;
  issuer: string;
  issueDate: string;
  skills: string[];
  description: string;
  badgeBgColor: string;
  variants: CertVariant[];
  credlyVerified: boolean;
  /** Tile artwork: one image URL, or several shown side by side. */
  artwork?: string | string[];
  /** Show each issuer's Credly badge side by side on the tile. */
  showAllBadges?: boolean;
}

/* Every credential lives in src/data/certifications.json so the Cert Manager
   app can add, edit and reorder them through the GitHub API without touching
   this file. Array order is display order.
     artwork        → image(s) shown on the tile (string or list of URLs)
     showAllBadges  → tile shows each issuer's Credly badge side by side
     viewWebUrl     → optional; without one the inspector shows the badge art */
export const ALL_CERTIFICATIONS = certificationData as RealCertification[];

const CERT_COUNT = ALL_CERTIFICATIONS.length;
const ALL_SUBJECTS = `ALL SUBJECTS (${CERT_COUNT})`;

/* Filter tabs: known subjects in a fixed order, then any new subject added
   through the Cert Manager. Subjects with no certificates are hidden. */
const SUBJECT_ORDER = [
  "AI",
  "Cloud",
  "Data Science",
  "Cybersecurity",
  "Software Engineering",
  "Systems & IoT",
  "Business & Professional",
];
const SUBJECTS_PRESENT = Array.from(new Set(ALL_CERTIFICATIONS.map((c) => c.subject)));
const SUBJECT_CATEGORIES = [
  ALL_SUBJECTS,
  ...[
    ...SUBJECT_ORDER.filter((s) => SUBJECTS_PRESENT.includes(s)),
    ...SUBJECTS_PRESENT.filter((s) => !SUBJECT_ORDER.includes(s)),
  ].map((s) => s.toUpperCase()),
];


function CredentialCardBody({ cert, badge }: { cert: RealCertification; badge: ReactNode }) {
  const verifiedVariants = cert.variants.filter((variant) => variant.credlyPublicUrl);
  const issuerCount = cert.variants.length;

  return (
    <>
      <div className="relative -mt-14 mb-7 flex justify-center items-end px-5 pointer-events-none">
        {badge}
      </div>

      <div className="px-5 pt-3 pb-5 flex flex-col flex-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-ash)] block mb-1.5 truncate">
          {cert.issuer}
        </span>

        <h3 className="font-display text-base font-bold text-[var(--color-starlight)] leading-snug group-hover:text-[var(--color-accent-warm)] transition-colors mb-2">
          {cert.title}
        </h3>

        <p className="font-body text-xs text-[var(--color-silver)] line-clamp-2 leading-relaxed mb-4">
          {cert.description}
        </p>

        <div className="mt-auto pt-4 border-t border-[var(--color-glass-border)] space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {cert.skills.slice(0, 3).map((skill) => (
              <span
                key={skill}
                className="font-mono text-[9px] text-[var(--color-silver)] bg-white/5 px-2 py-0.5 rounded-md border border-white/10"
              >
                {skill}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 font-mono text-[9.5px] text-[var(--color-ash)]">
              <span className="text-[var(--color-accent-primary)] font-bold uppercase tracking-wide truncate">
                {cert.subject}
              </span>
              {cert.credlyVerified && (
                <span className="flex items-center gap-1 text-amber-400 shrink-0">
                  <BadgeCheck size={11} />
                  Verified
                </span>
              )}
              {issuerCount > 1 && (
                <span className="flex items-center gap-1 text-cyan-300 shrink-0">
                  <Layers size={11} />
                  {issuerCount}
                </span>
              )}
              {verifiedVariants.length > 0 && verifiedVariants.length !== issuerCount && (
                <span className="sr-only">{verifiedVariants.length} verified issuer(s)</span>
              )}
            </div>

            <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--color-silver)] group-hover:text-[var(--color-starlight)] transition-colors">
              View →
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

const INITIAL_VISIBLE = 6;

/* Compact issuer labels for the inspector tabs below `lg`: with up to four
   issuers sharing one row, "CISCO NETWORKING ACADEMY" truncated to "CIS…"
   on phones and the tabs became unreadable. */
const SHORT_ISSUER: Record<string, string> = {
  "Cisco Networking Academy": "Cisco",
  "IBM SkillsBuild": "IBM",
  "DICT-ITU DTC Initiative": "DICT-ITU",
  "DICT ILCDB": "DICT ILCDB",
  "AWS Educate": "AWS",
};

export default function Certifications() {
  const [activeSubject, setActiveSubject] = useState<string>(ALL_SUBJECTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCert, setSelectedCert] = useState<RealCertification | null>(null);
  const [activeVariantId, setActiveVariantId] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lenis = useLenis();

  /* Clicking a subject filter tab re-renders the credential grid, which can
     change the page height. Left alone, Lenis' cached scroll limit goes stale
     and the page jumps — the "tab click resets scroll" report. Capture the
     offset at click time and restore it once the new grid is laid out. */
  const preserveScrollRef = useRef<number | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  /* Same root cause as the EVA modal: `overflow: hidden` on body/html does
     nothing while Lenis is running, because Lenis translates the page from
     its own rAF loop rather than using native scroll. The shared hook stops
     the instance, pins the body (the only lock iOS honours), and restores
     the exact scroll offset on close. */
  useScrollLock(!!selectedCert, lenis);

  /* Escape closes the inspector — expected of any modal, and the only way
     out for keyboard users if the header scrolls out of reach. */
  useEffect(() => {
    if (!selectedCert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedCert(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedCert]);

  /* Restore the scroll offset captured on a subject-tab click, after the new
     grid has been laid out. `immediate` + `force` write straight through
     Lenis so the restore can't be animated or swallowed by a stale state. */
  useLayoutEffect(() => {
    const y = preserveScrollRef.current;
    if (y === null) return;
    preserveScrollRef.current = null;
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
  }, [activeSubject, expanded, lenis]);

  // Open Inspector Modal with default variant selected
  const handleOpenInspector = (cert: RealCertification) => {
    setSelectedCert(cert);
    const preferredVariant = cert.variants.find((variant) => variant.credlyBadgeId) ?? cert.variants[0];
    if (preferredVariant) {
      setActiveVariantId(preferredVariant.id);
    }
  };

  const currentVariant = useMemo(() => {
    if (!selectedCert) return null;
    return (
      selectedCert.variants.find((v) => v.id === activeVariantId) ||
      selectedCert.variants[0]
    );
  }, [selectedCert, activeVariantId]);

  // Filtered certifications calculation across every credential
  const filteredCerts = useMemo(() => {
    return ALL_CERTIFICATIONS.filter((cert) => {
      const matchesSubject =
        activeSubject === ALL_SUBJECTS ||
        cert.subject.toUpperCase() === activeSubject;
      const matchesSearch =
        cert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cert.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
        cert.issuer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSubject && matchesSearch;
    });
  }, [activeSubject, searchQuery]);

  return (
    <section id="certifications" className="section-padding relative select-none overflow-hidden">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[160px] bg-[var(--color-accent-primary)]/10 z-0" />

      <div className="container-narrow relative z-10">
        <ChapterLabel index={5} classic={`Credential Vault (${CERT_COUNT} Certs)`} eva="CREDENTIAL VAULT" className="mb-8" />

        <div className="mb-8">
          <div>
            <RevealText
              as="h2"
              className="text-section-title mb-4 font-display text-[var(--color-starlight)]"
            >
              {`${CERT_COUNT} Official Verified Credentials.`}
            </RevealText>
            <p className="font-body text-base text-[var(--color-silver)] max-w-prose">
              Browse {CERT_COUNT} verified professional certifications. Click any tile to inspect multi-issuer credentials (AWS, Cisco, IBM, DICT-ITU, DICT ILCDB), view web certificate links, and verify official Credly badges.
            </p>
          </div>

        </div>

        {/* Toolbar: search + subject filter live in one cohesive surface.
            The field keeps a floor width (`sm:basis-64`) instead of a bare
            `flex-1`: next to a 7-button filter row, flex shrank it below the
            width of its own placeholder, which is why the label was clipped
            mid-word. */}
        <div className="glass border border-[var(--color-glass-border)] rounded-2xl p-3 sm:p-3.5 mb-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative w-full sm:basis-64 sm:shrink-0 min-w-0">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ash)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setExpanded(false);
              }}
              placeholder="Search title or issuer…"
              className="w-full min-w-0 pl-10 pr-3 py-2.5 rounded-xl bg-[var(--color-glass-highlight)] border border-[var(--color-glass-border)] font-mono text-[16px] sm:text-[11px] text-[var(--color-starlight)] text-ellipsis placeholder:text-[var(--color-ash)] focus:outline-none focus:border-[var(--color-accent-primary)]/60 transition-colors"
            />
          </div>

          <div className="hidden sm:block w-px self-stretch bg-[var(--color-glass-border)]" />

          <div className="flex flex-wrap gap-1.5">
            {SUBJECT_CATEGORIES.map((cat) => {
              const isActive = activeSubject === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    preserveScrollRef.current = window.scrollY;
                    setActiveSubject(cat);
                    setExpanded(false);
                  }}
                  className={`px-3 py-2 rounded-lg font-mono text-[10.5px] uppercase tracking-wider transition-[color,background-color,transform] duration-200 ease-out cursor-pointer active:scale-[0.97] ${isActive
                    ? "bg-[var(--color-accent-primary)] text-white font-bold"
                    : "text-[var(--color-silver)] hover:text-[var(--color-starlight)] hover:bg-[var(--color-glass-highlight)]"
                    }`}
                  data-cursor-hover
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Credential Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 hover-focus-container">
          <AnimatePresence initial={false}>
            {(expanded ? filteredCerts : filteredCerts.slice(0, INITIAL_VISIBLE)).map((cert) => {
              const defaultVariant = cert.variants.find((variant) => variant.credlyBadgeId) ?? cert.variants[0];
              const verifiedVariants = cert.variants.filter((variant) => variant.credlyPublicUrl);
              const badgeImageUrl = defaultVariant?.credlyBadgeImageUrl;
              const badgeVariantsToShow = verifiedVariants.filter((variant) => variant.credlyBadgeImageUrl).slice(0, 3);
              const artworkUrl = cert.artwork;

              let badgeNode: ReactNode;
              if (cert.showAllBadges) {
                if (badgeVariantsToShow.length > 1) {
                  badgeNode = (
                    <div
                      className="grid gap-7 w-full max-w-[20rem] h-28"
                      style={{ gridTemplateColumns: `repeat(${badgeVariantsToShow.length}, minmax(0, 1fr))` }}
                    >
                      {badgeVariantsToShow.map((variant) => (
                        <div
                          key={variant.id}
                          className="h-full flex items-center justify-center drop-shadow-[0_20px_26px_rgba(0,0,0,0.6)] transition-all will-change-transform transform-gpu duration-500 ease-out group-hover:-translate-y-3 group-hover:scale-105"
                        >
                          {/* Remote badge URLs vary by issuer/CDN; keep native img here. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imgSrc(variant.credlyBadgeImageUrl)}
                            alt={`${variant.name} badge artwork`}
                            className="h-full w-full object-contain"
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ))}
                    </div>
                  );
                } else if (badgeImageUrl) {
                  badgeNode = (
                    <div className="w-36 h-36 flex items-center justify-center drop-shadow-[0_22px_28px_rgba(0,0,0,0.6)] transition-all will-change-transform transform-gpu duration-500 ease-out group-hover:-translate-y-3.5 group-hover:scale-105">
                      {/* Remote badge URLs vary by issuer/CDN; keep native img here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgSrc(badgeImageUrl)}
                        alt={`${defaultVariant?.name ?? cert.title} badge artwork`}
                        className="h-full w-full object-contain"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  );
                } else {
                  badgeNode = (
                    <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${cert.badgeBgColor} flex items-center justify-center text-white shadow-[0_22px_28px_rgba(0,0,0,0.6)] transition-all will-change-transform transform-gpu duration-500 ease-out group-hover:-translate-y-3.5 group-hover:scale-105`}>
                      <SubjectIcon subject={cert.subject} size={40} />
                    </div>
                  );
                }
              } else if (artworkUrl) {
                const artworkList = Array.isArray(artworkUrl) ? artworkUrl : [artworkUrl];

                badgeNode =
                  artworkList.length > 1 ? (
                    <div
                      className="grid gap-7 w-full max-w-[20rem] h-28"
                      style={{ gridTemplateColumns: `repeat(${artworkList.length}, minmax(0, 1fr))` }}
                    >
                      {artworkList.map((url) => (
                        <div
                          key={url}
                          className="h-full flex items-center justify-center drop-shadow-[0_20px_26px_rgba(0,0,0,0.6)] transition-all will-change-transform transform-gpu duration-500 ease-out group-hover:-translate-y-3 group-hover:scale-105"
                        >
                          {/* Certificate artwork can be remote; preserve native img + no-referrer. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imgSrc(url)}
                            alt={`${cert.title} certificate artwork`}
                            className="h-full w-full object-contain"
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="w-full max-w-[17.5rem] h-28 flex items-center justify-center drop-shadow-[0_22px_28px_rgba(0,0,0,0.6)] transition-all will-change-transform transform-gpu duration-500 ease-out group-hover:-translate-y-3.5 group-hover:scale-105">
                      {/* Certificate artwork can be remote; preserve native img + no-referrer. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgSrc(artworkList[0])}
                        alt={`${cert.title} certificate artwork`}
                        className="h-full w-full object-contain"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  );
              } else if (badgeImageUrl) {
                badgeNode = (
                  <div className="w-full max-w-[17.5rem] h-28 flex items-center justify-center drop-shadow-[0_22px_28px_rgba(0,0,0,0.6)] transition-all will-change-transform transform-gpu duration-500 ease-out group-hover:-translate-y-3.5 group-hover:scale-105">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgSrc(badgeImageUrl)}
                      alt={`${cert.title} badge artwork`}
                      className="h-full w-full object-contain"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                );
              } else {
                badgeNode = (
                  <div className={`w-full max-w-[15rem] h-28 rounded-[1.5rem] bg-gradient-to-br ${cert.badgeBgColor} shadow-[0_16px_28px_-18px_rgba(0,0,0,0.6)] flex items-center justify-center transition-all duration-500 ease-out group-hover:-translate-y-3`}>
                    <SubjectIcon subject={cert.subject} size={44} className="text-white" />
                  </div>
                );
              }

              return (
                /* No entrance, exit or stagger on the tiles. Expanding used to
                   pop each new card in with a scaled, delayed fade; the ask was
                   for the list to simply grow, so the extra cards are present
                   the frame they are added and the only movement is the page
                   reflowing around them. Hover/tap feedback stays.

                   Also no `layout` and no spring: closing the inspector
                   restores the locked scroll offset, so every card's box
                   changes in one frame, which Framer would read as a move and
                   bounce the whole tile set. */
                <motion.div
                  key={cert.id}
                  whileHover={{ scale: 1.02, y: -6 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ duration: 0.24, ease: EASING }}

                  onClick={() => handleOpenInspector(cert)}
                  data-hoverable
                  data-cursor-hover
                  className="group relative min-w-0 rounded-2xl glass [backdrop-filter:none]! [-webkit-backdrop-filter:none]! border border-[var(--color-glass-border)] hover:border-[var(--color-accent-primary)]/70 transition-[border-color,box-shadow] duration-500 ease-out flex flex-col overflow-visible cursor-pointer pt-12 hover:z-30 hover:shadow-[0_32px_75px_-16px_rgba(67,97,238,0.55)]"
                >
                  <CredentialCardBody cert={cert} badge={badgeNode} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Fade mask + expand button */}
        {filteredCerts.length > INITIAL_VISIBLE && (
          <div className="relative">
            {/* Gradient that fades over the last row when collapsed */}
            <AnimatePresence>
              {!expanded && (
                <motion.div
                  key="fade"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="absolute -top-52 inset-x-0 h-56 pointer-events-none z-10"
                  style={{ background: "linear-gradient(to bottom, transparent 0%, var(--color-void) 80%)" }}
                />
              )}
            </AnimatePresence>

            <div className="relative z-20 mt-2 flex flex-col items-center gap-3">
              <motion.button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                data-cursor-hover
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-3 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-md px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-silver)] hover:border-[var(--color-accent-primary)]/60 hover:text-[var(--color-starlight)] transition-colors duration-200"
              >
                <motion.span
                  animate={{ rotate: expanded ? 180 : 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className="inline-block"
                >
                  {expanded ? "↑" : "↓"}
                </motion.span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={expanded ? "less" : "more"}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                  >
                    {expanded ? "Collapse — show less" : `See all ${filteredCerts.length} credentials`}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
              <AnimatePresence>
                {!expanded && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="font-mono text-[10px] text-[var(--color-ash)]"
                  >
                    Showing {Math.min(INITIAL_VISIBLE, filteredCerts.length)} of {filteredCerts.length}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {filteredCerts.length === 0 && (
          <div className="py-16 text-center glass rounded-3xl border border-[var(--color-glass-border)] p-8">
            <BookOpen size={32} className="mx-auto mb-3 text-[var(--color-ash)]" />
            <h4 className="font-display text-lg font-bold text-[var(--color-starlight)]">No matching certificates found</h4>
            <p className="font-body text-sm text-[var(--color-ash)] mt-1">Try clearing your search query or selecting another category.</p>
          </div>
        )}
      </div>

      {/* PORTAL MODAL — Mounted under document.body to prevent parent hover-focus-container blur */}
      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {selectedCert && currentVariant && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={() => setSelectedCert(null)}
                className="fixed inset-0 z-[99999] flex items-start justify-center overflow-hidden px-4 py-6 bg-black/50 backdrop-blur-md select-none pointer-events-auto"
              >
                <motion.div
                  initial={{ scale: 0.92, opacity: 0, y: 16 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.92, opacity: 0, y: 16 }}
                  transition={{ type: "spring", stiffness: 360, damping: 30 }}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${selectedCert.title} credential inspector`}
                  className="relative w-full max-w-6xl my-auto rounded-[1.75rem] p-4 sm:p-5 border border-[var(--color-glass-border)] shadow-[var(--shadow-raised,0_24px_80px_rgba(0,0,0,0.55))] text-[var(--color-starlight)] flex flex-col max-h-[calc(100svh-3rem)] overflow-hidden bg-[var(--color-obsidian)] z-[100000]"
                >
                  {/* ── Header: identity only ──────────────────────
                      Priority order in this panel is deliberate:
                        title/issuer → actions → preview → extra info.
                      The two links used to sit UNDER a 42rem-tall preview,
                      i.e. a full screen of scrolling away on a phone, which
                      buried the one thing a recruiter opens this for. */}
                  <div className="flex items-start justify-between gap-4 pb-3 mb-3 sm:pb-4 sm:mb-4 border-b border-[var(--color-glass-border)]">
                    <div className="min-w-0 pr-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-accent-warm)] font-bold bg-[var(--color-accent-warm)]/10 px-2.5 py-0.5 rounded-full border border-[var(--color-accent-warm)]/30 inline-flex items-center gap-1 mb-2">
                        <CheckCircle2 size={10} />
                        AUTHENTICATED CREDENTIAL VAULT ({selectedCert.issueDate})
                      </span>
                      <h3 className="font-display text-xl sm:text-[1.75rem] font-bold text-[var(--color-starlight)] leading-tight max-w-3xl">
                        {selectedCert.title}
                      </h3>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-silver)] mt-1.5">
                        {currentVariant.name}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedCert(null)}
                      aria-label="Close inspector"
                      className="shrink-0 h-10 px-3 sm:px-4 rounded-full bg-[var(--color-starlight)]/[0.06] hover:bg-[var(--color-starlight)]/[0.12] flex items-center gap-2 text-[var(--color-silver)] hover:text-[var(--color-starlight)] transition-[background-color,color,transform] duration-150 ease-out cursor-pointer active:scale-[0.97] border border-[var(--color-glass-border)] font-mono text-[10px] font-bold uppercase tracking-widest"
                    >
                      <X size={16} />
                      <span className="hidden sm:inline">Close inspector</span>
                    </button>
                  </div>

                  {/* ── Actions: pinned above the scroll area ──────
                      Outside the scroll container on purpose, so they stay
                      reachable no matter how far down the preview is. */}
                  <div className="shrink-0 flex flex-row items-stretch gap-2 sm:gap-2.5 pb-3 mb-3 sm:pb-4 sm:mb-4 border-b border-[var(--color-glass-border)]">
                    {currentVariant.viewWebUrl && (
                    <a
                      href={currentVariant.viewWebUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0 inline-flex items-center justify-center gap-2 sm:gap-2.5 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-starlight)]/[0.06] px-3 sm:px-5 py-3 sm:py-3.5 font-mono text-[11px] sm:text-[13px] font-bold uppercase tracking-wide text-[var(--color-starlight)] transition-[background-color,border-color,transform,box-shadow] duration-200 ease-out hover:bg-[var(--color-starlight)]/[0.14] hover:border-[var(--color-starlight)]/25 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]"
                    >
                      <Globe size={17} className="text-[var(--color-accent-primary)] shrink-0" />
                      <span className="sm:hidden">Certificate</span>
                      <span className="hidden sm:inline">Visit certificate page</span>
                    </a>
                    )}
                    {currentVariant.credlyPublicUrl ? (
                      <a
                        href={currentVariant.credlyPublicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 inline-flex items-center justify-center gap-2 sm:gap-2.5 rounded-xl border border-amber-400/40 bg-amber-400 px-3 sm:px-5 py-3 sm:py-3.5 font-mono text-[11px] sm:text-[13px] font-bold uppercase tracking-wide text-black shadow-[0_8px_24px_rgba(251,191,36,0.25)] transition-[background-color,border-color,transform,box-shadow] duration-200 ease-out hover:bg-amber-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(251,191,36,0.4)] active:translate-y-0 active:scale-[0.97]"
                      >
                        <BadgeCheck size={17} className="shrink-0" />
                        <span className="sm:hidden">Credly</span>
                        <span className="hidden sm:inline">Verify on Credly</span>
                      </a>
                    ) : (
                      <div className="flex-1 min-w-0 inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-starlight)]/[0.03] px-3 sm:px-5 py-3 sm:py-3.5 font-mono text-[10px] sm:text-[11px] uppercase tracking-wide text-[var(--color-starlight)]0 text-center">
                        <span className="sm:hidden">No Credly badge</span>
                        <span className="hidden sm:inline">No Credly badge for this issuer</span>
                      </div>
                    )}
                  </div>

                  {/* Issuer tabs — pinned ABOVE the scroll area, not inside it.
                      They used to live at the top of the scroll panel, so the
                      certificate cross-fade below changed the panel's scroll
                      height mid-animation and reflowed the tab bar. The
                      layoutId pill read that reflow as a move and jumped —
                      the "tab glitch". Pinning the tabs (like the action
                      buttons above) takes them out of any content-driven
                      reflow entirely, so the pill only ever animates between
                      stable tab positions. */}
                  {selectedCert.variants.length > 1 && (
                    <div className="shrink-0 px-1 pb-3 mb-3 sm:pb-4 sm:mb-4 border-b border-[var(--color-glass-border)]">
                      <div className="flex items-center justify-between gap-3 mb-2 sm:mb-3">
                        <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--color-ash)]">
                          Issued by
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 border border-[var(--color-accent-primary)]/30 px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
                          <Layers size={10} />
                          {selectedCert.variants.length} issuers
                        </span>
                      </div>

                      {/* Notch-style animated pill tab switcher — spans full width, tabs share it evenly */}
                      <div className="relative flex items-end gap-1 rounded-full bg-[var(--color-starlight)]/[0.04] border border-[var(--color-glass-border)] p-1.5 pt-4 w-full">
                        {selectedCert.variants.map((variant) => {
                          const isTabActive = variant.id === currentVariant.id;
                          return (
                            <button
                              key={variant.id}
                              type="button"
                              onClick={() => setActiveVariantId(variant.id)}
                              className="relative z-10 flex-1 min-w-0 whitespace-nowrap px-1 sm:px-5 py-2.5 rounded-full font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-normal sm:tracking-wider cursor-pointer"
                            >
                              {isTabActive && (
                                <motion.span
                                  layoutId="issuerTabPill"
                                  transition={TAB_SPRING}
                                  className="absolute inset-0 -top-3 rounded-t-2xl rounded-b-xl bg-[var(--color-accent-primary)] shadow-[0_10px_28px_rgba(67,97,238,0.5)]"
                                />
                              )}
                              <span
                                className={`relative block truncate transition-colors duration-200 ${
                                  isTabActive ? "text-white" : "text-[var(--color-silver)] hover:text-[var(--color-starlight)]"
                                }`}
                              >
                                <span className="lg:hidden">{SHORT_ISSUER[variant.name] ?? variant.name}</span>
                                <span className="hidden lg:inline">{variant.name}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="scroll-panel flex-1 min-h-0 pr-1 space-y-4 pb-2">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentVariant.id}
                        initial={{ opacity: 0, transform: "translateY(6px)" }}
                        animate={{ opacity: 1, transform: "translateY(0px)" }}
                        exit={{ opacity: 0, transform: "translateY(-6px)" }}
                        transition={{ duration: 0.2, ease: EASING }}
                        className="rounded-3xl border border-[var(--color-glass-border)] bg-[var(--color-abyss)]/70 p-3 sm:p-4 flex flex-col gap-3"
                      >
                        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-ash)] block">
                          Certificate Preview
                        </span>

                        <CertPreview
                          variant={currentVariant}
                          title={`${selectedCert.title} — ${currentVariant.name} certificate`}
                        />

                        <p className="font-body text-sm text-[var(--color-silver)] leading-relaxed">
                          {selectedCert.description}
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                          {selectedCert.skills.map((skill) => (
                            <span
                              key={skill}
                              className="font-mono text-[9px] text-[var(--color-silver)] bg-[var(--color-starlight)]/[0.04] px-2 py-0.5 rounded-md border border-[var(--color-glass-border)]"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </section>
  );
}
