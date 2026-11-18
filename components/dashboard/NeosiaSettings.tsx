// "NEOSIA" in Pengaturan (M7 part D). The switch opens the consent dialog
// first; only "Hubungkan" asks Chrome for the permissions (it must happen
// inside that click). Cancel, or a refused permission, leaves the switch off.

import { useId, useState } from 'react';
import { browser } from 'wxt/browser';
import { useI18n } from '@/components/i18n';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { formatAgo } from '@/lib/format/time';
import { neosiaWords } from '@/lib/i18n/neosia';
import { NEOSIA_APP_ORIGIN } from '@/lib/neosia/allowlist';
import { neosiaPermissionRequest } from '@/lib/neosia/browser-deps';
import type { EnableResult } from '@/lib/neosia/module';
import { neosiaStatus } from '@/lib/neosia/view';
import type { DashboardActions, DashboardData } from './data';
import { NeosiaConsent } from './NeosiaConsent';

type Notice = 'denied' | 'failed' | null;

export function NeosiaSettings({ data, actions }: { data: DashboardData; actions: DashboardActions }) {
  const { m, locale } = useI18n();
  const w = neosiaWords(locale);
  const s = w.settings;
  const switchId = useId();
  const privacyId = useId();
  const [consentOpen, setConsentOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const enabled = data.neosia.module.enabled;
  const status = neosiaStatus(data.neosia.snapshots);

  const connect = () => {
    setNotice(null);
    setBusy(true);
    // Called straight from the click: Chrome shows its own permission prompt now.
    void browser.permissions
      .request(neosiaPermissionRequest())
      .then(async (granted) => {
        if (!granted) {
          setNotice('denied');
          return;
        }
        const result = (await actions.send({ type: 'neosia/enable' })) as EnableResult | null;
        if (result !== 'enabled') setNotice(result === 'no_permission' ? 'denied' : 'failed');
      })
      .catch(() => setNotice('failed'))
      .finally(() => {
        setBusy(false);
        setConsentOpen(false);
      });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor={switchId} className="text-[14px] leading-6 font-semibold">
            {s.switchLabel}
          </label>
          <p className="max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{s.help}</p>
        </div>
        <Switch
          id={switchId}
          className="mt-1"
          checked={enabled || consentOpen}
          disabled={busy}
          onCheckedChange={(on) => {
            if (on) setConsentOpen(true);
            else setDisconnectOpen(true);
          }}
        />
      </div>

      {notice && (
        <p role="status" className="text-[12px] text-muted-foreground">
          {notice === 'denied' ? s.denied : s.failed}
        </p>
      )}

      {enabled && (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-[14px]" role="status">
            {status.lastSeenAt === null ? s.openOnce : s.lastUpdated(formatAgo(status.lastSeenAt, data.now, m))}
          </p>
          {status.changedShape.length > 0 && <p className="text-[12px] text-muted-foreground">{w.changedShape}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href={NEOSIA_APP_ORIGIN} target="_blank" rel="noopener noreferrer">
                {w.openNeosia}
              </a>
            </Button>
            <Button variant="outline" onClick={() => setDisconnectOpen(true)}>
              {s.disconnect}
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
        <div className="min-w-0">
          <label htmlFor={privacyId} className="text-[14px] leading-6 font-semibold">
            {s.privacyMode}
          </label>
          <p className="max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{s.privacyHelp}</p>
        </div>
        <Switch id={privacyId} className="mt-1" checked={data.prefs.privacyMode} onCheckedChange={(on) => void actions.setPrefs({ privacyMode: on })} />
      </div>

      <NeosiaConsent open={consentOpen} busy={busy} onCancel={() => setConsentOpen(false)} onConnect={connect} />

      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>{s.disconnectTitle}</AlertDialogTitle>
          <AlertDialogDescription>{s.disconnectBody}</AlertDialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <AlertDialogCancel asChild>
              <Button variant="outline">{s.cancel}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive-solid" onClick={() => void actions.send({ type: 'neosia/disable' })}>
                {s.disconnect}
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
