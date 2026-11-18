// The phone's background answers, read by core when the app opens (M8c.3).
// The native worker sends the batch and keeps Moodle's answer encrypted;
// here each answer goes through the same validation (interpretBatch, Zod)
// and the same steps as a sync (applyBatch): tasks, courses, the radar,
// the change log. Nothing is sent: no follow-up batch, no attendance
// recap, and the budget was counted by the worker when it sent the batch.
//
// On the phone, news is only ever announced by the worker. Once core has
// read the answers (and after any sync the user started), every change
// entry is recorded as handled, so the reminder planner never announces it
// again: changes found while the app is open land in Kabar terbaru, unseen,
// without a notification.

import { readPending } from '../account/pending';
import { calls } from '../moodle/calls';
import { interpretBatch } from '../moodle/client';
import { NOTIFICATIONS_LIMIT } from '../moodle/limits';
import { radarPlanWith } from '../radar/sync-step';
import { changeKey } from '../reminders/plan';
import { currentUser, readUser, writeUserIfCurrent } from '../storage';
import { applyBatch } from '../sync/run-sync';
import type { Clock, KeyValueStore, SyncOutcome, UnixSeconds } from '../types';

/** One answer from the worker's queue (decrypted by the native side, handed over once). */
export interface WatchAnswer {
  ranAt: UnixSeconds;
  plannedAt: UnixSeconds;
  /** The courses whose structures rode on this check, in batch order. */
  radarIds: number[];
  /** Moodle's response body as received. */
  body: string;
}

export interface WatchApplyDeps {
  store: KeyValueStore;
  clock: Clock;
  origin?: string;
}

export type WatchApplied = { ranAt: UnixSeconds; outcome: SyncOutcome | { status: 'unreadable'; detail: string } };

/** Reads the answers oldest first. A pending account switch reads none (hard rule 10). */
export async function applyWatchAnswers(deps: WatchApplyDeps, answers: readonly WatchAnswer[]): Promise<WatchApplied[]> {
  const out: WatchApplied[] = [];
  if (await readPending(deps.store)) return out;
  for (const a of [...answers].sort((x, y) => x.ranAt - y.ranAt)) {
    const userId = await currentUser(deps.store);
    if (userId === null) break;
    const radar = radarPlanWith(userId, { courseIds: a.radarIds, withNotifications: true, notificationsLimit: NOTIFICATIONS_LIMIT });
    const callList = [calls.sessionTimeRemaining(), calls.calendarActionEvents(a.ranAt), ...radar.calls];
    const read = await interpretBatch(new Response(a.body, { status: 200, headers: { 'content-type': 'application/json' } }), callList);
    if (read.kind !== 'ok') {
      out.push({ ranAt: a.ranAt, outcome: { status: 'unreadable', detail: read.kind } });
      continue;
    }
    const outcome = await applyBatch(deps, a.ranAt, { knownUser: userId, mode: 'normal', plan: { withCourseList: false, radar, radarStart: 2 } }, read.results, { followUp: false, recap: false });
    out.push({ ranAt: a.ranAt, outcome });
  }
  return out;
}

/** Records every change entry that may notify as handled (the worker already announced what it could). */
export async function markChangesHandled(store: KeyValueStore, now: UnixSeconds): Promise<number> {
  const userId = await currentUser(store);
  if (userId === null) return 0;
  const [changes, notified] = await Promise.all([readUser(store, userId, 'changes'), readUser(store, userId, 'notified')]);
  const fresh = changes.filter((e) => e.notify && !(changeKey(e) in notified)).map(changeKey);
  if (fresh.length === 0) return 0;
  await writeUserIfCurrent(store, userId, 'notified', { ...notified, ...Object.fromEntries(fresh.map((k) => [k, now])) });
  return fresh.length;
}
