// Everything a data screen shows, read from local storage in one go: the
// extension's dashboard and the Android app's screens both use it. No
// request: opening a screen never contacts SIKOLA.

import { readPending, type AccountPending } from '../account/pending';
import { readCalendar } from '../calendar/remote';
import type { CalendarFile } from '../calendar/schema';
import { readCourseMap, type CourseMap } from '../neosia/course-map';
import { readInvite, type InviteState } from '../neosia/invite';
import { readModuleState, type NeosiaModuleState } from '../neosia/module';
import { readSnapshots, snapshotKey, type Snapshots } from '../neosia/store';
import { readMkpkTranscript, type MkpkTranscript } from '../mkpk/transcript';
import { readPrefs, type Prefs } from '../prefs';
import { localParts } from '../reminders/zoned';
import { currentUser, readAllUser, type UserData } from '../storage';
import type { Clock, KeyValueStore, UnixSeconds, UserId } from '../types';
import { loadPopupInput } from './load';
import { buildPopupView, type PopupInput, type PopupView } from './popup-view';

export interface DashboardData {
  now: UnixSeconds;
  userId: UserId | null;
  user: UserData | null;
  prefs: Prefs;
  input: PopupInput;
  view: PopupView;
  pending: AccountPending | null;
  /** Academic calendar: the bundled copy or a newer download (lib/calendar/remote.ts). */
  calendar: CalendarFile;
  /** Today's local date, YYYY-MM-DD. */
  today: string;
  /** The optional NEOSIA module: its state and the stored projections. */
  neosia: { module: NeosiaModuleState; snapshots: Snapshots; courseMap: CourseMap; invite: InviteState; mkpk: MkpkTranscript | null };
}

export async function loadDashboardData(store: KeyValueStore, clock: Clock, timeZone: string, online: boolean): Promise<DashboardData> {
  const userId = await currentUser(store);
  const [input, prefs, user, pending, calendar, module, snapshots, courseMap, invite, mkpk] = await Promise.all([
    loadPopupInput(store, clock, timeZone),
    readPrefs(store),
    userId === null ? Promise.resolve(null) : readAllUser(store, userId),
    readPending(store),
    readCalendar(store),
    readModuleState(store),
    readSnapshots(store),
    readCourseMap(store),
    readInvite(store),
    readMkpkTranscript(store, snapshotKey('getTranskripMahasiswa')).catch(() => null),
  ]);
  return {
    now: input.now,
    userId,
    user: pending ? null : user,
    prefs,
    input,
    view: buildPopupView({ ...input, online }),
    pending,
    calendar,
    today: localParts(input.now, timeZone).dateKey,
    // While the module is off nothing of it shows, even if a key were left behind.
    neosia: { module, snapshots: module.enabled ? snapshots : {}, courseMap: module.enabled ? courseMap : {}, invite, mkpk: module.enabled ? mkpk : null },
  };
}
