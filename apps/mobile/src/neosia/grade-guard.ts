// What keeps grades out of the screens that do not show them (M8d B2/B3):
// the endpoints that carry grades are read only by Nilai and the Studi card
// while they show, and Beranda's data loses its GPA fields in the copy
// every other screen sees. Pure.

import type { EndpointId } from '@sulo/core/neosia/allowlist';

/** The responses that carry grades or the GPA: read only while Nilai or the Studi card shows. */
export const GRADE_ENDPOINTS: ReadonlySet<EndpointId> = new Set(['getTranskripMahasiswa', 'kartu_hasil_studi/semester', 'indeks_prestasi/current']);

// The GPA values themselves; objects around them (indeks_prestasi, which also
// carries the passed credits) are kept and searched.
const GRADE_FIELD = /^(ipk|ips|ip|indeks_prestasi_(semester|kumulatif))$/i;

/** A copy without any GPA value, at any depth. */
export function withoutGrades(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutGrades);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([k]) => !GRADE_FIELD.test(k))
      .map(([k, v]) => [k, withoutGrades(v)]),
  );
}

export const SKS_MIN = 100;
export const SKS_MAX = 200;

/** The typed credits target, or null when it is not a whole number from 100 to 200. */
export function parseSksTarget(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const v = Number(t);
  return v >= SKS_MIN && v <= SKS_MAX ? v : null;
}
