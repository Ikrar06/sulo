// The on/off switches of the public config, in one list for the app (Zod
// refine in remote-config.ts) and the phone's worker (Kotlin WatchRemote,
// through watch/vectors.json). A switch that is there but not a boolean, or
// a section on its path that is not an object, makes the whole file invalid:
// a broken switch is never read as permission. Missing is fine (its default).

export const CONFIG_SWITCHES: readonly (readonly [string, string, string])[] = [
  ['mobile', 'backgroundKeepAlive', 'enabled'],
  ['extension', 'backgroundWatch', 'enabled'],
  ['sources', 'sipakamase', 'enabled'],
  ['sources', 'sipakamase', 'keep'],
  ['sources', 'neosia', 'scheduledVisit'],
];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Every switch path, where present, is readable. */
export function switchesReadable(root: Record<string, unknown>): boolean {
  return CONFIG_SWITCHES.every(([section, group, name]) => {
    if (!(section in root) || root[section] === undefined) return true;
    const s = root[section];
    if (!isObject(s)) return false;
    if (!(group in s) || s[group] === undefined) return true;
    const g = s[group];
    if (!isObject(g)) return false;
    return !(name in g) || g[name] === undefined || typeof g[name] === 'boolean';
  });
}
