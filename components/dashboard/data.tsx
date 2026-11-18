import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { browser } from 'wxt/browser';
import { readPending, type AccountPending } from '@/lib/account/pending';
import { readCalendar } from '@/lib/calendar/remote';
import type { CalendarFile } from '@/lib/calendar/schema';
import { createBrowserStore } from '@/lib/browser-store';
import { systemClock } from '@/lib/clock';
import type { Message } from '@/lib/messages';
import { DEFAULT_PREFS, readPrefs, writePrefs, type Prefs } from '@/lib/prefs';
import { currentUser, readAllUser, readUser, writeUserIfCurrent, type UserData } from '@/lib/storage';
import type { SyncOutcome, UnixSeconds, UserId } from '@/lib/types';
import { localParts } from '@/lib/reminders/zoned';
import { applyTheme } from '@/lib/ui/theme';
import { bumpUsage } from '@/lib/stats/usage';
import { loadPopupInput } from '@/lib/view/load';
import { buildPopupView, type PopupInput, type PopupView } from '@/lib/view/popup-view';
import { readModuleState, type NeosiaModuleState } from '@/lib/neosia/module';
import { readSnapshots, type Snapshots } from '@/lib/neosia/store';
import { readCourseMap, type CourseMap } from '@/lib/neosia/course-map';

// The dashboard's data: everything comes from chrome.storage, re-read when
// storage changes. Opening the dashboard sends no request to SIKOLA; only
// "Perbarui" and "Segarkan daftar" ask the service worker to sync.
// Writes go through compare-and-set: if another account became current,
// nothing is written into it.

export const local = createBrowserStore(browser.storage.local);
export const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
  neosia: { module: NeosiaModuleState; snapshots: Snapshots; courseMap: CourseMap };
}

export interface DashboardActions {
  /** Applies `change` to one user key, only while that account is still current. */
  updateUser: <K extends keyof UserData>(name: K, change: (value: UserData[K]) => UserData[K]) => Promise<boolean>;
  setPrefs: (patch: Partial<Prefs>) => Promise<void>;
  send: (message: Message) => Promise<unknown>;
  sync: (forceCourseList?: boolean) => Promise<SyncOutcome | null>;
  openTab: (url: string) => void;
}

interface Ctx {
  data: DashboardData | null;
  actions: DashboardActions;
}

const DashboardContext = createContext<Ctx | null>(null);

async function load(): Promise<DashboardData> {
  const userId = await currentUser(local);
  const [input, prefs, user, pending, calendar, module, snapshots, courseMap] = await Promise.all([
    loadPopupInput(local, systemClock, timeZone),
    readPrefs(local),
    userId === null ? Promise.resolve(null) : readAllUser(local, userId),
    readPending(local),
    readCalendar(local),
    readModuleState(local),
    readSnapshots(local),
    readCourseMap(local),
  ]);
  return {
    now: input.now,
    userId,
    user: pending ? null : user,
    prefs,
    input,
    view: buildPopupView({ ...input, online: navigator.onLine }),
    pending,
    calendar,
    today: localParts(input.now, timeZone).dateKey,
    // While the module is off nothing of it shows, even if a key were left behind.
    neosia: { module, snapshots: module.enabled ? snapshots : {}, courseMap: module.enabled ? courseMap : {} },
  };
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const reloading = useRef<number | null>(null);

  const reload = useCallback(async () => {
    const next = await load();
    applyTheme(document.documentElement, next.prefs.theme);
    setData(next);
  }, []);

  useEffect(() => {
    void reload();
    void bumpUsage(local, localParts(systemClock.now(), timeZone).dateKey, 'dashboardOpens');
    // Coalesces bursts of storage writes (a sync writes several keys).
    const onChange = (_c: unknown, area: string) => {
      if (area !== 'local') return;
      if (reloading.current !== null) window.clearTimeout(reloading.current);
      reloading.current = window.setTimeout(() => void reload(), 120);
    };
    browser.storage.onChanged.addListener(onChange);
    // Relative times ("2 jam lagi") move on even without storage changes.
    const tick = window.setInterval(() => void reload(), 60_000);
    return () => {
      browser.storage.onChanged.removeListener(onChange);
      window.clearInterval(tick);
    };
  }, [reload]);

  const actions = useMemo<DashboardActions>(
    () => ({
      updateUser: async (name, change) => {
        const userId = await currentUser(local);
        if (userId === null || (await readPending(local))) return false;
        return writeUserIfCurrent(local, userId, name, change(await readUser(local, userId, name)));
      },
      setPrefs: async (patch) => {
        await writePrefs(local, patch);
      },
      send: async (message) => {
        try {
          return await browser.runtime.sendMessage(message);
        } catch {
          return null;
        }
      },
      sync: async (forceCourseList = false) => {
        try {
          return ((await browser.runtime.sendMessage({ type: 'sync/request', trigger: 'manual', forceCourseList } satisfies Message)) as SyncOutcome) ?? null;
        } catch {
          return null;
        }
      },
      openTab: (url) => void browser.tabs.create({ url }),
    }),
    [],
  );

  return <DashboardContext.Provider value={{ data, actions }}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): Ctx {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard outside DashboardProvider');
  return ctx;
}
