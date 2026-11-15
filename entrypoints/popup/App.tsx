import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { PopupView } from '@/components/popup/PopupView';
import { createBrowserStore } from '@/lib/browser-store';
import { systemClock } from '@/lib/clock';
import { formatCopyList, type CopyFormat, type CopyScope } from '@/lib/format/copy-list';
import { id } from '@/lib/i18n/id';
import type { Message } from '@/lib/messages';
import { DAILY_BUDGET, SIKOLA_ORIGIN } from '@/lib/moodle/limits';
import { currentUser, readUser, writeUser } from '@/lib/storage';
import { setDone } from '@/lib/tasks/local-state';
import { loadPopupInput } from '@/lib/view/load';
import { buildPopupView, type MascotState, type PopupView as View } from '@/lib/view/popup-view';

// Popup container: renders instantly from stored data, then asks the service
// worker to sync in the background (only if data is older than 15 minutes).

const local = createBrowserStore(browser.storage.local);
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const isDev = import.meta.env.MODE !== 'production';

const send = async (message: Message): Promise<unknown> => {
  try {
    return await browser.runtime.sendMessage(message);
  } catch {
    return null;
  }
};

export default function App({ startedAt }: { startedAt: number }) {
  const [view, setView] = useState<View | null>(null);
  const [now, setNow] = useState(systemClock.now());
  const [mascotOverride, setMascotOverride] = useState<MascotState | undefined>();
  const [copiedNote, setCopiedNote] = useState<string | null>(null);
  const [openMs, setOpenMs] = useState<number | null>(null);
  const measured = useRef(false);

  const reload = useCallback(async () => {
    const input = await loadPopupInput(local, systemClock, timeZone);
    setNow(input.now);
    setView(buildPopupView(input));
  }, []);

  useEffect(() => {
    void reload().then(async () => {
      await send({ type: 'popup/opened' });
      await send({ type: 'sync/request', trigger: 'popup' });
    });
    const onChange = (_changes: unknown, area: string) => {
      if (area === 'local') void reload();
    };
    browser.storage.onChanged.addListener(onChange);
    return () => browser.storage.onChanged.removeListener(onChange);
  }, [reload]);

  useEffect(() => {
    if (view && !measured.current) {
      measured.current = true;
      setOpenMs(Math.round(performance.now() - startedAt));
    }
  }, [view, startedAt]);

  if (!view) return null;

  const onDone = async (eventId: number) => {
    const userId = await currentUser(local);
    if (userId === null) return;
    const state = await readUser(local, userId, 'taskState');
    await writeUser(local, userId, 'taskState', setDone(state, eventId, true));
    if (view.pendingCount === 1) {
      setMascotOverride('celebrate');
      window.setTimeout(() => setMascotOverride(undefined), 1600);
    }
  };

  const onCopy = async (scope: CopyScope, format: CopyFormat) => {
    await navigator.clipboard.writeText(formatCopyList(view.copyItems, scope, format, now, timeZone));
    setCopiedNote(`${id.popup.copy.copied}: ${id.popup.copy[scope]} (${id.popup.copy[format]})`);
    window.setTimeout(() => setCopiedNote(null), 2500);
  };

  const onReport = async () => {
    // Diagnostic text without personal data, for the tester to send to the maintainer.
    const outcome = (await local.get<{ lastOutcome?: { status: string; where?: string } }>('global:syncStatus'))?.lastOutcome;
    const info = `Sulo ${browser.runtime.getManifest().version}: ${outcome?.status ?? '-'} ${outcome?.where ?? ''} (${new Date().toISOString().slice(0, 16)})`;
    await navigator.clipboard.writeText(info.trim());
    setCopiedNote(`${id.popup.copy.copied}: ${info.trim()}`);
  };

  return (
    <PopupView
      view={view}
      now={now}
      mascotOverride={mascotOverride}
      copiedNote={copiedNote}
      dev={isDev ? { openMs, budgetLimit: DAILY_BUDGET } : null}
      onDone={(e) => void onDone(e)}
      onOpenTask={(url) => void browser.tabs.create({ url })}
      onRefresh={() => void send({ type: 'sync/request', trigger: 'manual' })}
      onCopy={(s, f) => void onCopy(s, f)}
      onOpenOnboarding={(hash = '') => void browser.tabs.create({ url: browser.runtime.getURL(`/onboarding.html${hash}`) })}
      onOpenSikola={() => void browser.tabs.create({ url: `${SIKOLA_ORIGIN}/my/` })}
      onReport={() => void onReport()}
      onOpenPrivacy={() => void browser.tabs.create({ url: browser.runtime.getURL('/privacy.html') })}
    />
  );
}
