// Zod validation of capture messages, derived from the allowlist specs so
// there is one source of truth. Used twice: in the bridge (content script)
// and again in the service worker. Messages from the page are untrusted:
// any key the spec does not name, any dropped field, any value the
// projector would refuse, and anything too large fails.

import { z } from 'zod';
import { CAPTURE_SCHEMA_VERSION, CAPTURE_TYPE, ENDPOINTS, isSumSpec, MAX_ITEMS, MAX_MESSAGE_CHARS, MAX_STRING, type EndpointId, type FieldSpec } from './allowlist';
import { projectValue, type Projected } from './project';

const MAP_KEY = /^[0-9A-Za-z_-]{1,16}$/;

const primitiveSchema = z.union([z.string().max(MAX_STRING), z.number().finite(), z.boolean(), z.null()]);

/** The exact shape a projection with `spec` can have. */
export function specSchema(spec: FieldSpec): z.ZodType<Projected> {
  if (spec === 'v') return primitiveSchema;
  if (isSumSpec(spec)) return z.number().finite();
  if (Array.isArray(spec)) return z.array(z.lazy(() => specSchema(spec[0] as FieldSpec))).max(MAX_ITEMS);
  const objectSpec = spec as { readonly [key: string]: FieldSpec };
  const shape: Record<string, z.ZodType> = {};
  for (const key of Object.keys(objectSpec)) {
    if (key === '*' || key === '$v') continue;
    shape[key] = z.lazy(() => specSchema(objectSpec[key] as FieldSpec)).optional();
  }
  const any = objectSpec['*'];
  const object: z.ZodType = any
    ? z
        .object(shape)
        .catchall(z.lazy(() => specSchema(any)))
        .refine((o) => Object.keys(o).every((k) => k in shape || MAP_KEY.test(k)), 'map key')
    : z.strictObject(shape);
  return ('$v' in objectSpec ? z.union([primitiveSchema, object]) : object) as z.ZodType<Projected>;
}

/** JSON with sorted keys: the same data always gives the same text (hashing, diffs). */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const ENDPOINT_IDS = ENDPOINTS.map((e) => e.id) as [EndpointId, ...EndpointId[]];
const SPECS = new Map(ENDPOINTS.map((e) => [e.id, specSchema(e.spec)] as const));
const SPEC_OF = new Map(ENDPOINTS.map((e) => [e.id, e.spec] as const));

const base = {
  type: z.literal(CAPTURE_TYPE),
  v: z.literal(CAPTURE_SCHEMA_VERSION),
  endpoint: z.enum(ENDPOINT_IDS),
  at: z.number().int().positive(),
};

export const captureSchema = z
  .discriminatedUnion('status', [z.strictObject({ ...base, status: z.literal('ok'), data: z.unknown() }), z.strictObject({ ...base, status: z.literal('unknown_shape') })])
  .superRefine((message, ctx) => {
    if (message.status !== 'ok') return;
    const shape = SPECS.get(message.endpoint);
    if (!shape || !shape.safeParse(message.data).success) {
      ctx.addIssue({ code: 'custom', message: 'shape' });
      return;
    }
    // Projecting again must change nothing: no dropped field, no value the projector refuses.
    const again = projectValue(SPEC_OF.get(message.endpoint)!, message.data);
    if (stableStringify(again) !== stableStringify(message.data)) ctx.addIssue({ code: 'custom', message: 'projection' });
  });

export type Capture = z.infer<typeof captureSchema> & { data?: Projected };

/** Size first (cheap), then shape. null: rejected. */
export function parseCapture(raw: unknown): Capture | null {
  let size: number;
  try {
    size = JSON.stringify(raw)?.length ?? Infinity;
  } catch {
    return null;
  }
  if (size > MAX_MESSAGE_CHARS) return null;
  const parsed = captureSchema.safeParse(raw);
  return parsed.success ? (parsed.data as Capture) : null;
}
