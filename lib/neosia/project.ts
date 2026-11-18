// Projection of a NEOSIA response onto its allowlist (lib/neosia/allowlist.ts).
// Runs inside the page-world script, so nothing but the kept fields ever
// leaves the page (project rule 15). Pure, no dependencies, never throws.
//
// Defense in depth, all tested in tests/neosia-project.test.ts:
// 1. Only keys the spec names are copied; everything else is dropped.
// 2. A dropped field name is skipped even if a spec named it.
// 3. A kept value that looks like an identifier (student number, national
//    ID, employee number), an email, a phone number or an amount of money is
//    dropped, in case a field moves or changes meaning.
// 4. Lists, strings and nesting are capped.

import { DROPPED_FIELDS, isSumSpec, MAX_DEPTH, MAX_ITEMS, MAX_STRING, UNWRAP_KEYS, type FieldSpec } from './allowlist';

export type Primitive = string | number | boolean | null;
export type Projected = Primitive | Projected[] | { [key: string]: Projected };

const DROPPED: ReadonlySet<string> = new Set(DROPPED_FIELDS);

/** Keys of a semester map ("20251", "1", "ganjil"): short, no spaces. */
const MAP_KEY = /^[0-9A-Za-z_-]{1,16}$/;

/** Values that are never kept, whatever field they sit in. */
const SENSITIVE_VALUE: readonly RegExp[] = [
  /\b[A-Za-z]\d{9}\b/, // Unhas student number (letter + 9 digits)
  /\d{15,}/, // national ID (16), employee number (18), account numbers
  /[^\s@]+@[^\s@]+\.[^\s@]+/, // email
  /(?:\+62|\b08)\d{7,}/, // phone
  /\brp\.?\s?\d/i, // money
];

/** Numbers this large are identifiers, never a grade or a count. */
const MAX_SAFE_VALUE = 1e12;

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function primitive(value: unknown): Primitive | undefined {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) < MAX_SAFE_VALUE ? value : undefined;
  if (typeof value === 'string') {
    if (value.length > MAX_STRING) return undefined;
    return SENSITIVE_VALUE.some((re) => re.test(value)) ? undefined : value;
  }
  return undefined;
}

const asNumber = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d{1,3}(?:[.,]\d+)?$/.test(v.trim())) return Number(v.trim().replace(',', '.'));
  return undefined;
};

/**
 * The sum of the numbers at a dotted path from `from` (lists walked), or
 * undefined when there are none. Only numbers below MAX_SAFE_VALUE count.
 */
export function sumAt(from: unknown, path: string): number | undefined {
  let level: unknown[] = [from];
  for (const segment of path.split('.')) {
    if (DROPPED.has(segment.toLowerCase())) return undefined;
    level = level
      .flatMap((v) => (Array.isArray(v) ? v.slice(0, MAX_ITEMS) : [v]))
      .filter(isPlainObject)
      .map((o) => o[segment])
      .flatMap((v) => (Array.isArray(v) ? v.slice(0, MAX_ITEMS) : [v]));
  }
  const numbers = level.map(asNumber).filter((n): n is number => n !== undefined && Math.abs(n) < MAX_SAFE_VALUE);
  return numbers.length ? Math.round(numbers.reduce((a, b) => a + b, 0) * 100) / 100 : undefined;
}

/** One value projected with its spec; undefined means "drop it". */
export function projectValue(spec: FieldSpec, value: unknown, depth = 0): Projected | undefined {
  if (depth > MAX_DEPTH) return undefined;
  if (spec === 'v') return primitive(value);
  if (isSumSpec(spec)) return asNumber(value);
  if (Array.isArray(spec)) {
    if (!Array.isArray(value)) return undefined;
    const item = spec[0] as FieldSpec;
    const out: Projected[] = [];
    for (const v of value.slice(0, MAX_ITEMS)) {
      const p = projectValue(item, v, depth + 1);
      if (p !== undefined) out.push(p);
    }
    return out;
  }
  const objectSpec = spec as { readonly [key: string]: FieldSpec };
  if (!isPlainObject(value)) {
    // A room given as text instead of an object, for example.
    return '$v' in objectSpec ? primitive(value) : undefined;
  }
  const out: { [key: string]: Projected } = {};
  const any = objectSpec['*'];
  for (const key of Object.keys(objectSpec)) {
    if (key === '*' || key === '$v' || DROPPED.has(key.toLowerCase())) continue;
    const child = objectSpec[key] as FieldSpec;
    if (isSumSpec(child)) {
      // Computed here, on the page; an already projected value (a plain number) stays as it is.
      const sum = sumAt(value, child.$sum) ?? asNumber(value[key]);
      if (sum !== undefined) out[key] = sum;
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const p = projectValue(child, value[key], depth + 1);
    if (p !== undefined) out[key] = p;
  }
  if (any) {
    for (const key of Object.keys(value).slice(0, MAX_ITEMS)) {
      if (!MAP_KEY.test(key) || DROPPED.has(key.toLowerCase()) || key in out) continue;
      const p = projectValue(any, value[key], depth + 1);
      if (p !== undefined) out[key] = p;
    }
  }
  return out;
}

/** True when the spec's own top-level shape is present in the candidate. */
function fits(spec: FieldSpec, candidate: unknown): boolean {
  if (Array.isArray(spec)) return Array.isArray(candidate);
  if (spec === 'v' || !isPlainObject(candidate)) return false;
  return Object.keys(spec).some((k) => k !== '*' && k !== '$v' && Object.prototype.hasOwnProperty.call(candidate, k));
}

export type ProjectionResult = { status: 'ok'; data: Projected } | { status: 'unknown_shape' };

/**
 * The payload may sit at the top or under a wrapper ("data", "result"), at
 * most two levels down. No known key anywhere: unknown_shape, with no data.
 */
export function projectResponse(spec: FieldSpec, json: unknown): ProjectionResult {
  try {
    let candidate: unknown = json;
    for (let level = 0; level <= 2; level++) {
      if (fits(spec, candidate)) {
        const data = projectValue(spec, candidate);
        return data === undefined ? { status: 'unknown_shape' } : { status: 'ok', data };
      }
      if (!isPlainObject(candidate)) break;
      const wrapper: string | undefined = UNWRAP_KEYS.find((k) => Object.prototype.hasOwnProperty.call(candidate, k));
      if (wrapper === undefined) break;
      candidate = (candidate as Record<string, unknown>)[wrapper];
    }
  } catch {
    // Getters that throw, proxies: nothing leaves.
  }
  return { status: 'unknown_shape' };
}
