"use client";

import RevealText from "@/components/ui/RevealText";
import ChapterLabel from "@/components/ui/ChapterLabel";
import TechFlipGrid from "@/components/ui/TechFlipGrid";
import AnimeTraceLine from "@/components/ui/AnimeTraceLine";


/* The Anime.js stagger matrix used to live here as a second, unrelated
   panel under the conveyor. It now sits in the Contact section, where an
   ambient interactive surface has a reason to exist. */
export default function TechStack() {
  return (
    /* Deliberately not `section-padding`: this section is now description →
       cards with nothing between them, so it needs a tighter vertical rhythm
       than the narrative sections. Values are real padding, not negative
       margins undoing the old layout. */
    <section
      id="techstack"
      className="relative overflow-hidden py-12 md:py-16"
      /* The belts of flip cards run continuous marquees: skip rendering
         them entirely while the section is off-screen. */
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 760px" }}
    >
      <div id="tech-stack" className="scroll-mt-24" />
      <div className="container-narrow">
        <ChapterLabel index={4} classic="Tech Stack" eva="EQUIPMENT MANIFEST" className="mb-4" />
        <RevealText
          as="h2"
          className="text-section-title mb-3 font-display text-[var(--color-starlight)]"
        >
          Tools & Tech Stack.
        </RevealText>
        <p className="font-body text-base text-[var(--color-silver)] max-w-prose mb-2">
          What I build with daily — full-stack, mobile, game engines, and design systems.
        </p>

        {/* Frameless trace between the copy and the flip grid: it reads
            as the signal feeding the cards below rather than as a
            widget in a box. */}
        <AnimeTraceLine className="mb-2" height={22} duration={4} />

        <TechFlipGrid />

      </div>
    </section>
  );
}
