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
import { DAILY_BUDGET, SIKOLA_ORIGIN } from '@/lib/moodle/limits';
import { DEFAULT_PREFS, readPrefs, writePrefs, type DueFormat, type Prefs } from '@/lib/prefs';
import { currentUser, readUser, writeUser } from '@/lib/storage';
import type { ReminderSettings } from '@/lib/reminders/settings';
import { setDone, setSnooze } from '@/lib/tasks/local-state';
import { loadPopupInput } from '@/lib/view/load';
import { buildPopupView, type PopupView as View, type TaskRow } from '@/lib/view/popup-view';

// Popup container: renders instantly from stored data, then asks the service
// worker to sync in the background (only if data is older than 15 minutes).

const local = createBrowserStore(browser.storage.local);
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const isDev = import.meta.env.MODE !== 'production';
const uiLanguage = browser.i18n.getUILanguage();

const send = async (message: Message): Promise<unknown> => {
  try {
    return await browser.runtime.sendMessage(message);
  } catch {
    return null;
  }
};

export default function App({ startedAt }: { startedAt: number }) {
  const [view, setView] = useState<View | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [now, setNow] = useState(systemClock.now());
  const [celebrate, setCelebrate] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [openMs, setOpenMs] = useState<number | null>(null);
  const measured = useRef(false);

  const locale = resolveLocale(prefs.locale, uiLanguage);
  const m = messagesFor(locale);

  const reload = useCallback(async () => {
    const [input, stored, permission] = await Promise.all([
      loadPopupInput(local, systemClock, timeZone),
      readPrefs(local),
      browser.notifications.getPermissionLevel().catch(() => 'granted' as const),
    ]);
    setPrefs(stored);
    setNow(input.now);
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
    void reload().then(async () => {
      await send({ type: 'popup/opened' });
      await send({ type: 'sync/request', trigger: 'popup' });
    });
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
    if (view.pendingCount === 1) setCelebrate((n) => n + 1);
  };

  const onCopy = async (scope: CopyScope) => {
    await navigator.clipboard.writeText(formatCopyList(view.copyItems, scope, now, timeZone, m));
    flash(m.popup.copy.copied(m.popup.copy[scope]));
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
        celebrate={celebrate}
        note={note}
        dev={isDev ? { openMs, budgetLimit: DAILY_BUDGET } : null}
        onDone={(e) => void onDone(e)}
        onOpenTask={(url) => void browser.tabs.create({ url })}
        onAddToCalendar={onAddToCalendar}
        onRefresh={() => void send({ type: 'sync/request', trigger: 'manual' })}
        onCopy={(s) => void onCopy(s)}
        onOpenOnboarding={(hash = '') => void browser.tabs.create({ url: browser.runtime.getURL(`/onboarding.html${hash}`) })}
        onOpenSikola={() => void browser.tabs.create({ url: `${SIKOLA_ORIGIN}/my/` })}
        onReport={() => void onReport()}
        onOpenPrivacy={() => void browser.tabs.create({ url: browser.runtime.getURL('/privacy.html') })}
        onSetDueFormat={(dueFormat: DueFormat) => void writePrefs(local, { dueFormat })}
        onSetLocale={(next: Locale) => void writePrefs(local, { locale: next })}
        onSnooze={(eventId, until) => void onSnooze(eventId, until)}
        onSetReminders={(reminders: ReminderSettings) => void writePrefs(local, { reminders })}
        onTestNotification={async () => {
          await send({ type: 'notify/test' });
        }}
      />
    </I18nProvider>
  );
}
