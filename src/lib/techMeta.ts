/* ══════════════════════════════════════════════════════════
   Shared tech-stack metadata used by the conveyor grid
   (TechFlipGrid). Kept in one place so the grid stays in sync.
   ══════════════════════════════════════════════════════════ */

export const CATEGORY_COLORS: Record<string, string> = {
  Frontend: "#4361ee",
  Backend: "#10b981",
  Mobile: "#06b6d4",
  Creative: "#8b5cf6",
  Tools: "#f59e0b",
};

export const ENDORSEMENTS: Record<string, string[]> = {
  React: ["JavaScript Essentials 1", "JavaScript Essentials 2"],
  "Next.js": ["JavaScript Essentials 2", "HTML Essentials"],
  TypeScript: ["JavaScript Essentials 1", "JavaScript Essentials 2"],
  "Tailwind CSS": ["CSS Essentials", "HTML Essentials"],
  "Framer Motion": ["JavaScript Essentials 2"],
  "React Native": ["JavaScript Essentials 1", "JavaScript Essentials 2"],
  "Node.js": ["JavaScript Essentials 2"],
  Firebase: ["JavaScript Essentials 2", "Introduction to Cybersecurity"],
  Supabase: ["JavaScript Essentials 2", "Introduction to Cybersecurity"],
  MongoDB: ["Data Analytics Essentials"],
  MySQL: ["Data Analytics Essentials", "Data Science Essentials with Python"],
  Flutter: ["Module 4 - Object Oriented Programming"],
  Dart: ["Module 4 - Object Oriented Programming", "C++ Essentials 1"],
  Godot: ["C++ Essentials 1", "C++ Essentials 2", "C++ Advanced"],
  Blender: [],
  Figma: [],
  "After Effects": [],
  Git: ["Introduction to Cybersecurity"],
  "VS Code": [],
  Vercel: [],
};

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#4361ee";
}