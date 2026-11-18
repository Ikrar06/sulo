import { z } from 'zod';
import type { KeyValueStore } from '../types';

// Development builds only: the NEOSIA observation listing (M7 part C). The
// page-world script posts the path and, for allowlisted paths, the key
// names of each NEOSIA API response (lib/neosia/observe.ts); the bridge
// forwards it; this keeps the newest per path. Starts with "neosia:", so
// turning the module off deletes it with the rest.

export const OBSERVED_KEY = 'neosia:dev:observed';
export const OBSERVED_MAX = 100;

export const observationSchema = z.strictObject({
  type: z.literal('sulo:observe:v1'),
  path: z.string().max(300),
  endpoint: z.string().max(60),
  keys: z.array(z.string().max(200)).max(400).nullable(),
  at: z.number().int().positive(),
});

export type StoredObservation = z.infer<typeof observationSchema> & { count: number };

/** Newest first, one row per path and endpoint; a repeat bumps its count and keeps the latest keys. */
export function addObservation(list: readonly StoredObservation[], o: z.infer<typeof observationSchema>): StoredObservation[] {
  const same = list.find((x) => x.path === o.path && x.endpoint === o.endpoint);
  const rest = list.filter((x) => x !== same);
  return [{ ...o, keys: o.keys ?? same?.keys ?? null, count: (same?.count ?? 0) + 1 }, ...rest].slice(0, OBSERVED_MAX);
}

export async function recordObservation(store: KeyValueStore, raw: unknown): Promise<boolean> {
  const parsed = observationSchema.safeParse(raw);
  if (!parsed.success) return false;
  const list = (await store.get<StoredObservation[]>(OBSERVED_KEY)) ?? [];
  await store.set(OBSERVED_KEY, addObservation(list, parsed.data));
  return true;
}

/** Markdown for docs/sumber/neosia-observasi.md: paths and key names, never values. */
export function observationsMarkdown(list: readonly StoredObservation[], allowlisted: readonly string[]): string {
  const at = (s: number) => new Date(s * 1000).toISOString().replace('.000Z', 'Z');
  const seen = new Set(list.filter((o) => o.endpoint !== 'other' && o.endpoint !== 'never').map((o) => o.endpoint));
  const lines = [
    '# Observasi NEOSIA (build dev)',
    '',
    `Disalin ${at(Math.floor(Date.now() / 1000))}. Hanya path dan nama key, tanpa nilai.`,
    '',
    '## Path di daftar putih',
    '',
    ...list
      .filter((o) => o.endpoint !== 'other' && o.endpoint !== 'never')
      .flatMap((o) => [`### ${o.endpoint}`, '', `- path: \`${o.path}\``, `- terlihat: ${o.count} kali, terakhir ${at(o.at)}`, '- key:', '', '```', ...(o.keys ?? ['(tidak ada)']), '```', '']),
    '## Daftar putih yang belum terlihat',
    '',
    ...(allowlisted.some((e) => !seen.has(e)) ? allowlisted.filter((e) => !seen.has(e)).map((e) => `- ${e}`) : ['(semua sudah terlihat)']),
    '',
    '## Path NEOSIA lain (isi tidak dibaca)',
    '',
    ...list.filter((o) => o.endpoint === 'other' || o.endpoint === 'never').map((o) => `- \`${o.path}\`${o.endpoint === 'never' ? ' (tidak pernah dibaca)' : ''}, ${o.count} kali`),
    '',
  ];
  return lines.join('\n');
}
