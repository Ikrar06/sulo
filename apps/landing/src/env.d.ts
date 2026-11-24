// Types for the plain .mjs the landing page shares with the repo's screenshot scripts.
declare module '*/mockup-data.mjs' {
  export function livelyTasks<T extends { courseId: number; name: string; dueAt: number | null }>(tasks: readonly T[], now: number): T[];
}
