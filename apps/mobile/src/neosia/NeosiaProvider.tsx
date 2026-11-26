// NEOSIA on Android (M8d B3): what the screens need, from the encrypted
// NeosiaStore through core's NEOSIA code. Sulo sends nothing to NEOSIA: a
// NEOSIA page opens only from a tap, and its captures come in when it closes.
//
// Grades stay out of this context: the endpoints that carry them are read
// only by the Nilai screen and the Studi card while they show (useGrades),
// and the IPK fields of Beranda's data are dropped from the copy kept here.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ENDPOINTS, type EndpointId } from '@sulo/core/neosia/allowlist';
import { nextStep, sourcesDoneIn, type ChecklistStep, type OpenResult } from '@sulo/core/neosia/checklist';
import { NEOSIA_MODULE_KEY, readModuleState, type NeosiaModuleState } from '@sulo/core/neosia/module';
import type { SourceId } from '@sulo/core/neosia/sources';
import { readCourseMap, type CourseMap } from '@sulo/core/neosia/course-map';
import { snapshotKey, type NeosiaSnapshot, type Snapshots } from '@sulo/core/neosia/store';
import type { Platform } from '@sulo/core/platform';
import { CURRENT_USER_KEY, currentUser } from '@sulo/core/storage';
import { SuloNeosia, type NeosiaPage } from '../neosia-native';
import { createNeosiaStore } from '../platform/neosia-store';
import { ingestQueued } from './ingest';
import { GRADE_ENDPOINTS, withoutGrades } from './grade-guard';
import { readMkpkTranscript, type MkpkTranscript } from '@sulo/core/mkpk/transcript';
import { VISIT_KEY, visitDue } from '@sulo/core/neosia/visit';
import { noteNeosiaSession } from '@sulo/core/neosia/session-log';
import { readPrefs } from '@sulo/core/prefs';
import { readRemoteConfig } from '@sulo/core/remote/remote-config';
import { sourcesFrom } from '@sulo/core/remote/sources';
import { readCalendar } from '@sulo/core/calendar/remote';
import { localParts } from '@sulo/core/reminders/zoned';

/** NEOSIA's sign-in was seen (a page left its login), kept until a page lands on the login again; NEOSIA data, so wiped with it. */
const SIGNED_IN_KEY = 'neosia:signedIn';

const PAGE_OF: Record<SourceId, NeosiaPage> = { beranda: 'home', khs: 'khs', krs: 'krs', transkrip: 'transkrip', matakuliah: 'matakuliah' };

export interface NeosiaState {
  /** This WebView can capture (document-start script and message listener). */
  supported: boolean | null;
  enabled: boolean;
  /** Everything but the grades (see GRADE_ENDPOINTS). */
  snapshots: Snapshots;
  /** Which checklist sources are done (grade sources by key only, never decrypted here). */
  done: ReadonlySet<SourceId>;
  next: ChecklistStep;
  /** A page with the script reached NEOSIA's login: its session ended. */
  needsLogin: boolean;
  signedIn: boolean;
  /** NEOSIA classes linked by hand to SIKOLA courses (encrypted like the rest). */
  courseMap: CourseMap;
  /** The MKPK card's summary of the transcript: passed MKPK credits and course-code letters, never a grade. */
  mkpk: MkpkTranscript | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  /** Opens a NEOSIA page from a tap; its captures are stored when it closes. */
  open: (page: NeosiaPage | SourceId | 'login') => Promise<OpenResult>;
  /** "Perbarui dari NEOSIA" (1.1.0): the page opens, its data comes in, the screen closes by itself. */
  refreshFrom: (page: NeosiaPage | SourceId) => Promise<OpenResult>;
  /** The full snapshots with grades, for Nilai and the Studi card only. */
  loadGrades: () => Promise<Snapshots>;
  reload: () => Promise<void>;
}

const NeosiaContext = createContext<NeosiaState | null>(null);
export const useNeosia = (): NeosiaState => {
  const v = useContext(NeosiaContext);
  if (!v) throw new Error('NeosiaProvider missing');
  return v;
};

/** The shell (the landing page renders it without NEOSIA): null when no provider is there. */
export const useNeosiaIfAny = (): NeosiaState | null => useContext(NeosiaContext);

