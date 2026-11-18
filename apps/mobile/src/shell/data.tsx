// The app's data, the dashboard's way (packages/core/src/view/dashboard-data.ts):
// read from the phone's storage in one go, again whenever it changes and
// once a minute for relative times. Opening a screen never contacts SIKOLA.
// Writes go through compare-and-set, so nothing lands in an account that is
// no longer current. Every data change plans the next 7 days of reminders.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { readPending } from '@sulo/core/account/pending';
import type { Platform } from '@sulo/core/platform';
import { writePrefs, type Prefs } from '@sulo/core/prefs';
import { currentUser, readUser, writeUserIfCurrent, type UserData } from '@sulo/core/storage';
import { loadDashboardData, type DashboardData } from '@sulo/core/view/dashboard-data';
import { scheduleReminders, SCHEDULED_KEY } from '../reminders';

export const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export interface MobileActions {
  updateUser: <K extends keyof UserData>(name: K, change: (value: UserData[K]) => UserData[K]) => Promise<boolean>;
  setPrefs: (patch: Partial<Prefs>) => Promise<void>;
  /** Opens a web address in the phone's browser (SIKOLA, Google Calendar, forms). */
  openExternal: (url: string) => void;
}

interface Ctx {
  data: DashboardData | null;
  actions: MobileActions;
  platform: Platform;
  reload: () => Promise<void>;
}

const MobileDataContext = createContext<Ctx | null>(null);

/** Keys whose change is not a data change (the reminder plan writes its own list). */
const IGNORED = new Set([SCHEDULED_KEY]);

export function MobileDataProvider({ platform, children }: { platform: Platform; children: ReactNode }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const reloading = useRef<number | null>(null);
  const planning = useRef<number | null>(null);

  const reload = useCallback(async () => {
    setData(await loadDashboardData(platform.store, platform.clock, timeZone, navigator.onLine));
  }, [platform]);

  useEffect(() => {
    void reload();
    const stop = platform.store.watch((changes) => {
      const keys = Object.keys(changes).filter((k) => !IGNORED.has(k));
      if (keys.length === 0) return;
      // A sync writes several keys: one reload, and one new reminder plan a moment later.
      if (reloading.current !== null) window.clearTimeout(reloading.current);
      reloading.current = window.setTimeout(() => void reload(), 120);
      if (planning.current !== null) window.clearTimeout(planning.current);
      planning.current = window.setTimeout(() => void scheduleReminders(platform).catch(() => 0), 1500);
    });
    const tick = window.setInterval(() => void reload(), 60_000);
    const onOnline = () => void reload();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOnline);
    return () => {
      stop();
      window.clearInterval(tick);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOnline);
    };
  }, [platform, reload]);

  const actions = useMemo<MobileActions>(
    () => ({
      updateUser: async (name, change) => {
        const userId = await currentUser(platform.store);
        if (userId === null || (await readPending(platform.store))) return false;
        return writeUserIfCurrent(platform.store, userId, name, change(await readUser(platform.store, userId, name)));
      },
      setPrefs: async (patch) => {
        await writePrefs(platform.store, patch);
      },
      // Capacitor hands web addresses outside the app to the system browser.
      openExternal: (url) => void window.open(url, '_blank', 'noopener,noreferrer'),
    }),
    [platform],
  );

  return <MobileDataContext.Provider value={{ data, actions, platform, reload }}>{children}</MobileDataContext.Provider>;
}

export function useMobileData(): Ctx {
  const ctx = useContext(MobileDataContext);
  if (!ctx) throw new Error('useMobileData outside MobileDataProvider');
  return ctx;
}
