"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import RevealText from "@/components/ui/RevealText";
import ChapterLabel from "@/components/ui/ChapterLabel";
import TiltCard from "@/components/ui/TiltCard";
import profilePic from "@/../public/profile.jpg";

const EASING = [0.22, 1, 0.36, 1] as const;

export default function AboutStory() {
  return (
    /* Fullscreen chapter: fills the viewport and vertically centers its
       content, so the hero hands off to a full-screen "Who I Am" screen
       instead of a half-scrolled partial one. */
    <section id="about" className="relative flex min-h-svh flex-col">
      {/* `my-auto` (not `justify-center`): centers the block when there's
          room, but collapses to zero on overflow so the top of the chapter
          is never clipped when the snap parks the section at the viewport
          top. Padding lives here so the fixed navbar never covers content.
          The portrait is kept compact so the whole beat fits one screen. */}
      <div className="container-narrow my-auto py-16 md:py-20">
        <ChapterLabel index={2} classic="Who I Am" eva="USER IDENTITY" className="mb-6" />

        {/* Editorial Headline */}
        <div className="mb-8">
          <RevealText
            as="h2"
            className="text-section-title font-display text-[var(--color-starlight)]"
          >
            Software engineer by trade.
          </RevealText>
          <RevealText
            as="h2"
            delay={0.1}
            className="text-section-title font-display text-[var(--color-accent-primary)]"
          >
            Designer by obsession.
          </RevealText>
        </div>

        {/* Two-Column Story Beat */}
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.25fr] lg:items-center">
          {/* Portrait Image */}
          <motion.div
            initial={{ opacity: 0, x: -30, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, x: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 1.2, ease: EASING }}
            className="w-full max-w-[300px] md:max-w-[340px] mx-auto lg:mx-0"
          >
            <TiltCard max={5} className="overflow-hidden rounded-3xl border border-[var(--color-glass-border)] shadow-[0_16px_50px_rgba(0,0,0,0.4)]">
              <Image
                src={profilePic}
                alt="Elroni Quiñones — profile portrait photo"
                width={800}
                height={1000}
                className="h-auto w-full object-cover"
              />
            </TiltCard>
          </motion.div>

          {/* Story Narrative */}
          <motion.div
            initial={{ opacity: 0, y: 24, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 1.0, delay: 0.2, ease: EASING }}
            className="space-y-6 font-body text-lg leading-relaxed text-[var(--color-silver)] max-w-prose"
          >
            <p>
              I started as a full-stack developer and never stopped asking why the interfaces I shipped didn&apos;t feel as good as the code behind them. That question sent me into Figma, Blender, and motion design — and it hasn&apos;t let go since.
            </p>
            <p>
              As a Software Engineer Intern at{" "}
              <span className="text-[var(--color-pearl)] font-bold">BidaBoss Inc.</span>, I built the company&apos;s Agent Portal in React and Node.js — still live and in use — and its Flutter e-commerce app. Outside of work, I build games in Godot, model in Blender, and prototype interactive web experiences.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
