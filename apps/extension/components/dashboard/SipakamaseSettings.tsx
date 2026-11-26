// "Sipakamase" in Pengaturan (1.1.0). Off: one line and "Hubungkan", which
// opens the consent dialog first (useSipakamaseConnect). On: the connection's
// state as one status line, then "Perbarui sekarang", "Buka Sipakamase" and
// "Putuskan" (confirmed). No box or colored background for a problem: the
// status line carries its icon and text (docs/UI.md).

import { useState } from 'react';
import { useI18n } from '@sulo/ui/i18n';
import { Button } from '@sulo/ui/ui/button';
import { SwitchRow } from '@sulo/ui/ui/switch-row';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@sulo/ui/ui/alert-dialog';
import { AlertCircleIcon, CheckCircleIcon, InfoCircleIcon } from '@sulo/ui/dashboard-icons';
import { formatAgo, formatClock } from '@sulo/core/format/time';
import { sipakamaseWords } from '@sulo/core/i18n/sipakamase';
import { SIPAKAMASE_PAGES } from '@sulo/core/sipakamase/allowlist';
import type { ConnState } from '@sulo/core/sipakamase/connection';
import type { RefreshResult } from '@sulo/core/sipakamase/run';
import { lastReadAt } from '@sulo/core/sipakamase/store';
import type { DashboardActions, DashboardData } from './data';
import { timeZone } from './data';
import { useSipakamaseConnect } from './sipakamase-connect';

const STATE_ICON: Record<ConnState, typeof CheckCircleIcon> = {
  off: InfoCircleIcon,
  needs_login: AlertCircleIcon,
  live: CheckCircleIcon,
  resting: CheckCircleIcon,
  paused_idle: InfoCircleIcon,
  paused_remote: InfoCircleIcon,
  broken: AlertCircleIcon,
};

export function SipakamaseSettings({ data, actions }: { data: DashboardData; actions: DashboardActions }) {
  const { locale, m } = useI18n();
  const w = sipakamaseWords(locale);
  const connect = useSipakamaseConnect(actions);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const { module, connection } = data.sipakamase;
  const read = data.sipakamase.data ? lastReadAt(data.sipakamase.data) : null;

  if (!module.enabled) {
    return (
      <div className="space-y-3">
        <p className="max-w-[68ch] text-[14px] leading-normal text-muted-foreground">{w.settingsHelp}</p>
        <Button onClick={connect.start} disabled={connect.busy}>
          {w.connect}
        </Button>
        {connect.notice && (
          <p role="status" className="text-[12px] text-muted-foreground">
            {connect.notice === 'denied' ? w.denied : w.failed}
          </p>
        )}
        {connect.dialog}
      </div>
    );
  }

  const state = connection.state;
  const Icon = STATE_ICON[state];
  const problem = state === 'needs_login' || state === 'broken';
  const refresh = async () => {
    setBusy(true);
    setNote(null);
    const r = (await actions.send({ type: 'sipakamase/refresh' }).catch(() => null)) as RefreshResult | null;
    if (r?.kind === 'wait') setNote(w.wait(formatClock(r.retryAt, timeZone, m)));
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <p role="status" className="flex items-start gap-2 text-[14px] leading-6">
        <Icon aria-hidden="true" className={`mt-1 size-4 shrink-0 ${problem ? 'text-urgency-soon' : 'text-muted-foreground'}`} />
        <span>
          {w.state[state]}
          {read !== null && <span className="text-muted-foreground">{` ${w.updated(formatAgo(read, data.now, m))}`}</span>}
        </span>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {state !== 'paused_remote' && (
            <Button variant="outline" onClick={() => void refresh()} disabled={busy}>
              {busy ? w.refreshing : w.refresh}
            </Button>
          )}
          <Button variant="outline" asChild>
            <a href={SIPAKAMASE_PAGES.kegiatan} target="_blank" rel="noopener noreferrer">
              {w.openSite}
            </a>
          </Button>
        </div>
        <Button variant="destructive-outline" onClick={() => setConfirm(true)}>
          {w.disconnect}
        </Button>
      </div>
      {note && (
        <p role="status" className="text-[12px] text-muted-foreground">
          {note}
        </p>
      )}
      <p className="max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{w.browserClosed}</p>
      <div className="border-t border-border pt-3">
        <SwitchRow checked={data.prefs.mkpkReminders} onChange={(on) => void actions.setPrefs({ mkpkReminders: on })}>
          {w.remindersSwitch}
        </SwitchRow>
        <p className="mt-1 max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{w.remindersHelp}</p>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>{w.disconnect}</AlertDialogTitle>
          <AlertDialogDescription>{w.disconnectConfirm}</AlertDialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <AlertDialogCancel asChild>
              <Button variant="outline">{w.cancel}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive-solid" onClick={() => void actions.send({ type: 'sipakamase/disable' })}>
                {w.disconnect}
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
