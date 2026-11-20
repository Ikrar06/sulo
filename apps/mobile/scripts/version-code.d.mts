export function versionCode(version: string): number;
export function highestReleased(tags: readonly string[], except?: string | null): { tag: string; code: number } | null;
