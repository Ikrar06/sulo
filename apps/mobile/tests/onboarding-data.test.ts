// What the onboarding writes: the courses (only what the user changed is
// pinned), the reminder stages (the ones not offered are kept, one always
// stays), and the flow mark that makes signing in again start at sign-in.
import { describe, expect, it } from 'vitest';
import { resume } from '@sulo/core/onboarding/mobile-flow';
import type { Platform } from '@sulo/core/platform';
import { readPrefs, writePrefs, DEFAULT_PREFS } from '@sulo/core/prefs';
import { readUser, switchUser, writeUser } from '@sulo/core/storage';
import type { CourseRecord, KeyValueStore } from '@sulo/core/types';
import { readCourseChoices, readSavedFlow, saveCourseChoices, saveFlow, saveStages } from '../src/onboarding/data';

function platform(): Platform {
  let data: Record<string, unknown> = {};
  const store: KeyValueStore = {
    get: async <T,>(k: string) => structuredClone(data[k]) as T | undefined,
    set: async (k, v) => void (data = { ...data, [k]: structuredClone(v) }),
    remove: async (keys) => {
      const drop = new Set(Array.isArray(keys) ? keys : [keys]);
      data = Object.fromEntries(Object.entries(data).filter(([k]) => !drop.has(k)));
    },
    keys: async (prefix) => Object.keys(data).filter((k) => k.startsWith(prefix)),
  } as KeyValueStore;
  return { store, clock: { now: () => 1_794_000_000, localDate: () => '2026-11-19', localHour: () => 10 } } as unknown as Platform;
}

const course = (id: number, active: boolean, inProgress = active): CourseRecord =>
  ({ id, fullname: `C${id}`, shortname: `C${id}`, parsed: { name: `Course ${id}` }, alias: null, color: null, inProgress, past: false, enddate: 0, activeScore: active ? 10 : 0, activeReasons: [], activePin: null }) as unknown as CourseRecord;

describe('onboarding data', () => {
  it('offers in-progress courses ticked, and pins only what the user changed', async () => {
    const p = platform();
    await switchUser(p.store, 7);
    await writeUser(p.store, 7, 'courses', [course(1, true), course(2, true), course(3, false)]);
    const { courses, selected } = await readCourseChoices(p);
    expect([...selected].sort()).toEqual([1, 2]);
    expect(courses.map((c) => [c.id, c.main])).toEqual([[1, true], [2, true], [3, false]]);
    await saveCourseChoices(p, new Set([1, 3]));
    const after = await readUser(p.store, 7, 'courses');
    expect(after.map((c) => c.activePin)).toEqual([null, false, true]);
  });

  it('keeps the stages not offered here, and one stage always stays', async () => {
    const p = platform();
    await writePrefs(p.store, { reminders: { ...DEFAULT_PREFS.reminders, stages: [4320, 1440, 180] } });
    await saveStages(p, new Set([60]));
    expect((await readPrefs(p.store)).reminders.stages).toEqual([4320, 60]);
    await writePrefs(p.store, { reminders: { ...DEFAULT_PREFS.reminders, stages: [1440] } });
    await saveStages(p, new Set());
    expect((await readPrefs(p.store)).reminders.stages).toEqual([180]);
  });

  it('the mark left by Keluar starts the next sign-in at screen 4, without splash or intro', async () => {
    const p = platform();
    expect(await readSavedFlow(p)).toBeNull();
    await saveFlow(p, { step: 'finished', mode: 'first' });
    const next = resume(await readSavedFlow(p), { signedIn: false, hasData: false });
    expect(next).toMatchObject({ step: 'signin', mode: 'relogin' });
  });
});
