// "NEOSIA" in Pengaturan (M7 part D). The switch opens the consent dialog
// first (useNeosiaConnect); only "Hubungkan" asks Chrome for the permissions.
// Cancel, or a refused permission, leaves the switch off.

import { useId, useState } from 'react';
import { useI18n } from '@/components/i18n';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { DEFAULT_SKS_TARGET, SKS_TARGET_MAX, SKS_TARGET_MIN } from '@/lib/neosia/view';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { formatAgo } from '@/lib/format/time';
import { neosiaWords } from '@/lib/i18n/neosia';
import { neosiaUrl } from '@/lib/links';
import { neosiaStatus } from '@/lib/neosia/view';
import type { DashboardActions, DashboardData } from './data';
import { useNeosiaConnect } from './neosia-connect';

export function NeosiaSettings({ data, actions }: { data: DashboardData; actions: DashboardActions }) {
  const { m, locale } = useI18n();
  const w = neosiaWords(locale);
  const s = w.settings;
  const switchId = useId();
  const privacyId = useId();
  const targetId = useId();
  const [target, setTarget] = useState(String(data.prefs.sksTarget));
  const saveTarget = () => {
    const n = Number(target);
    const next = Number.isInteger(n) && n >= SKS_TARGET_MIN && n <= SKS_TARGET_MAX ? n : DEFAULT_SKS_TARGET;
    setTarget(String(next));
    if (next !== data.prefs.sksTarget) void actions.setPrefs({ sksTarget: next });
  };
  const consent = useNeosiaConnect(actions);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const enabled = data.neosia.module.enabled;
  const status = neosiaStatus(data.neosia.snapshots);
  const notice = consent.notice;

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
          checked={enabled || consent.open}
          disabled={consent.busy}
          onCheckedChange={(on) => {
            if (on) consent.start();
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" asChild>
              <a href={neosiaUrl()} target="_blank" rel="noopener noreferrer">
                {w.openNeosia}
              </a>
            </Button>
            {/* Apart from "Buka NEOSIA": a secondary danger button. */}
            <Button variant="destructive-outline" onClick={() => setDisconnectOpen(true)}>
              {s.disconnect}
            </Button>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4 border-t border-border pt-4">
            <div className="min-w-0">
              <label htmlFor={targetId} className="text-[14px] leading-6 font-semibold">
                {s.sksTarget}
              </label>
              <p className="max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{s.sksTargetHelp}</p>
            </div>
            <Input
              id={targetId}
              type="number"
              inputMode="numeric"
              min={SKS_TARGET_MIN}
              max={SKS_TARGET_MAX}
              className="w-24 tabular-nums"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onBlur={saveTarget}
              onKeyDown={(e) => e.key === 'Enter' && saveTarget()}
            />
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

      {consent.dialog}

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
