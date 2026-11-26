// Zod schemas for what the passive reader sends from a Sipakamase page to the
// extension's service worker. The page side already projected the data
// (parse.ts); the worker trusts nothing from a page and checks every field
// again, with the same limits, before anything is stored.

import { z } from 'zod';
import { FRAGMENTS, type FragmentValue } from './store';

export const PASSIVE_MESSAGE_TYPE = 'sulo:sipakamase:v1';

const text = z.string().max(160);
const sks = z.number().min(0).max(40);

const activity = z.object({
  semester: z.string().max(40),
  basis: z.enum(['kompetisi', 'kewirausahaan', 'keorganisasian', 'kepesertaan', 'pengabdian', 'magang', 'minat', 'publikasi', 'kepesertaan_kompetisi', 'unknown']),
  kind: text,
  name: text.min(1),
  status: z.enum(['planned', 'done', 'finished', 'unknown']),
  statusText: text,
  hasCompanion: z.boolean().nullable(),
  hasScore: z.boolean(),
}).strict();

const collected = z.object({ name: text, sks, collected: sks }).strict();
const code = z.string().regex(/^[0-9A-Z]{4,16}$/);

const values = {
  running: z.array(activity).max(200),
  history: z.array(activity).max(400),
  courses: z.object({ passed: z.array(collected).max(60), notPassed: z.array(collected).max(60) }).strict(),
  claim: z.object({
    passed: z.array(z.object({ code: code.nullable(), name: text, sks, inNeosia: z.boolean().nullable() }).strict()).max(60),
    programmed: z.array(z.object({ code, kind: z.enum(['reguler', 'mkpk', 'unknown']) }).strict()).max(40),
  }).strict(),
  conversions: z.array(z.object({ name: text.min(1), sksTotal: sks, sksUnconverted: sks }).strict()).max(400),
} as const;

const passiveMessage = z.object({
  type: z.literal(PASSIVE_MESSAGE_TYPE),
  fragment: z.enum(FRAGMENTS as [string, ...string[]]),
  data: z.unknown(),
}).strict();

export type PassiveRead = { kind: 'value'; value: FragmentValue } | { kind: 'login' } | { kind: 'invalid' };

/** A message from the passive reader: one fragment's projected data, or that the page asks for a password. */
export function parsePassive(raw: unknown): PassiveRead {
  if (typeof raw === 'object' && raw !== null && (raw as { type?: unknown }).type === `${PASSIVE_MESSAGE_TYPE}:login`) return { kind: 'login' };
  const m = passiveMessage.safeParse(raw);
  if (!m.success) return { kind: 'invalid' };
  const fragment = m.data.fragment as keyof typeof values;
  const data = values[fragment].safeParse(m.data.data);
  return data.success ? { kind: 'value', value: { fragment, data: data.data } as FragmentValue } : { kind: 'invalid' };
}
