import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { browser } from 'wxt/browser';
import { readPending } from '@sulo/core/account/pending';
import { createBrowserStore } from '@/src/platform/store';
import { systemClock } from '@sulo/core/clock';
import type { Message } from '@/lib/messages';
import { writePrefs, type Prefs } from '@sulo/core/prefs';
import { currentUser, readUser, writeUserIfCurrent, type UserData } from '@sulo/core/storage';
import type { SyncOutcome } from '@sulo/core/types';
import { loadDashboardData, type DashboardData } from '@sulo/core/view/dashboard-data';
import { localParts } from '@sulo/core/reminders/zoned';
import { applyTheme } from '@/lib/ui/theme';
import { markOpened } from '@sulo/core/watch/idle';
import { bumpUsage } from '@sulo/core/stats/usage';

// The dashboard's data: everything comes from chrome.storage, re-read when
// storage changes. Opening the dashboard sends no request to SIKOLA; only
// "Perbarui" and "Segarkan daftar" ask the service worker to sync.
// Writes go through compare-and-set: if another account became current,
// nothing is written into it.

export const local = createBrowserStore(browser.storage.local);
export const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export type { DashboardData };

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

const load = () => loadDashboardData(local, systemClock, timeZone, navigator.onLine);

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
    // Opening the dashboard counts as opening Sulo (watch/idle.ts: 7 days without it pause the watch).
    void markOpened(local, systemClock.now());
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
