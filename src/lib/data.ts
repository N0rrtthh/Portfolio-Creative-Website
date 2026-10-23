/* ══════════════════════════════════════════════════════════
   PORTFOLIO DATA — Source of truth for all content
   ══════════════════════════════════════════════════════════ */

export interface Project {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  problem: string;
  solution: string;
  outcome: string;
  technologies: string[];
  type: string;
  year: string;
  color: string;
  github?: string;
  live?: string;
  /* Screenshots deliberately live in src/data/projectImages.ts, keyed by `id`.
     A path string here would be emitted verbatim and 404 under the Pages
     basePath; a static import is resolved by the bundler instead. */
  featured: boolean;

}

export interface TechItem {
  name: string;
  category: string;
  icon: string;
  /** 0–100 proficiency — kept in the data for reference, no longer rendered. */
  level?: number;
  /** One-line note shown on the card back — how the tool is actually used. */
  note?: string;
}

export interface Experience {
  id: string;
  role: string;
  company: string;
  period: string;
  description: string;
  highlights: string[];
  type: "work" | "education" | "project";
}

export const PROJECTS: Project[] = [
  {
    id: "bidaboss-portal",
    title: "BidaBoss Portal",
    subtitle: "Franchise order management portal",
    description:
      "The BidaBoss Agent Portal — a centralized, web-based franchise order management system I built for BidaBoss Inc. during my internship.",
    problem:
      "Franchise agents and branches needed one place to sign in, place and manage their orders instead of scattered manual coordination.",
    solution:
      "Built a React front end and Node.js back end on MySQL, with agent sign-in and order management in one web portal.",
    outcome:
      "Shipped to production — the portal is live and in active use by BidaBoss Inc.",
    technologies: ["React", "Node.js", "MySQL"],
    type: "Web Application",
    year: "2025",
    color: "#3b82f6",
    featured: true,
  },
  {
    id: "bidaboss-mobile",
    title: "BidaBoss Mobile",
    subtitle: "E-commerce mobile app",
    description:
      "The BidaBoss e-commerce mobile application, built in Flutter during my internship at BidaBoss Inc.",
    problem:
      "Agents needed their sales, orders and stock on their phones, not only at a desk.",
    solution:
      "Built a Flutter app on a MySQL backend: an overall-sales overview, order statuses (to approve, to pick up, out for delivery), shop assessment, inventory, store and orders.",
    outcome:
      "Built and tested on Android (Pixel 9 Pro XL emulator) as part of the BidaBoss internship deliverables.",
    technologies: ["Flutter", "Dart", "MySQL"],
    type: "Mobile Application",
    year: "2025",
    color: "#06b6d4",
    featured: true,
  },
  {
    id: "waterwise",
    title: "WaterWise",
    subtitle: "Undergraduate thesis game",
    description:
      "An educational 2D Android game on water conservation and reuse, built in Godot for our undergraduate thesis at Cavite State University.",
    problem:
      "Adaptive difficulty and co-op play are hardest to deliver on the older, low-spec Android phones and unreliable internet many Filipino learners have.",
    solution:
      "A rule-based rolling-window adaptive difficulty algorithm (no trained model, no internet) plus an integer-only G-Counter CRDT that syncs the shared score over a phone's Wi-Fi hotspot.",
    outcome:
      "On a Motorola Moto E5 Plus it averaged 28.2–29.6 FPS with 0.59–0.66 ms difficulty updates; CRDT replicas converged in all 180 trials at up to 90% packet loss.",
    technologies: ["Godot", "GDScript", "Android", "CRDT"],
    type: "Game",
    year: "2026",
    color: "#8b5cf6",
    github: "https://github.com/N0rrtthh/WaterWise",
    featured: true,
  },
  {
    id: "resumaker",
    title: "ResuMaker",
    subtitle: "ATS-friendly resume builder",
    description:
      "A two-panel resume builder with a live preview, an ATS-inspired quality score, and PDF export powered by pdfjs-dist.",
    problem:
      "Most resume builders are either overpriced or ignore what actually gets candidates past applicant tracking systems.",
    solution:
      "Built a React + TypeScript app with structured controls for every resume section, a resume quality checklist, action-verb suggestions, and client-side PDF generation.",
    outcome:
      "A print-ready, ATS-friendly resume builder with local draft persistence, JSON import/export, and theme customization — live on GitHub Pages.",
    technologies: ["React", "TypeScript", "Vite", "pdfjs-dist"],
    type: "Web Application",
    year: "2026",
    color: "#f97316",
    github: "https://github.com/N0rrtthh/ResuMaker",
    live: "https://n0rrtthh.github.io/ResuMaker/",
    featured: true,

  },
  {
    id: "jasfocus",
    title: "JasFocus",
    subtitle: "iOS-style productivity timer",
    description:
      "A minimalist task timer with automatic progression, motivational nudges, and satisfying completion animations.",
    problem:
      "Most productivity timers require constant manual restarting and offer no positive reinforcement to keep users going.",
    solution:
      "Built a React + Framer Motion timer that auto-advances between tasks, tracks progress in a bento-grid layout, and celebrates completions with confetti — fully local, no backend required.",
    outcome:
      "A polished, glassmorphic timer app deployed on GitHub Pages, showcasing motion-driven micro-interactions end to end.",
    technologies: ["React", "Vite", "Tailwind CSS", "Framer Motion"],
    type: "Web Application",
    year: "2025",
    color: "#3b82f6",
    github: "https://github.com/N0rrtthh/JasFocus",
    live: "https://n0rrtthh.github.io/JasFocus/",
    featured: true,

  },
  {
    id: "wavelength",
    title: "WaveLength",
    subtitle: "Anonymous conversations",
    description:
      "A real-time anonymous chat platform that strips away identity and lets conversations happen purely through ideas.",
    problem:
      "Sometimes people need to communicate honestly without social pressure.",
    solution:
      "Built a lightweight real-time chat on Supabase Realtime channels, with ephemeral messages, no accounts, and a clean minimal interface.",
    outcome:
      "An exercise in designing for honesty and simplicity — deployed live on GitHub Pages.",
    technologies: ["JavaScript", "Supabase", "CSS", "HTML"],
    type: "Web Application",
    year: "2026",
    color: "#8b5cf6",
    github: "https://github.com/N0rrtthh/WaveLength",
    live: "https://n0rrtthh.github.io/WaveLength/",
    featured: false,
  },
  {
    id: "quick-attend",
    title: "Quick Attend",
    subtitle: "QR-powered attendance system",
    description:
      "A dual-platform attendance system using QR codes — a web app that generates the codes and manages attendance, paired with a mobile scanning app.",
    problem:
      "Manual attendance tracking is slow, error-prone, and creates bottlenecks.",
    solution:
      "Built the web and mobile apps in FlutterFlow (Dart): Google sign-in on the web, a QR code per session, and a mobile scanner that uses face recognition as a second factor.",
    outcome:
      "Two linked apps (web + mobile) for fast attendance taking, later rebuilt as a React Native version.",
    technologies: ["FlutterFlow", "Dart", "Firebase", "QR Scanning"],
    type: "Full Stack",
    year: "2024",
    color: "#06b6d4",
    github: "https://github.com/N0rrtthh/Quick-Attend-Mobile",
    featured: false,
  },
];

