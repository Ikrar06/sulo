import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { I18nProvider } from '@/components/i18n';
import { PopupView } from '@/components/popup/PopupView';
import { createBrowserStore } from '@/lib/browser-store';
import { systemClock } from '@/lib/clock';
import { formatCopyList, type CopyScope } from '@/lib/format/copy-list';
import { googleCalendarUrl } from '@/lib/format/gcal';
import { messagesFor, resolveLocale, type Locale } from '@/lib/i18n';
import type { Message } from '@/lib/messages';
import { DAILY_BUDGET, DAILY_CALL_BUDGET, SIKOLA_ORIGIN } from '@/lib/moodle/limits';
import { refreshFeedback } from '@/lib/view/refresh-feedback';
import { undoDone } from '@/lib/tasks/done-undo';
import type { SyncOutcome } from '@/lib/types';
import { readRequestLog } from '@/lib/net/request-log';
import type { RequestLogEntry } from '@/lib/net/scheduler';
import { DEFAULT_PREFS, readPrefs, writePrefs, type DueFormat, type Prefs } from '@/lib/prefs';
import { currentUser, readUser, writeUser } from '@/lib/storage';
import type { ReminderSettings } from '@/lib/reminders/settings';
import { markAllSeen } from '@/lib/radar/log';
import type { UpdateSettings } from '@/lib/radar/settings';
import { setDone, setSnooze } from '@/lib/tasks/local-state';
import { loadPopupInput } from '@/lib/view/load';
import { buildPopupView, type PopupView as View, type TaskRow } from '@/lib/view/popup-view';
import { applyTheme } from '@/lib/ui/theme';
import { bumpUsage } from '@/lib/stats/usage';
import { localParts } from '@/lib/reminders/zoned';

// Popup container: renders from stored data only. Opening the popup never
// sends a request to SIKOLA or anywhere else; only "Perbarui" asks the
// service worker to sync (docs/ATURAN-REQUEST.md).

/** Written by the background when an update summary is clicked. */
const POPUP_PANEL_KEY = 'global:popupPanel';
const local = createBrowserStore(browser.storage.local);
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
// Technical info (request counts, the request log) is for development builds only, never testers (M5a.4).
const isDev = import.meta.env.MODE === 'development';
const uiLanguage = browser.i18n.getUILanguage();

const send = async (message: Message): Promise<unknown> => {
  try {
    return await browser.runtime.sendMessage(message);
  } catch {
    return null;
  }
};

/**
 * Development builds only: one core_session_time_remaining call, to check
 * that Sulo's batches do not extend the SIKOLA session (nosessionupdate).
 * The condition is a build-time constant, so other builds drop the message.
 */
const probeSession = (m: ReturnType<typeof messagesFor>): (() => Promise<string>) | undefined =>
  import.meta.env.MODE === 'development'
    ? async () => {
        const result = (await browser.runtime.sendMessage({ type: 'dev/session/probe' }).catch(() => null)) as
          | { kind: 'ok'; timeremaining: number }
          | { kind: 'failed'; reason: string }
          | null;
        if (result?.kind === 'ok') return m.popup.dev.probeResult(Math.floor(result.timeremaining / 60));
        return m.popup.dev.probeFailed(result?.kind === 'failed' ? result.reason : 'no answer');
      }
    : undefined;

