import Image, { type StaticImageData } from "next/image";

/* ══════════════════════════════════════════════════════════
   PHONE MOCKUP — Pixel 9 Pro XL-style device frames
   ──────────────────────────────────────────────────────────
   The screenshots come straight from the Android Studio emulator:
   898×2000, already masked to the rounded display with the punch-hole
   camera drawn in. So the frame only has to supply the hardware — a
   slim near-black bezel, a hairline metal edge and the side keys.

   Everything is proportional (percent radii, aspect-ratio, % insets),
   so one component fits a 70vh desktop card, a 16:9 modal and a phone
   carousel without per-breakpoint numbers. Elliptical `14% / 6.5%`
   radii keep the corner circular on a 0.46-aspect body.
   ══════════════════════════════════════════════════════════ */

const FRAME_ASPECT = "461 / 1000";

function PhoneFrame({
  src,
  alt,
  sizes,
  priority,
  className = "",
}: {
  src: StaticImageData;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    /* Positioning comes entirely from the caller: hard-coding `relative`
       here beat the back phone's `absolute` in Tailwind's utility order,
       dropping it into flow and shoving the front phone off the card. */
    <div className={className} style={{ aspectRatio: FRAME_ASPECT }}>
      {/* Side keys: power, then the volume rocker. */}
      <span className="absolute -right-[1.4%] top-[17%] h-[6%] w-[1.6%] rounded-r-[2px] bg-[#2b2c31]" aria-hidden />
      <span className="absolute -right-[1.4%] top-[26%] h-[11%] w-[1.6%] rounded-r-[2px] bg-[#2b2c31]" aria-hidden />

      <div
        className="relative h-full w-full bg-[#060607] p-[2.4%] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.09),inset_0_0_0_1px_rgba(255,255,255,0.05)]"
        style={{ borderRadius: "14% / 6.5%" }}
      >
        <div className="relative h-full w-full overflow-hidden bg-black" style={{ borderRadius: "11.8% / 5.4%" }}>
          <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover object-top" />
        </div>
        {/* Glass glare — a faint diagonal sheen across the display. */}
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0)_38%)]"
          style={{ borderRadius: "14% / 6.5%" }}
          aria-hidden
        />
      </div>
    </div>
  );
}

/**
 * Fills its (positioned) parent with a tinted stage and one or two phones.
 * `align="right"` parks the devices on the right so card copy on the left
 * stays readable; `center` is for modals and previews.
 */
export default function PhoneMockupStage({
  screens,
  alt,
  color,
  align = "center",
  sizes = "(max-width: 768px) 40vw, 260px",
  priority,
  className = "",
}: {
  screens: StaticImageData[];
  alt: string;
  color: string;
  align?: "center" | "right";
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const [front, back] = screens;
  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(ellipse 60% 75% at ${align === "right" ? "72%" : "50%"} 55%, ${color}33, transparent 72%)`,
      }}
    >
      <div
        className={`absolute inset-0 flex items-center ${
          align === "right" ? "justify-end pr-[9%]" : "justify-center"
        }`}
      >
        {/* The wrapper is the FRONT phone's box; the back phone hangs off
            its left edge. The pair is nudged right by a fifth of a phone so
            the group, not the front device, is what reads as centred. */}
        <div
          className={`relative h-[84%] ${back && align === "center" ? "translate-x-[20%]" : ""}`}
          style={{ aspectRatio: FRAME_ASPECT }}
        >
          {back && (
            <PhoneFrame
              src={back}
              alt={`${alt} — secondary screen`}
              sizes={sizes}
              className="absolute right-[40%] top-[8%] h-[88%] -rotate-[7deg] opacity-90"
            />
          )}
          <PhoneFrame src={front} alt={alt} sizes={sizes} priority={priority} className="relative h-full rotate-[2deg]" />
        </div>
      </div>
    </div>
  );
}