export interface PlaygroundItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  color: string;
  github?: string;
}

export const PLAYGROUND: PlaygroundItem[] = [
  {
    id: "shape-shift",
    title: "Shape Shift",
    description:
      "A puzzle concept where geometry itself is the mechanic — rotate, morph, and fit shapes to solve escalating spatial puzzles.",
    tags: ["Godot", "GDScript", "Concept"],
    color: "#3b82f6",
  },
  {
    id: "quest-adventure-land",
    title: "Quest Adventure Land",
    description:
      "A 2D adventure concept exploring tile-based world design, character progression, and quest systems in Godot.",
    tags: ["Godot", "GDScript", "Concept"],
    color: "#8b5cf6",
  },
  {
    id: "wavelength-playground",
    title: "WaveLength",
    description:
      "Real-time anonymous chat experiment — ephemeral rooms, no accounts, just conversation.",
    tags: ["Supabase", "JavaScript"],
    color: "#06b6d4",
    github: "https://github.com/N0rrtthh/WaveLength",
  },
  {
    id: "neon-smash-playground",
    title: "Neon Smash",
    description:
      "Fast-reflex arcade game with particle-driven feedback and escalating difficulty curves.",
    tags: ["Python", "Pygame"],
    color: "#f97316",
    github: "https://github.com/N0rrtthh/Neon-Smash",
  },
];

