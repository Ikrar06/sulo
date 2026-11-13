import { z } from 'zod';

// Fields we use are required; unknown fields pass through (docs/ROADMAP.md, M1).

const exceptionSchema = z.looseObject({
  errorcode: z.string(),
  message: z.string().optional(),
});

export const batchItemSchema = z.union([
  z.looseObject({ error: z.literal(false), data: z.unknown() }),
  z.looseObject({ error: z.literal(true), exception: exceptionSchema }),
]);

export const batchResponseSchema = z.array(batchItemSchema);

/** Whole-request failure, e.g. an invalid sesskey rejected before any call runs. */
export const topLevelErrorSchema = z.looseObject({
  error: z.union([z.string(), z.literal(true)]),
  errorcode: z.string(),
});

export const sessionTimeRemainingSchema = z.looseObject({
  userid: z.number().int().positive(),
  timeremaining: z.number(),
});

export type SessionTimeRemaining = z.infer<typeof sessionTimeRemainingSchema>;
