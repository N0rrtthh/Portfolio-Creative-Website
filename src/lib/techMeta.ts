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

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#4361ee";
}