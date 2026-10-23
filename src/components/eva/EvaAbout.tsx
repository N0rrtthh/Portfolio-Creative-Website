"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import profilePic from "@/../public/profile.jpg";

export default function EvaAbout() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <section ref={ref} id="about" className="relative py-32">
      <div className="container-narrow">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="mb-16 border-b-2 border-[var(--color-accent-primary)] pb-4 flex items-end justify-between"
        >
          <h2 className="font-display text-3xl font-bold text-[var(--color-accent-primary)] uppercase tracking-wider">
            Identity // User Profile
          </h2>
          <span className="font-mono text-xs text-[var(--color-ash)]">
            CLEARANCE: LEVEL 7
          </span>
        </motion.div>

        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] items-start">
          {/* Tactical profile card */}
          <motion.div style={{ y }} className="relative">
            <div className="relative border border-[var(--color-accent-primary)]/50 bg-[var(--color-obsidian)] overflow-hidden rounded-xl shadow-2xl">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[var(--color-accent-warm)] z-20" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[var(--color-accent-warm)] z-20" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[var(--color-accent-warm)] z-20" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[var(--color-accent-warm)] z-20" />

              {/* Profile image container with static import for 100% reliable preview */}
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-black">
                <Image
                  src={profilePic}
                  alt="User profile — Elroni Quiñones"
                  width={800}
                  height={1000}
                  priority
                  className="h-full w-full object-cover object-center transition-transform duration-700 hover:scale-105"
                />

                {/* Subtle tactical tint gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-obsidian)] via-transparent to-transparent pointer-events-none z-10 opacity-70" />

                {/* HUD scan overlay lines */}
                <div className="absolute inset-0 pointer-events-none opacity-40 z-10">
                  <div className="absolute top-[25%] left-0 right-0 h-[1px] bg-[var(--color-accent-warm)]/60" />
                  <div className="absolute top-[50%] left-0 right-0 h-[1px] bg-[var(--color-accent-warm)]/60" />
                  <div className="absolute top-[75%] left-0 right-0 h-[1px] bg-[var(--color-accent-warm)]/60" />
                  <div className="absolute left-[30%] top-0 bottom-0 w-[1px] bg-[var(--color-accent-warm)]/40" />
                  <div className="absolute left-[70%] top-0 bottom-0 w-[1px] bg-[var(--color-accent-warm)]/40" />
                </div>

                {/* Bottom data */}
                <div className="absolute bottom-4 left-4 right-4 z-20">
                  <span className="font-mono text-[10px] text-[var(--color-accent-warm)] tracking-[0.3em] block mb-1">
                    BIOMETRIC SCAN COMPLETE
                  </span>
                  <span className="font-mono text-lg font-bold text-white block drop-shadow-md">
                    QUIÑONES, ELRONI
                  </span>
                </div>
              </div>

              {/* Data strip */}
              <div className="p-4 space-y-2 border-t border-[var(--color-accent-primary)]/30 bg-[var(--color-obsidian)]">
                {[
                  { label: "DESIGNATION", value: "NRTH." },
                  { label: "SYNC RATIO", value: "400.00%" },
                  { label: "STATUS", value: "OPERATIONAL" },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between font-mono text-xs">
                    <span className="text-[var(--color-ash)]">{item.label}</span>
                    <span className="text-[var(--color-accent-warm)]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Identity data */}
          <div className="space-y-8">
            {/* Classification terminal */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-[var(--color-obsidian)] border border-[var(--color-accent-primary)]/40 p-6 relative rounded-xl"
            >
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[var(--color-accent-warm)]" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[var(--color-accent-warm)]" />

              <span className="font-mono text-[10px] text-[var(--color-accent-warm)] tracking-[0.3em] block mb-4">
                &gt; CLASSIFIED PERSONNEL FILE
              </span>
              <div className="space-y-3 font-mono text-sm text-[var(--color-pearl)] leading-relaxed">
                <p>
                  <span className="text-[var(--color-accent-primary)]">&gt;</span> Full-stack software engineer specializing in high-performance digital systems. Operates across web, mobile, and game development platforms.
                </p>
                <p>
                  <span className="text-[var(--color-accent-primary)]">&gt;</span> Deployed production systems at{" "}
                  <span className="text-[var(--color-accent-warm)] font-bold">BidaBoss Inc.</span> — React + Node.js franchise order portal (live in production) and a Flutter e-commerce app.
                </p>
                <p>
                  <span className="text-[var(--color-accent-primary)]">&gt;</span> Independent operator: Godot game production, Blender 3D, interactive web experiences. Interface obsession meets engineering rigor.
                </p>
              </div>
            </motion.div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "PROJECTS DEPLOYED", value: "12+", icon: "◆" },
                { label: "YEARS ACTIVE", value: "4+", icon: "◈" },
                { label: "CERTIFICATIONS", value: "29", icon: "◇" },
                { label: "TECH MODULES", value: "20+", icon: "◆" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="border border-[var(--color-accent-primary)]/30 bg-[var(--color-obsidian)] p-4 hover:border-[var(--color-accent-warm)] transition-colors group rounded-xl"
                  data-cursor-hover
                >
                  <span className="font-mono text-[10px] text-[var(--color-ash)] block mb-2">
                    {stat.icon} {stat.label}
                  </span>
                  <span className="font-display text-2xl font-bold text-white group-hover:text-[var(--color-accent-warm)] transition-colors">
                    {stat.value}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
