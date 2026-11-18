// What the onboarding reads and writes (M8c.2): where the flow is (kept
// between launches), the courses to offer and how the choice is saved, the
// sample reminder from the user's nearest task, the reminder stages, and the
// done screen's line. Everything stays on the phone.

import { isCourseActive } from '@sulo/core/courses/active-score';
import { assignCourseColors } from '@sulo/core/courses/colors';
import { courseAlias } from '@sulo/core/courses/display-name';
import { setActivePin } from '@sulo/core/courses/edit';
import { buildTaskItems } from '@sulo/core/dashboard/tasks';
import { taskDueLines } from '@sulo/core/format/time';
import type { Messages } from '@sulo/core/i18n';
import type { OnboardingWords } from '@sulo/core/i18n/mobile-onboarding';
import type { SavedFlow } from '@sulo/core/onboarding/mobile-flow';
import type { Platform } from '@sulo/core/platform';
import { readPrefs, writePrefs } from '@sulo/core/prefs';
import type { StageMin } from '@sulo/core/reminders/settings';
import { currentUser, readUser, writeUser } from '@sulo/core/storage';
import type { CourseChoice, ReminderSample } from './screens-setup';

export const ONBOARDING_KEY = 'mobile:onboarding';

export async function readSavedFlow(platform: Platform): Promise<SavedFlow | null> {
  return (await platform.store.get<SavedFlow>(ONBOARDING_KEY)) ?? null;
}

export async function saveFlow(platform: Platform, flow: SavedFlow): Promise<void> {
  await platform.store.set(ONBOARDING_KEY, flow);
}

/** The courses to offer, the followed ones ticked; in-progress or followed first. */
export async function readCourseChoices(platform: Platform): Promise<{ courses: CourseChoice[]; selected: Set<number> }> {
  const userId = await currentUser(platform.store);
  if (userId === null) return { courses: [], selected: new Set() };
  const list = await readUser(platform.store, userId, 'courses');
  const colors = assignCourseColors(list);
  const courses = list
    .map((c) => ({ id: c.id, name: courseAlias(c), color: colors.get(c.id) ?? null, main: c.inProgress || isCourseActive(c) }))
    .sort((a, b) => Number(b.main) - Number(a.main) || a.name.localeCompare(b.name));
  return { courses, selected: new Set(list.filter(isCourseActive).map((c) => c.id)) };
}

/** Pins only what the user changed, so the automatic choice keeps working for the rest. */
export async function saveCourseChoices(platform: Platform, selected: ReadonlySet<number>): Promise<void> {
  const userId = await currentUser(platform.store);
  if (userId === null) return;
  const list = await readUser(platform.store, userId, 'courses');
  const next = list.reduce((acc, c) => (isCourseActive(c) === selected.has(c.id) ? acc : setActivePin(acc, c.id, selected.has(c.id))), list);
  await writeUser(platform.store, userId, 'courses', next);
}

async function pendingItems(platform: Platform) {
  const userId = await currentUser(platform.store);
  if (userId === null) return [];
  const [tasks, taskState, courses] = await Promise.all([readUser(platform.store, userId, 'tasks'), readUser(platform.store, userId, 'taskState'), readUser(platform.store, userId, 'courses')]);
  return buildTaskItems({ tasks, taskState, courses }).filter((i) => i.status === 'pending');
}

const nearestFuture = (items: Awaited<ReturnType<typeof pendingItems>>, now: number) =>
  items.filter((i) => i.task.dueAt !== null && i.task.dueAt > now).sort((a, b) => a.task.dueAt! - b.task.dueAt!)[0] ?? null;

/** The user's nearest task as the sample reminder; a synthetic one when there is none. */
export async function readReminderSample(platform: Platform, w: OnboardingWords, m: Messages, locale: 'id' | 'en', timeZone: string): Promise<ReminderSample> {
  const now = platform.clock.now();
  const next = nearestFuture(await pendingItems(platform), now);
  if (!next) return { title: w.reminders.sample.title, when: w.reminders.sampleWhen, course: w.reminders.sampleCourse };
  return { title: next.task.name, when: taskDueLines(next.task.dueAt!, now, timeZone, m, locale, 'remaining').primary, course: next.courseName };
}

/** The three stages offered on screen 8 that are on now. */
export const OFFERED_STAGES = [1440, 180, 60] as const;

export async function readOfferedStages(platform: Platform): Promise<Set<number>> {
  const prefs = await readPrefs(platform.store);
  return new Set(prefs.reminders.stages.filter((s) => (OFFERED_STAGES as readonly number[]).includes(s)));
}

/** Keeps the stages not offered here; at least one stage stays on (3 hours when nothing is left). */
export async function saveStages(platform: Platform, chosen: ReadonlySet<number>): Promise<void> {
  const prefs = await readPrefs(platform.store);
  const others = prefs.reminders.stages.filter((s) => !(OFFERED_STAGES as readonly number[]).includes(s));
  const all = [...new Set([...others, ...chosen])].sort((a, b) => b - a) as StageMin[];
  await writePrefs(platform.store, { reminders: { ...prefs.reminders, stages: all.length > 0 ? all : [180] } });
}

/** "{n} tugas terpantau, terdekat {waktu}." from the real data, or the empty line. */
export async function doneSummary(platform: Platform, w: OnboardingWords, m: Messages, locale: 'id' | 'en', timeZone: string): Promise<string> {
  const now = platform.clock.now();
  const items = await pendingItems(platform);
  if (items.length === 0) return w.done.empty;
  const next = nearestFuture(items, now) ?? items.find((i) => i.task.dueAt !== null) ?? null;
  const when = next?.task.dueAt ? taskDueLines(next.task.dueAt, now, timeZone, m, locale, 'remaining').primary : '';
  return when ? w.done.summary(items.length, when) : w.done.empty;
}
