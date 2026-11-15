import { z } from 'zod';
import type { AllowedFunction } from './calls';
import type { CallResult } from './client';

// Fields Sulo uses are required; every other field passes through.
// Field presence was verified on an account with active courses; exact value types are
// confirmed or corrected once recorded fixtures exist.

// ---------- Transport ----------

const exceptionSchema = z.looseObject({ errorcode: z.string(), message: z.string().optional() });

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

// ---------- Per function ----------

const id = z.number().int();
const unix = z.number().int().nonnegative();
/** Course state exports some ids as numeric strings (database values). */
const idLike = z.union([id, z.string().regex(/^\d+$/).transform(Number)]);

export const sessionTimeRemainingSchema = z.looseObject({
  userid: id.positive(),
  timeremaining: z.number(),
});

// Field presence confirmed on an account with active courses (verify-console,
// UI in English). Only fields Sulo uses are required; inner shapes of
// `course` and `action` wait for recorded fixtures. Translated UI text
// (formattedtime, activitystr, normalisedeventtypetext, action.name) is
// never used for logic; kind comes from codes, time from timestamps.

const calendarEventSchema = z.looseObject({
  id,
  name: z.string(),
  modulename: z.string().nullable(),
  instance: id.nullable(),
  timesort: unix,
  overdue: z.boolean(),
  course: z.looseObject({ id }),
  action: z.looseObject({}).nullable(),
  url: z.string(),
});

export const calendarActionEventsSchema = z.looseObject({
  events: z.array(calendarEventSchema),
  firstid: z.number().nullable().optional(),
  lastid: z.number().nullable().optional(),
});

const stateCmSchema = z.looseObject({
  id: idLike,
  name: z.string(),
  // modname is the translated module name ("Assignment" or "Tugas"): display only.
  modname: z.string(),
  // module is the code ("assign"): use this for logic.
  module: z.string(),
  visible: z.boolean(),
  uservisible: z.boolean(),
  sectionid: idLike,
  // Present for activities with a view page; labels may have none.
  url: z.string().optional(),
});

const stateSectionSchema = z
  .looseObject({
    id: idLike,
    number: z.number().int(),
    title: z.string().optional(),
    rawtitle: z.string().optional(),
    cmlist: z.array(idLike),
    visible: z.boolean(),
    current: z.boolean(),
  })
  .refine((s) => s.title !== undefined || s.rawtitle !== undefined, { message: 'title or rawtitle required', path: ['title'] });

const courseformatStateObject = z.looseObject({
  course: z.looseObject({ id: idLike }),
  section: z.array(stateSectionSchema),
  cm: z.array(stateCmSchema),
});

/** The function returns the state as a JSON string that must be parsed again. */
export const courseformatStateSchema = z
  .string()
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: 'custom', message: 'state is not valid JSON' });
      return z.NEVER;
    }
  })
  .pipe(courseformatStateObject);

/**
 * Sulo keeps only id, subject, component, eventtype, timecreated and read
 * from notifications. Message bodies (text, fullmessage*, smallmessage,
 * contexturl, customdata) may hold grades or lecturer comments and are
 * never stored.
 */
export const popupNotificationsSchema = z.looseObject({
  notifications: z.array(
    z.looseObject({
      id,
      subject: z.string(),
      component: z.string(),
      eventtype: z.string(),
      timecreated: unix,
      read: z.boolean(),
    }),
  ),
  unreadcount: z.number().int().nonnegative(),
});

export const enrolledCoursesSchema = z.looseObject({
  courses: z.array(
    z.looseObject({
      id,
      fullname: z.string(),
      shortname: z.string(),
      startdate: unix,
      enddate: unix,
      isfavourite: z.boolean(),
      hidden: z.boolean(),
      viewurl: z.string(),
    }),
  ),
  nextoffset: z.number().int(),
});

export const FUNCTION_SCHEMAS = {
  core_session_time_remaining: sessionTimeRemainingSchema,
  core_calendar_get_action_events_by_timesort: calendarActionEventsSchema,
  core_courseformat_get_state: courseformatStateSchema,
  message_popup_get_popup_notifications: popupNotificationsSchema,
  core_course_get_enrolled_courses_by_timeline_classification: enrolledCoursesSchema,
} satisfies Record<AllowedFunction, z.ZodType>;

export type FunctionData<F extends AllowedFunction> = z.output<(typeof FUNCTION_SCHEMAS)[F]>;

export type ParseOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; status: 'PARSER_BROKEN'; where: AllowedFunction; issues: string[] }
  | { ok: false; status: 'CALL_ERROR'; where: AllowedFunction; errorcode: string };

/**
 * Validates one batch result. A validation failure is PARSER_BROKEN, never
 * empty data. Issues carry field paths and codes only, never values.
 */
export function parseCall<F extends AllowedFunction>(fn: F, result: CallResult): ParseOutcome<FunctionData<F>> {
  if (!result.ok) return { ok: false, status: 'CALL_ERROR', where: fn, errorcode: result.errorcode };
  const parsed = FUNCTION_SCHEMAS[fn].safeParse(result.data);
  if (parsed.success) return { ok: true, data: parsed.data as FunctionData<F> };
  return { ok: false, status: 'PARSER_BROKEN', where: fn, issues: describeIssues(parsed.error) };
}

export function describeIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.code}`);
}
