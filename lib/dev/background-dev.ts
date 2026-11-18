import { browser } from 'wxt/browser';
import { recordFixtures } from '../recorder';
import { calls } from '../moodle/calls';
import { parseCall } from '../moodle/schemas';
import type { MoodleClient } from '../moodle/client';
import { activeCourseIds } from '../courses/active-score';
import { appendChanges } from '../radar/log';
import { currentUser, readUser, writeUser } from '../storage';
import type { Change } from '../types';
import type { Clock, KeyValueStore, UnixSeconds } from '../types';
import { devMessageSchema } from './messages';
import { recordObservation } from './neosia-observe';

// Development builds only (see lib/dev/messages.ts). Registers a separate
// message listener for the recorder and the reminder simulator.

export interface DevDeps {
  client: MoodleClient;
  clock: Clock;
  store: KeyValueStore;
  origin: string;
  /** Runs a reminder cycle at a given time and returns what happened. */
  runRemindersAt: (now: UnixSeconds) => Promise<{ nextAt: UnixSeconds | null; shown: number }>;
  isExtensionPage: (sender: Parameters<Parameters<typeof browser.runtime.onMessage.addListener>[0]>[1]) => boolean;
  /** The NEOSIA bridge (content script on the NEOSIA app). */
  isNeosiaPage: (sender: Parameters<Parameters<typeof browser.runtime.onMessage.addListener>[0]>[1]) => boolean;
}

/** Sample updates built from the user's own courses and tasks (dev builds only). */
async function injectSampleChanges(deps: DevDeps, kind: 'material' | 'due' | 'grade' | 'forum' | 'many') {
  const userId = await currentUser(deps.store);
  if (userId === null) return { ok: false, reason: 'no user' };
  const now = deps.clock.now();
  const courses = [...activeCourseIds(await readUser(deps.store, userId, 'courses'))];
  const task = (await readUser(deps.store, userId, 'tasks')).find((t) => t.dueAt !== null && t.dueAt > now);
  const course = courses[0] ?? 1;
  const nid = now; // unique enough for a sample notification id
  const note = (c: number, component: string, eventtype: string, subject: string) => ({
    id: nid + c, subject, component, eventtype, timecreated: now, read: false, contexturl: null,
  });
  const material = (c: number, i: number): Change => ({ kind: 'added', courseId: c, cmId: 900_000 + now % 1000 + i, module: 'resource', name: `Materi contoh ${i + 1}`, url: null, since: now });
  const changes: Change[] =
    kind === 'material'
      ? [material(course, 0), material(course, 1)]
      : kind === 'due' && task
        ? [{ kind: 'due_changed', courseId: task.courseId, eventId: task.eventId, cmId: task.cmId, name: task.name, from: (task.dueAt as number) - 2 * 86_400, to: task.dueAt, url: task.url }]
        : kind === 'grade'
          ? [{ kind: 'grade_feedback', courseId: course, notification: note(1, 'mod_assign', 'assign_notification', 'Contoh nilai') }]
          : kind === 'forum'
            ? [{ kind: 'forum', courseId: course, notification: note(2, 'mod_forum', 'posts', 'Pengumuman contoh') }]
            : courses.slice(0, 4).map((c, i) => material(c, i));
  const log = await readUser(deps.store, userId, 'changes');
  await writeUser(deps.store, userId, 'changes', appendChanges(log, changes, now));
  return { ok: true, added: changes.length };
}

/** Reads how long the SIKOLA session has left, with nosessionupdate like every batch. */
async function probeSession(deps: DevDeps) {
  const result = await deps.client.callBatch([calls.sessionTimeRemaining()], { source: 'dev-probe' });
  if (result.kind !== 'ok') return { kind: 'failed', reason: result.kind === 'refused' ? result.reason : result.kind };
  const parsed = parseCall('core_session_time_remaining', result.results[0] ?? { ok: false, errorcode: 'missing' });
  return parsed.ok ? { kind: 'ok', timeremaining: parsed.data.timeremaining } : { kind: 'failed', reason: 'unreadable' };
}

export function installDevTools(deps: DevDeps): void {
  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    const parsed = devMessageSchema.safeParse(raw);
    if (!parsed.success) return false;
    const message = parsed.data;
    if (message.type === 'dev/neosia/observe') {
      // Only while the module is on (the bridge exists only then), only from a NEOSIA page.
      if (deps.isNeosiaPage(sender)) void recordObservation(deps.store, message.observation);
      return false;
    }
    if (!deps.isExtensionPage(sender)) return false;
    const work = (async (): Promise<unknown> => {
      switch (message.type) {
        case 'dev/record':
          return recordFixtures({
            client: deps.client,
            clock: deps.clock,
            origin: deps.origin,
            // Random shift of 20 to 60 days back, so real dates cannot be read off.
            timeShiftSeconds: -(20 + Math.floor(Math.random() * 41)) * 86_400,
          });
        case 'dev/notify/simulate':
          return deps.runRemindersAt(message.at);
        case 'dev/radar/inject':
          return injectSampleChanges(deps, message.kind);
        case 'dev/session/probe':
          return probeSession(deps);
        case 'dev/notify/reset': {
          const userId = await currentUser(deps.store);
          if (userId !== null) await writeUser(deps.store, userId, 'notified', {});
          return { ok: true };
        }
      }
    })();
    work.then(sendResponse, () => sendResponse(null));
    return true;
  });
}