export const TECH_STACK: TechItem[] = [
  // Frontend
  { name: "React", category: "Frontend", icon: "⚛", level: 92, note: "Daily driver for SPAs, dashboards & component systems" },
  { name: "Next.js", category: "Frontend", icon: "▲", level: 88, note: "SSR, app router & this very portfolio" },
  { name: "TypeScript", category: "Frontend", icon: "TS", level: 90, note: "Strict mode everywhere — types are documentation" },
  { name: "Tailwind CSS", category: "Frontend", icon: "🎨", level: 93, note: "Design-token-first styling across every project" },
  { name: "Framer Motion", category: "Frontend", icon: "✦", level: 85, note: "Scroll choreography, springs & micro-interactions" },
  { name: "React Native", category: "Frontend", icon: "📱", level: 72, note: "Cross-platform UI experiments & prototypes" },
  // Backend
  { name: "Node.js", category: "Backend", icon: "⬢", level: 86, note: "REST APIs, scripts & real-time services" },
  { name: "Firebase", category: "Backend", icon: "🔥", level: 84, note: "Auth & Firestore for app prototypes like Quick Attend" },
  { name: "Supabase", category: "Backend", icon: "⚡", level: 78, note: "Postgres + realtime channels for side projects" },
  { name: "MongoDB", category: "Backend", icon: "🍃", level: 74, note: "Document models & aggregation pipelines" },
  { name: "MySQL", category: "Backend", icon: "🐬", level: 76, note: "Backend for the BidaBoss portal & mobile app" },
  // Mobile
  { name: "Flutter", category: "Mobile", icon: "💎", level: 82, note: "Built the BidaBoss e-commerce mobile app" },
  { name: "Dart", category: "Mobile", icon: "🎯", level: 80, note: "State management, isolates & platform channels" },
  // Creative
  { name: "Godot", category: "Creative", icon: "🎮", level: 87, note: "WaterWise thesis game — adaptive difficulty & offline co-op" },
  { name: "Blender", category: "Creative", icon: "🧊", level: 68, note: "3D modeling & assets for web and games" },
  { name: "Figma", category: "Creative", icon: "🖼", level: 88, note: "Design systems, prototypes & handoff" },
  { name: "After Effects", category: "Creative", icon: "🎬", level: 65, note: "Motion graphics & UI animation studies" },
  // Tools
  { name: "Git", category: "Tools", icon: "⎇", level: 90, note: "Branching, rebasing & CI-friendly history" },
  { name: "VS Code", category: "Tools", icon: "📝", level: 95, note: "Home base — tasks, snippets & extensions" },
  { name: "Vercel", category: "Tools", icon: "▲", level: 83, note: "Deployments, previews & edge config" },
];

/* EVA "service record". Mirrors data/experience.ts (classic timeline) —
   same facts, flatter shape. */
