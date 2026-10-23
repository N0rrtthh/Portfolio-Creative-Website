import { Briefcase, Gamepad2, Users, Megaphone } from "lucide-react";
import type { TimelineEntry } from "@/types/experience";

/* ══════════════════════════════════════════════════════════
   EXPERIENCE TIMELINE — content source of truth for the
   "My Experience" cinematic flight-path section.
   ──────────────────────────────────────────────────────────
   Every line here is something that can be backed up: the
   internship and org roles come from the résumé, the WaterWise
   numbers from the defended thesis manuscript. No invented
   metrics, awards or uptime figures.

   Order is chronological, oldest first, so the flight path ends on
   the latest chapter: CSSO → tech communities → BidaBoss → WaterWise.
   ══════════════════════════════════════════════════════════ */

export const TIMELINE_DATA: TimelineEntry[] = [
  {
    id: "exp-1",
    number: "01",
    role: "VP for Public Relations & Information",
    company: "Computer Science Student Organization",
    period: "2022 – 2024",
    location: "CvSU – Indang",
    description:
      "Officer of the Computer Science Student Organization at Cavite State University, after starting as an Encrypt member in my first year.",
    highlights: [
      "VP for Public Relations and Information — 2023 – 2024",
      "Encrypt Member — 2022 – 2023",
    ],
    tech: ["Public Relations", "Communications", "Leadership"],
    techLabel: "Skills",
    icon: Megaphone,
    details: [
      { label: "Roles", value: "VP for Public Relations and Information (2023 – 2024); Encrypt Member (2022 – 2023)." },
    ],
    scrollTarget: 0.14,
  },
  {
    id: "exp-2",
    number: "02",
    role: "Member · Tech Communities",
    company: "AWS Learning Club · JPCS",
    period: "2023 – 2025",
    location: "CvSU – Indang",
    description:
      "Active in the campus developer communities: Spade Member of the Amazon Web Services Learning Club and a member of the Junior Philippine Computer Society, Cavite State University chapter.",
    highlights: [
      "Spade Member, Amazon Web Services Learning Club — 2024 – 2025",
      "Member, JPCS – Cavite State University Chapter — 2023 – 2024",
    ],
    tech: ["AWS", "Cloud", "Community"],
    techLabel: "Focus",
    icon: Users,
    details: [
      { label: "Clubs", value: "Amazon Web Services Learning Club; Junior Philippine Computer Society (JPCS)." },
    ],
    scrollTarget: 0.38,
  },
  {
    id: "exp-3",
    number: "03",
    role: "Software Engineer & Application Developer Intern",
    company: "BidaBoss Inc. · OJT",
    period: "Jul 2025 – Dec 2025",
    location: "Pasig City, Philippines",
    description:
      "On-the-job training as a developer at BidaBoss Inc. Built the BidaBoss Agent Portal — a web-based franchise order management system that is live and in use by the company — and the BidaBoss e-commerce mobile app.",
    highlights: [
      "Developed the BidaBoss Agent Portal, a centralized franchise order management system, with React and Node.js on MySQL",
      "Shipped the portal to production — it is in active use by BidaBoss Inc.",
      "Built the BidaBoss e-commerce mobile application in Flutter with a MySQL backend",
      "Mobile dashboard covers overall sales, order statuses (to approve, to pick up, out for delivery), inventory, store and orders",
    ],
    tech: ["React", "Node.js", "MySQL", "Flutter", "Dart"],
    icon: Briefcase,
    details: [
      { label: "Built", value: "BidaBoss Agent Portal (web) and the BidaBoss e-commerce mobile app." },
      { label: "Status", value: "The Agent Portal is live and used by BidaBoss Inc. for franchise order management." },
    ],
    scrollTarget: 0.64,
  },
  {
    id: "exp-4",
    number: "04",
    role: "Thesis Developer & Co-Proponent",
    company: "WaterWise · Cavite State University",
    period: "2025 – 2026",
    location: "Indang, Cavite",
    description:
      "Undergraduate thesis in a three-person team: WaterWise, a Godot educational game on water conservation and reuse, built to run on low-spec Android phones with offline multiplayer over a phone's Wi-Fi hotspot.",
    highlights: [
      "Rule-based rolling-window adaptive difficulty — a Weighted Proficiency Index over the last five games, no trained model or internet needed",
      "Offline co-op score sync with an integer-only G-Counter CRDT over a Wi-Fi hotspot",
      "Benchmarked on a Motorola Moto E5 Plus: 28.2–29.6 FPS average, 0.59–0.66 ms per difficulty update",
      "CRDT replicas converged in all 180 simulated trials at 10–90% packet loss, with updates 76–83% smaller than JSON",
    ],
    tech: ["Godot", "GDScript", "Android", "CRDT", "Scrum"],
    icon: Gamepad2,
    details: [
      {
        label: "Thesis",
        value:
          "WaterWise: An Educational Game Using Deterministic Rule-Based Adaptive Difficulty and CRDT Synchronization.",
      },
      { label: "Process", value: "Developed in Scrum sprints; evaluated through device benchmarking plus disconnection and packet-loss testing." },
    ],
    scrollTarget: 0.88,
  },
];

/** Scroll thresholds (0–1) that decide which node is "active" while scrolling. */
export const NODE_THRESHOLDS = [0.26, 0.51, 0.76];

/** Total scroll travel of the section, expressed in viewport heights. */
export const TIMELINE_SCROLL_VH = 320;
