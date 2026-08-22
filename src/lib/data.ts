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
  /** 0–100 proficiency shown as an animated bar on the card back. */
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
    subtitle: "Enterprise operations platform",
    description:
      "A full-stack web portal built for BidaBoss Inc. to streamline internal operations, manage workflows, and provide real-time analytics for decision-making.",
    problem:
      "BidaBoss needed a centralized system to manage growing operational complexity across teams.",
    solution:
      "Built a production React + Node.js portal with real-time data syncing, role-based access control, and an intuitive dashboard interface.",
    outcome:
      "Deployed to production, serving the entire operations team with measurable efficiency improvements.",
    technologies: ["React", "Node.js", "Firebase", "TypeScript"],
    type: "Web Application",
    year: "2025",
    color: "#3b82f6",
    featured: true,
  },
  {
    id: "bidaboss-mobile",
    title: "BidaBoss Mobile",
    subtitle: "Mobile-first business companion",
    description:
      "The mobile extension of the BidaBoss ecosystem — giving team members access to critical business functions on the go.",
    problem:
      "Field teams needed mobile access to the BidaBoss system without sacrificing functionality.",
    solution:
      "Developed a cross-platform Flutter application with offline-first architecture and push notifications.",
    outcome:
      "Enabled real-time field operations with seamless sync to the web portal.",
    technologies: ["Flutter", "Dart", "Firebase", "REST APIs"],
    type: "Mobile Application",
    year: "2025",
    color: "#06b6d4",
    featured: true,
  },
  {
    id: "waterwise",
    title: "WaterWise",
    subtitle: "Thesis capstone eco-adventure",
    description:
      "A full-length narrative game built in Godot for an undergraduate thesis — story-driven cutscenes, minigames, and multiplayer mechanics built around teaching water conservation.",
    problem:
      "Environmental education tools rarely combine a compelling narrative with mechanics that reinforce the lesson.",
    solution:
      "Built a complete Godot project spanning cutscenes, character dialogue, minigames, multiplayer, localization, and mobile support — backed by algorithm and thesis-alignment documentation.",
    outcome:
      "Delivered as an academic thesis project demonstrating end-to-end game production: narrative design, systems, multiplayer networking, and cross-platform testing.",
    technologies: ["Godot", "GDScript", "GDShader", "Game Design"],
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
      "A dual-platform attendance system using QR codes — a web admin dashboard paired with a mobile scanning app.",
    problem:
      "Manual attendance tracking is slow, error-prone, and creates bottlenecks.",
    solution:
      "Built companion mobile and web apps in Flutter with QR scanning and a real-time attendance dashboard backed by Firebase.",
    outcome:
      "Two linked Flutter apps (mobile + web) for rapid attendance tracking with real-time sync.",
    technologies: ["Flutter", "Dart", "Firebase", "QR Scanning"],
    type: "Full Stack",
    year: "2025",
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
  { name: "Firebase", category: "Backend", icon: "🔥", level: 84, note: "Auth, Firestore & realtime sync in production" },
  { name: "Supabase", category: "Backend", icon: "⚡", level: 78, note: "Postgres + realtime channels for side projects" },
  { name: "MongoDB", category: "Backend", icon: "🍃", level: 74, note: "Document models & aggregation pipelines" },
  { name: "MySQL", category: "Backend", icon: "🐬", level: 76, note: "Relational schemas for coursework & tools" },
  // Mobile
  { name: "Flutter", category: "Mobile", icon: "💎", level: 82, note: "Shipped BidaBoss Mobile & Quick Attend" },
  { name: "Dart", category: "Mobile", icon: "🎯", level: 80, note: "State management, isolates & platform channels" },
  // Creative
  { name: "Godot", category: "Creative", icon: "🎮", level: 87, note: "WaterWise thesis game — systems, shaders, multiplayer" },
  { name: "Blender", category: "Creative", icon: "🧊", level: 68, note: "3D modeling & assets for web and games" },
  { name: "Figma", category: "Creative", icon: "🖼", level: 88, note: "Design systems, prototypes & handoff" },
  { name: "After Effects", category: "Creative", icon: "🎬", level: 65, note: "Motion graphics & UI animation studies" },
  // Tools
  { name: "Git", category: "Tools", icon: "⎇", level: 90, note: "Branching, rebasing & CI-friendly history" },
  { name: "VS Code", category: "Tools", icon: "📝", level: 95, note: "Home base — tasks, snippets & extensions" },
  { name: "Vercel", category: "Tools", icon: "▲", level: 83, note: "Deployments, previews & edge config" },
];

export const EXPERIENCES: Experience[] = [
  {
    id: "bidaboss",
    role: "Software Engineer Intern",
    company: "BidaBoss Inc.",
    period: "2025",
    description:
      "Built production-grade web and mobile applications using React, Node.js, and Flutter. Contributed to full-stack systems serving real users.",
    highlights: [
      "Developed the BidaBoss Portal — a React + Node.js operations platform",
      "Built the companion Flutter mobile application",
      "Implemented real-time data synchronization with Firebase",
      "Collaborated with the team on UI/UX design decisions",
    ],
    type: "work",
  },
  {
    id: "creative-dev",
    role: "Creative Developer",
    company: "Independent",
    period: "2023 — Present",
    description:
      "Self-directed exploration of game development, motion graphics, and interactive web experiences.",
    highlights: [
      "Built and shipped WaterWise, a full Godot thesis capstone game",
      "Prototyping Shape Shift and Quest Adventure Land, two Godot concepts",
      "Created interactive web experiments and animations",
      "Designed UI/UX systems in Figma",
      "Explored 3D modeling in Blender",
    ],
    type: "project",
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

/** PLACEHOLDER — add your real resume PDF at /public/resume.pdf (this
 * exact path) to make the "Resume" nav link work. */
export const RESUME_URL = "/ELRONI_QUIÑONES_Resume.pdf";

export const CONTACT_EMAIL = "quinoneselroni@gmail.com";

export const SOCIAL_LINKS = [
  {
    label: "GitHub",
    href: "https://github.com/N0rrtthh",
    icon: "github",
  },
  {
    label: "X / Twitter",
    href: "https://twitter.com/skyl1nker390",
    icon: "twitter",
  },
];
