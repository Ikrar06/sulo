import { z } from 'zod';

// Messages for development builds only: the fixture recorder and the reminder
// simulator with a fake clock. Only lib/dev/background-dev.ts reads them, and
// that module is loaded only when import.meta.env.MODE === 'development', so
// production and tester builds contain neither the schema nor the handlers.
// scripts/check-no-dev-code.mjs fails the build if any of it leaks in.

export const devMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('dev/record') }),
  /** Runs one reminder cycle as if the time were `at` (unix seconds), with real notifications. */
  z.object({ type: z.literal('dev/notify/simulate'), at: z.number().int().positive() }),
  /** Forgets which reminders were sent, so a simulation can be repeated. */
  z.object({ type: z.literal('dev/notify/reset') }),
  /** Appends sample updates to the real change log, so the real engine notifies (M4). */
  z.object({ type: z.literal('dev/radar/inject'), kind: z.enum(['material', 'due', 'grade', 'forum', 'many']) }),
]);

export type DevMessage = z.infer<typeof devMessageSchema>;
