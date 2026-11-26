// Pengaturan > Sipakamase on the phone (1.1.0). Off: one row, "Hubungkan",
// which opens the consent sheet. On: the connection as one line, then
// Perbarui sekarang (or Masuk lagi when the session ended), Pengingat MKPK,
// and a confirmed Putuskan.

import { useState } from 'react';
import { formatAgo, formatClock } from '@sulo/core/format/time';
import { sipakamaseWords } from '@sulo/core/i18n/sipakamase';
import { lastReadAt } from '@sulo/core/sipakamase/store';
import { useI18n } from '@sulo/ui/i18n';
import { PillButton, Toggle } from '@sulo/ui/mobile/controls';
import { Sheet } from '@sulo/ui/mobile/sheet';
import { useMobileData } from '../../shell/data';
import { useSipakamase } from '../../sipakamase/SipakamaseProvider';
import { Group, Row } from '../settings-rows';

const ring = 'outline-none focus-ring:ring-2 focus-ring:ring-focus';
const rowLine = '[&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line';

export function SipakamaseSettings() {
  const { locale, m } = useI18n();
  const w = sipakamaseWords(locale);
  const sip = useSipakamase();
  const { data, actions } = useMobileData();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const now = data!.now;

  if (!sip.enabled) {
    return (
      <Group title={w.settingsTitle} help={w.phoneHelp}>
        <button type="button" onClick={sip.ask} className={`m-hit flex min-h-12 w-full items-center text-left text-m15 ${ring}`}>
          {w.connect}
        </button>
      </Group>
    );
  }

  const state = sip.connection.state;
  const read = sip.data ? lastReadAt(sip.data) : null;
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setNote(null);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };
  const refresh = () =>
    run(async () => {
      const r = await sip.refresh();
      if (r.kind === 'wait') setNote(w.wait(formatClock(r.retryAt, Intl.DateTimeFormat().resolvedOptions().timeZone, m)));
    });

  return (
    <>
      <Group title={w.settingsTitle}>
        <div role="status" className={`py-3 ${rowLine}`}>
          <p className="text-m15">{w.state[state]}</p>
          {read !== null && <p className="mt-1 text-m13 text-muted-foreground">{w.updated(formatAgo(read, now, m))}</p>}
          {note && <p className="mt-1 text-m13 text-muted-foreground">{note}</p>}
        </div>
        {state === 'needs_login' || state === 'paused_idle' ? (
          <button type="button" disabled={busy} onClick={() => void run(async () => void (await sip.signIn()))} className={`m-hit flex min-h-12 w-full items-center text-left text-m15 ${rowLine} ${ring}`}>
            {w.signInAgain}
          </button>
        ) : state !== 'paused_remote' ? (
          <button type="button" disabled={busy} onClick={() => void refresh()} className={`m-hit flex min-h-12 w-full items-center text-left text-m15 ${rowLine} ${ring}`}>
            {busy ? w.refreshing : w.refresh}
          </button>
        ) : null}
        <Row label={w.remindersSwitch} help={w.remindersHelp}>
          <Toggle checked={data!.prefs.mkpkReminders} label={w.remindersSwitch} onChange={(v) => void actions.setPrefs({ mkpkReminders: v })} />
        </Row>
        <button type="button" onClick={() => setConfirm(true)} className={`m-hit flex min-h-12 w-full items-center text-left text-m15 text-urgency-overdue ${ring}`}>
          {w.disconnect}
        </button>
      </Group>

      <Sheet open={confirm} onOpenChange={(o) => !o && setConfirm(false)} title={w.disconnect}>
        <div className="space-y-4">
          <p className="text-m15r text-muted-foreground">{w.disconnectConfirm}</p>
          <PillButton
            danger
            full
            disabled={busy}
            onPress={() =>
              void run(async () => {
                await sip.disconnect();
                setConfirm(false);
              })
            }
          >
            {w.disconnect}
          </PillButton>
          <PillButton full onPress={() => setConfirm(false)}>
            {w.cancel}
          </PillButton>
        </div>
      </Sheet>
    </>
  );
}