export default function App({ startedAt }: { startedAt: number }) {
  const [view, setView] = useState<View | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [now, setNow] = useState(systemClock.now());
  const [celebrate, setCelebrate] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [openMs, setOpenMs] = useState<number | null>(null);
  const [startPanel, setStartPanel] = useState<'updates' | undefined>(undefined);
  const [requestLog, setRequestLog] = useState<RequestLogEntry[]>([]);
  const measured = useRef(false);

  const locale = resolveLocale(prefs.locale, uiLanguage);
  const m = messagesFor(locale);

  const reload = useCallback(async () => {
    const [input, stored, permission] = await Promise.all([
      loadPopupInput(local, systemClock, timeZone),
      readPrefs(local),
      browser.notifications.getPermissionLevel().catch(() => 'granted' as const),
    ]);
    // A click on an update summary asks the popup to open on "Kabar terbaru" (once, within 2 minutes).
    const request = await local.get<{ panel: string; at: number }>(POPUP_PANEL_KEY);
    if (request) {
      await local.remove(POPUP_PANEL_KEY);
      if (request.panel === 'updates' && input.now - request.at < 120) setStartPanel('updates');
    }
    setPrefs(stored);
    applyTheme(document.documentElement, stored.theme);
    setNow(input.now);
    if (isDev) setRequestLog(await readRequestLog(local));
    setView(
      buildPopupView({
        ...input,
        online: navigator.onLine,
        messages: messagesFor(resolveLocale(stored.locale, uiLanguage)),
        notificationsAllowed: permission !== 'denied',
      }),
    );
  }, []);

  useEffect(() => {
    // Only local work: the "baru" markers count popup opens. No sync.
    void reload().then(() => send({ type: 'popup/opened' }));
    const onChange = (_changes: unknown, area: string) => {
      if (area === 'local') void reload();
    };
    const onNetwork = () => void reload();
    browser.storage.onChanged.addListener(onChange);
    window.addEventListener('online', onNetwork);
    window.addEventListener('offline', onNetwork);
    return () => {
      browser.storage.onChanged.removeListener(onChange);
      window.removeEventListener('online', onNetwork);
      window.removeEventListener('offline', onNetwork);
    };
  }, [reload]);

  useEffect(() => {
    if (view && !measured.current) {
      measured.current = true;
      setOpenMs(Math.round(performance.now() - startedAt));
    }
  }, [view, startedAt]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  if (!view) return null;

  const flash = (text: string) => {
    setNote(text);
    window.setTimeout(() => setNote(null), 2500);
  };

  const onDone = async (eventId: number) => {
    const userId = await currentUser(local);
    if (userId === null) return;
    const state = await readUser(local, userId, 'taskState');
    await writeUser(local, userId, 'taskState', setDone(state, eventId, true));
    await bumpUsage(local, localParts(systemClock.now(), timeZone).dateKey, 'tasksMarkedDone');
    if (view.pendingCount === 1) setCelebrate((n) => n + 1);
  };

  const onUndo = async (eventId: number) => {
    const userId = await currentUser(local);
    if (userId === null) return;
    const state = await readUser(local, userId, 'taskState');
    await writeUser(local, userId, 'taskState', undoDone(state, eventId));
  };

  const onCopy = async (scope: CopyScope) => {
    await navigator.clipboard.writeText(formatCopyList(view.copyItems, scope, now, timeZone, m));
    flash(m.popup.copy.copied(m.popup.copy[scope]));
  };

  const onMarkAllSeen = async () => {
    const userId = await currentUser(local);
    if (userId === null) return;
    await writeUser(local, userId, 'changes', markAllSeen(await readUser(local, userId, 'changes')));
  };

  const onSnooze = async (eventId: number, until: number | null) => {
    const userId = await currentUser(local);
    if (userId === null) return;
    const state = await readUser(local, userId, 'taskState');
    await writeUser(local, userId, 'taskState', setSnooze(state, eventId, until));
  };

  // A link opened by the user's click. Sulo sends nothing to Google.
  const onAddToCalendar = (row: TaskRow) => {
    if (row.dueAt === null) return;
    const url = googleCalendarUrl({
      title: `${row.name} (${row.courseName})`,
      dueAt: row.dueAt,
      details: m.popup.row.calendarDetails(row.courseName, row.url),
    });
    void browser.tabs.create({ url });
  };

  const onReport = async () => {
    // Diagnostic text without personal data, for the tester to send to the maintainer.
    const outcome = (await local.get<{ lastOutcome?: { status: string; where?: string } }>('global:syncStatus'))?.lastOutcome;
    const info = `Sulo ${browser.runtime.getManifest().version}: ${outcome?.status ?? '-'} ${outcome?.where ?? ''} (${new Date().toISOString().slice(0, 16)})`;
    await navigator.clipboard.writeText(info.trim());
    setNote(m.banner.reportCopied);
  };

  return (
    <I18nProvider locale={locale}>
      <PopupView
        view={view}
        now={now}
        timeZone={timeZone}
        dueFormat={prefs.dueFormat}
        reminders={prefs.reminders}
        updatesSettings={prefs.updates}
        initialPanel={startPanel}
        celebrate={celebrate}
        note={note}
        dev={isDev ? { openMs, budgetLimit: DAILY_BUDGET, callLimit: DAILY_CALL_BUDGET, requestLog, onProbeSession: probeSession(m) } : null}
        onDone={(e) => void onDone(e)}
        onUndo={(e) => void onUndo(e)}
        onOpenTask={(url) => void browser.tabs.create({ url })}
        onAddToCalendar={onAddToCalendar}
        onRefresh={async () => {
          const outcome = (await send({ type: 'sync/request', trigger: 'manual' })) as SyncOutcome | null;
          return refreshFeedback(outcome, view.lastSyncAt, Math.floor(Date.now() / 1000)) === 'up-to-date';
        }}
        onCopy={(s) => void onCopy(s)}
        onOpenOnboarding={(hash = '') => void browser.tabs.create({ url: browser.runtime.getURL(`/onboarding.html${hash}`) })}
        onOpenSikola={() => void browser.tabs.create({ url: `${SIKOLA_ORIGIN}/my/` })}
        onReport={() => void onReport()}
        onOpenPrivacy={() => void browser.tabs.create({ url: browser.runtime.getURL('/privacy.html') })}
        onSetDueFormat={(dueFormat: DueFormat) => void writePrefs(local, { dueFormat })}
        onSetLocale={(next: Locale) => void writePrefs(local, { locale: next })}
        onSnooze={(eventId, until) => void onSnooze(eventId, until)}
        onSetReminders={(reminders: ReminderSettings) => void writePrefs(local, { reminders })}
        onSetUpdates={(updates: UpdateSettings) => void writePrefs(local, { updates })}
        onMarkAllSeen={() => void onMarkAllSeen()}
        onUseNewAccount={() => void send({ type: 'account/useNew' }).then(() => window.close())}
        onDeferAccount={() => void send({ type: 'account/defer' })}
        onWipeAll={() => void send({ type: 'data/wipeAll' }).then(() => window.close())}
        onOpenDashboard={(hash) => void browser.tabs.create({ url: browser.runtime.getURL(`/dashboard.html${hash}`) })}
        onTestNotification={async () => {
          await send({ type: 'notify/test' });
        }}
      />
    </I18nProvider>
  );
}
