// Development builds only (docs/NEOSIA.md, M7 part C): a listing of what
// the NEOSIA app requests, for the owner to check the allowlist against.
// - allowlisted paths: the path and the structure of the response (key
//   names, never values)
// - every other NEOSIA API path: the path only; the response is not parsed
// Paths are scrubbed (lib/neosia/match.ts). entrypoints/neosia-main.ts
// imports this behind MODE === 'development', so no other build has it
// (scripts/check-no-dev-code.mjs looks for OBSERVE_TYPE).

import type { UrlMatch } from './match';

export const OBSERVE_TYPE = 'sulo:observe:v1';

export interface Observation {
  type: typeof OBSERVE_TYPE;
  path: string;
  /** The allowlist entry, or "never" / "other". */
  endpoint: string;
  /** Dotted key paths ("a.b[].c"); only for allowlisted paths. */
  keys: string[] | null;
  /** The NEOSIA page open at the time (location.pathname, scrubbed, no query). */
  page: string;
  at: number;
}

const MAX_KEYS = 400;
const MAX_KEY_DEPTH = 6;
/** Keys that are themselves data (semester codes, ids, numbers): written as {n}. */
const DATA_KEY = /^(?:\d+|[A-Za-z]\d{6,}|[0-9a-f-]{16,})$/i;

/** Key structure of a JSON value: names only, never values. */
export function keyShape(value: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown, prefix: string, depth: number) => {
    if (out.size >= MAX_KEYS || depth > MAX_KEY_DEPTH) return;
    if (Array.isArray(v)) {
      for (const item of v.slice(0, 3)) walk(item, `${prefix}[]`, depth + 1);
      return;
    }
    if (typeof v !== 'object' || v === null) return;
    for (const key of Object.keys(v)) {
      const name = DATA_KEY.test(key) ? '{n}' : key.slice(0, 60);
      const path = prefix ? `${prefix}.${name}` : name;
      out.add(path);
      walk((v as Record<string, unknown>)[key], path, depth + 1);
    }
  };
  walk(value, '', 0);
  return [...out].slice(0, MAX_KEYS);
}

export function observation(match: UrlMatch, json: unknown, at: number, page = '/'): Observation {
  const listed = match.kind === 'endpoint' || match.kind === 'observe';
  return {
    type: OBSERVE_TYPE,
    path: match.path,
    endpoint: match.kind === 'endpoint' ? match.endpoint.id : match.kind === 'observe' ? `${match.id} (observasi)` : match.kind,
    keys: listed && json !== undefined ? keyShape(json) : null,
    page,
    at,
  };
}