export const EXPERIENCES: Experience[] = [
  {
    id: "csso",
    role: "VP for Public Relations & Information",
    company: "Computer Science Student Organization",
    period: "2022 — 2024",
    description: "Officer of the Computer Science Student Organization at CvSU – Indang.",
    highlights: [
      "VP for Public Relations and Information (2023 – 2024)",
      "Encrypt Member (2022 – 2023)",
    ],
    type: "education",
  },
  {
    id: "communities",
    role: "Member · Tech Communities",
    company: "AWS Learning Club · JPCS",
    period: "2023 — 2025",
    description: "Campus developer communities at Cavite State University – Indang.",
    highlights: [
      "Spade Member, Amazon Web Services Learning Club (2024 – 2025)",
      "Member, JPCS – CvSU Chapter (2023 – 2024)",
    ],
    type: "education",
  },
  {
    id: "bidaboss",
    role: "Software Engineer & Application Developer Intern",
    company: "BidaBoss Inc.",
    period: "Jul 2025 — Dec 2025",
    description:
      "On-the-job training in Pasig City. Built the BidaBoss Agent Portal, a franchise order management system that is live and in use by the company, and the BidaBoss e-commerce mobile app.",
    highlights: [
      "Developed the BidaBoss Agent Portal with React and Node.js on MySQL",
      "Shipped the portal to production — in active use by BidaBoss Inc.",
      "Built the BidaBoss e-commerce mobile app in Flutter with MySQL",
    ],
    type: "work",
  },
  {
    id: "waterwise",
    role: "Thesis Developer & Co-Proponent",
    company: "WaterWise · Cavite State University",
    period: "2025 — 2026",
    description:
      "Three-person undergraduate thesis: a Godot educational game on water conservation for low-spec Android phones, with rule-based adaptive difficulty and CRDT-synced offline multiplayer.",
    highlights: [
      "Weighted Proficiency Index over a five-game window — no trained model, no internet",
      "Integer-only G-Counter CRDT score sync over a Wi-Fi hotspot",
      "28.2–29.6 FPS average on a Motorola Moto E5 Plus",
    ],
    type: "education",
  },
];

/**
 * PLACEHOLDER — edit these to describe the actual services you offer
 * (or delete the Services section + nav item entirely if you'd rather not
 * offer freelance/contract work). `icon` keys map to lucide-react icons in
 * Services.tsx.
 */
export const SERVICES = [
  {
    icon: "globe",
    title: "Web Development",
    description:
      "Full-stack web apps — React/Next.js frontends, Node.js APIs, and everything needed to ship a production-ready product.",
  },
  {
    icon: "smartphone",
    title: "Mobile Development",
    description:
      "Cross-platform mobile apps built with Flutter, from prototype to app-store-ready release.",
  },
  {
    icon: "gamepad",
    title: "Game Development",
    description:
      "2D/3D game prototypes and mechanics built in Godot — from game jam concepts to polished playable builds.",
  },
  {
    icon: "layers",
    title: "Product & Motion Design",
    description:
      "UI/UX design in Figma and interface motion design — turning a rough idea into a interface that feels alive.",
  },
];

export const NAV_ITEMS = [
  { label: "Home", href: "#hero" },
  { label: "About", href: "#about" },
  { label: "Work", href: "#projects" },
  { label: "Experience", href: "#experience" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "#contact" },
];

/** The resume PDF lives in /public. It is prefixed with the deploy
 * basePath (NEXT_PUBLIC_BASE_PATH at build time, e.g. GitHub Pages)
 * so the link works on every host. */
export const RESUME_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/ELRONI_QUIÑONES_Resume.pdf`;

export const CONTACT_EMAIL = "quinoneselroni@gmail.com";

export const SOCIAL_LINKS = [
  {
    label: "GitHub",
    href: "https://github.com/N0rrtthh",
    icon: "github",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/elroni-quinones",
    icon: "linkedin",
  },
  {
    label: "X / Twitter",
    href: "https://twitter.com/skyl1nker390",
    icon: "twitter",
  },
];
