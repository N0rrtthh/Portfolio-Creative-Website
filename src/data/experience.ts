import { ShieldCheck, Award, Code2, Gamepad2 } from "lucide-react";
import type { TimelineEntry } from "@/types/experience";

/* ══════════════════════════════════════════════════════════
   EXPERIENCE TIMELINE — content source of truth for the
   "My Experience" cinematic flight-path section.
   ══════════════════════════════════════════════════════════ */

export const TIMELINE_DATA: TimelineEntry[] = [
  {
    id: "exp-1",
    number: "01",
    role: "Software Engineer Intern",
    company: "BidaBoss Inc.",
    period: "2025 – Present",
    location: "Manila, Philippines",
    description:
      "Engineered production-grade operations web portal and companion mobile app serving live internal teams with real-time synchronization.",
    highlights: [
      "Engineered React & Node.js internal portal with sub-second response times",
      "Built cross-platform Flutter companion mobile app for field operations",
      "Integrated real-time Firebase & WebSockets live telemetry synchronization",
      "Streamlined internal data workflows, cutting operational manual steps by 40%",
    ],
    tech: ["React", "Node.js", "Flutter", "Firebase", "TypeScript", "Tailwind CSS"],
    icon: ShieldCheck,
    details: {
      architecture:
        "Micro-frontend web client + Flutter mobile app connected to Express REST API & Firebase RTDB.",
      impact:
        "Serving daily active operational teams with 99.9% uptime real-time status reporting.",
    },
    scrollTarget: 0.14,
  },
  {
    id: "exp-2",
    number: "02",
    role: "Undergraduate Capstone Lead",
    company: "WaterWise Thesis Project",
    period: "2024 – 2025",
    location: "Calapan, Philippines",
    description:
      "Award-winning 2D/3D Godot game engine thesis project featuring custom shader pipeline, fluid dynamics, and environmental networking.",
    highlights: [
      "Awarded top honors & 1st Place for Undergraduate Capstone Excellence",
      "Designed custom HLSL/GDShader fluid physics and environmental shader graph",
      "Built low-latency multiplayer networking mechanics for interactive simulation",
      "Optimized 3D asset pipeline in Blender to maintain 60 FPS on low-tier hardware",
    ],
    tech: ["Godot 4", "GDShader", "HLSL", "C#", "Blender 3D", "Multiplayer Netcode"],
    icon: Award,
    details: {
      architecture:
        "Godot Engine 4.x custom GDExtension pipeline with custom vertex/fragment shaders.",
      impact:
        "Honored with Best Technical Capstone Project for eco-simulation gameplay.",
    },
    scrollTarget: 0.38,
  },
  {
    id: "exp-3",
    number: "03",
    role: "Open Source Maintainer",
    company: "GitHub Community",
    period: "2024 – Present",
    location: "Global / Remote",
    description:
      "Published and maintained developer productivity tools including ResuMaker ATS resume builder and JasFocus Pomodoro applications.",
    highlights: [
      "Published ResuMaker markdown resume tool with real-time PDF generation",
      "Created JasFocus minimal Pomodoro timer with custom audio ambient engines",
      "Maintained zero-dependency dev utility libraries downloaded by developer peers",
      "Fostered open-source documentation, automated CI/CD builds, and release packaging",
    ],
    tech: ["Next.js", "Tailwind CSS", "Framer Motion", "TypeScript", "Markdown AST"],
    icon: Code2,
    details: {
      architecture:
        "Client-side Next.js App Router with offline LocalStorage & Web Workers.",
      impact: "100+ GitHub stars across developer tools with active community forks.",
    },
    scrollTarget: 0.64,
  },
  {
    id: "exp-4",
    number: "04",
    role: "Creative Technologist",
    company: "Godot 3D & WebGPU R&D",
    period: "2025 – Future",
    location: "R&D Lab",
    description:
      "Exploring cutting-edge WebGL/WebGPU shaders, procedural mesh generation, real-time lighting physics, and Godot 4 architecture.",
    highlights: [
      "Real-time volumetric lighting physics & custom post-processing Bloom pipelines",
      "Procedural terrain generation using Perlin Noise & GPU compute shaders",
      "Cross-platform WebGPU rendering experiments targeting next-gen browsers",
      "Hybrid R3F (React Three Fiber) + Anime.js micro-interaction frameworks",
    ],
    tech: ["Three.js", "WebGPU", "GLSL", "Godot Engine", "Anime.js", "WebGL"],
    icon: Gamepad2,
    details: {
      architecture:
        "Experimental WebGPU compute shader pipeline + R3F postprocessing canvas.",
      impact:
        "Pioneering immersive 3D web experiences and next-gen browser graphics.",
    },
    scrollTarget: 0.88,
  },
];

/** Scroll thresholds (0–1) that decide which node is "active" while scrolling. */
export const NODE_THRESHOLDS = [0.26, 0.51, 0.76];

/** Total scroll travel of the section, expressed in viewport heights. */
export const TIMELINE_SCROLL_VH = 320;