export function NeosiaProvider({ platform, children }: { platform: Platform; children: ReactNode }) {
  const store = useMemo(() => createNeosiaStore(platform.store, SuloNeosia), [platform]);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [module, setModule] = useState<NeosiaModuleState>({ enabled: false, changedAt: null });
  const [snapshots, setSnapshots] = useState<Snapshots>({});
  const [gradeKeys, setGradeKeys] = useState<ReadonlySet<EndpointId>>(new Set());
  const [lastResult, setLastResult] = useState<OpenResult>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [courseMap, setCourseMap] = useState<CourseMap>({});
  const [mkpk, setMkpk] = useState<MkpkTranscript | null>(null);
  const [signedInSeen, setSignedInSeen] = useState(false);

  const reload = useCallback(async () => {
    setModule(await readModuleState(platform.store));
    if ((await currentUser(platform.store)) === null) {
      setSnapshots({});
      setGradeKeys(new Set());
      setSignedInSeen(false);
      setMkpk(null);
      return;
    }
    const keys = new Set(await store.keys(snapshotKey('' as EndpointId)));
    const next: Snapshots = {};
    const grades = new Set<EndpointId>();
    for (const e of ENDPOINTS) {
      if (!keys.has(snapshotKey(e.id))) continue;
      if (GRADE_ENDPOINTS.has(e.id)) {
        grades.add(e.id);
        continue;
      }
      const snap = await store.get<NeosiaSnapshot>(snapshotKey(e.id));
      if (snap) next[e.id] = e.id === 'dashboard' ? { ...snap, data: withoutGrades(snap.data) as NeosiaSnapshot['data'] } : snap;
    }
    setSnapshots(next);
    setGradeKeys(grades);
    setSignedInSeen((await store.get<boolean>(SIGNED_IN_KEY)) === true);
    setCourseMap(await readCourseMap(store).catch(() => ({})));
    // Made once from a transcript captured before the summary existed; the transcript itself is not kept here.
    setMkpk(await readMkpkTranscript(store, snapshotKey('getTranskripMahasiswa')).catch(() => null));
  }, [platform, store]);

  useEffect(() => {
    void SuloNeosia.support()
      .then((s) => setSupported(s.docStart && s.listener))
      .catch(() => setSupported(false));
    void reload();
    // The module switched or another account became current (a sync, Keluar, an account switch): read again.
    return platform.store.watch((changes) => {
      if (NEOSIA_MODULE_KEY in changes || CURRENT_USER_KEY in changes) void reload();
    });
  }, [platform, reload]);

  // "Perbarui NEOSIA otomatis" (1.1.0): on opening the app, when a visit is due, Beranda in a hidden WebView.
  useEffect(() => {
    let running = false;
    const maybeVisit = async () => {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        const [module, prefs, config, calendar, last] = await Promise.all([
          readModuleState(platform.store),
          readPrefs(platform.store),
          readRemoteConfig(platform.store),
          readCalendar(platform.store),
          store.get<number>(VISIT_KEY),
        ]);
        const now = platform.clock.now();
        const today = localParts(now, Intl.DateTimeFormat().resolvedOptions().timeZone).dateKey;
        const due = visitDue({ consented: prefs.neosiaAutoVisit, configAllows: sourcesFrom(config).neosia.scheduledVisit, moduleOn: module.enabled, lastVisitAt: last ?? null, now, today, kegiatan: calendar.kegiatan });
        if (!due) return;
        await store.set(VISIT_KEY, now);
        const { result } = await SuloNeosia.visit();
        if (result === 'data' || result === 'needs_login') await noteNeosiaSession(store, { at: now, event: result === 'data' ? 'signed_in' : 'needs_login', via: 'visit' }).catch(() => undefined);
        if (result === 'needs_login') {
          setNeedsLogin(true);
          await store.remove(SIGNED_IN_KEY).catch(() => undefined);
        }
        await ingestQueued({ take: () => SuloNeosia.takeCaptures(), store, now: () => platform.clock.now() });
        await reload();
      } finally {
        running = false;
      }
    };
    void maybeVisit();
    document.addEventListener('visibilitychange', maybeVisit);
    return () => document.removeEventListener('visibilitychange', maybeVisit);
  }, [platform, store, reload]);

  // The checklist counts a grade source by its stored key; the grades themselves stay unread.
  const done = useMemo(() => {
    const stand: Snapshots = { ...snapshots };
    for (const e of gradeKeys) stand[e] = { endpoint: e, v: 2, data: {}, changedAt: 0, seenAt: 0, unknownShapeAt: null } as NeosiaSnapshot;
    return sourcesDoneIn(stand);
  }, [snapshots, gradeKeys]);
  // Closing a page by hand says nothing about the session: only reaching NEOSIA's login does.
  const signedIn = signedInSeen || lastResult === 'signed_in' || Object.keys(snapshots).length > 0 || gradeKeys.size > 0;
  const next = nextStep({ signedIn: signedIn && !needsLogin, lastResult: needsLogin ? 'needs_login' : lastResult, done });

  const enable = useCallback(async () => {
    await platform.store.set<NeosiaModuleState>(NEOSIA_MODULE_KEY, { enabled: true, changedAt: platform.clock.now() });
    await reload();
  }, [platform, reload]);

  const disable = useCallback(async () => {
    const user = await currentUser(platform.store);
    await SuloNeosia.wipe(user === null ? { web: true } : { user, web: true }).catch(() => undefined);
    await platform.store.set<NeosiaModuleState>(NEOSIA_MODULE_KEY, { enabled: false, changedAt: platform.clock.now() });
    setLastResult(null);
    setNeedsLogin(false);
    await reload();
  }, [platform, reload]);

  const open = useCallback(
    async (target: NeosiaPage | SourceId | 'login', closeOnData = false): Promise<OpenResult> => {
      const page = (target in PAGE_OF ? PAGE_OF[target as SourceId] : target) as NeosiaPage;
      const answer = (await SuloNeosia.open({ page, close: 'Tutup', ...(closeOnData ? { closeOnData: true } : {}) })).result;
      // Data came in: the session was alive, like a sign-in seen.
      const result: OpenResult = answer === 'data' ? 'signed_in' : answer;
      // Debug and tester builds: how long NEOSIA sessions last (no request).
      if (result === 'signed_in' || result === 'needs_login') await noteNeosiaSession(store, { at: platform.clock.now(), event: result, via: 'tap' }).catch(() => undefined);
      setLastResult(result);
      setNeedsLogin(result === 'needs_login');
      if (result === 'signed_in') await store.set(SIGNED_IN_KEY, true).catch(() => undefined);
      if (result === 'needs_login') await store.remove(SIGNED_IN_KEY).catch(() => undefined);
      await ingestQueued({ take: () => SuloNeosia.takeCaptures(), store, now: () => platform.clock.now() });
      await reload();
      return result;
    },
    [platform, store, reload],
  );

  const loadGrades = useCallback(async (): Promise<Snapshots> => {
    const full: Snapshots = { ...snapshots };
    for (const e of gradeKeys) {
      const snap = await store.get<NeosiaSnapshot>(snapshotKey(e));
      if (snap) full[e] = snap;
    }
    // Beranda's own GPA, for the Studi card and Nilai only.
    const dash = await store.get<NeosiaSnapshot>(snapshotKey('dashboard'));
    if (dash) full.dashboard = dash;
    return full;
  }, [snapshots, gradeKeys, store]);

  const value: NeosiaState = { supported, enabled: module.enabled, snapshots, done, next, needsLogin, signedIn, courseMap, mkpk, enable, disable, open: (t) => open(t), refreshFrom: (t) => open(t, true), loadGrades, reload };
  return <NeosiaContext.Provider value={value}>{children}</NeosiaContext.Provider>;
}

/** Grades while the calling screen shows; released (left to garbage) when it closes. */
export function useGrades(active: boolean): Snapshots | null {
  const { loadGrades } = useNeosia();
  const [grades, setGrades] = useState<Snapshots | null>(null);
  useEffect(() => {
    if (!active) {
      setGrades(null);
      return;
    }
    let live = true;
    void loadGrades().then((g) => live && setGrades(g));
    return () => {
      live = false;
      setGrades(null);
    };
  }, [active, loadGrades]);
  return grades;
}
