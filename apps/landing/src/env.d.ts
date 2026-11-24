// Types for the plain .mjs the landing page shares with the repo's screenshot scripts.
declare module '*/mockup-data.mjs' {
  export function livelyTasks<T extends { courseId: number; name: string; dueAt: number | null }>(tasks: readonly T[], now: number): T[];
}

// Build-time settings read in the page code (src/data/mode.ts); Node's own types are not loaded here.
declare const process: { env: Record<string, string | undefined> };
