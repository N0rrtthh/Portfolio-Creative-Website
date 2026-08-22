import type { TechItem } from "@/lib/data";
import { techIconUrl } from "@/lib/techIcons";

/**
 * Brand mark on a light chip so dark logos stay readable in both themes.
 * Shared by the conveyor grid (TechFlipGrid). Falls back to the emoji/text
 * glyph when no CDN icon exists for the technology.
 */
export default function TechMark({
  tech,
  size = 44,
}: {
  tech: TechItem;
  size?: number;
}) {
  const url = techIconUrl(tech.name);

  if (!url) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-xl bg-white/5 shadow-inner"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
        aria-hidden="true"
      >
        {tech.icon}
      </span>
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl bg-white shadow-[0_4px_16px_rgba(0,0,0,0.45)]"
      style={{ width: size, height: size, padding: size * 0.16 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="h-full w-full object-contain"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </span>
  );
}