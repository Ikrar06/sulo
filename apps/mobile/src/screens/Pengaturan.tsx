// Pengaturan for the phone: notifications and quiet hours (the shared
// reminder panel), academic calendar notifications, due date format,
// privacy mode, the app lock, the language (follows the phone), the bug
// report info, and signing out with all data deleted. Nothing that only
// makes sense in the extension.

import { useEffect, useState } from 'react';
import { CALENDAR_NOTIFY_KINDS } from '@sulo/core/calendar/notify-settings';
import { LANGUAGE_NAMES } from '@sulo/core/i18n';
import { mobileDash } from '@sulo/core/i18n/mobile';
import { mobileWords } from '@sulo/core/i18n/mobile';
import { DUE_FORMATS, type DueFormat } from '@sulo/core/prefs';
import { Card } from '@sulo/ui/card';
import { BugReport } from '@sulo/ui/dashboard/BugReport';
import { useI18n } from '@sulo/ui/i18n';
import { RemindersPanel } from '@sulo/ui/reminders/RemindersPanel';
import { Checkbox } from '@sulo/ui/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@sulo/ui/ui/select';
import { Switch } from '@sulo/ui/ui/switch';
import { LocalNotifications } from '@capacitor/local-notifications';
import { LOCK_KEY, signOutEverything } from '../account';
import { SuloSession } from '../session';
import { timeZone, useMobileData } from '../shell/data';
import { dangerButton, secondaryButton } from './ui';

export function PengaturanScreen({ onSignedOut }: { onSignedOut: () => void }) {
  const { m, locale } = useI18n();
  const d = mobileDash(locale);
  const t = d.pengaturan;
  const w = mobileWords(locale);
  const { data, actions, platform } = useMobileData();
  const prefs = data!.prefs;
  const [lock, setLock] = useState(false);
  const [lockAvailable, setLockAvailable] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [tested, setTested] = useState(false);

  useEffect(() => {
    void platform.store.get<boolean>(LOCK_KEY).then((v) => setLock(v === true));
    void SuloSession.lockAvailable().then((r) => setLockAvailable(r.available));
  }, [platform]);

  const toggleLock = async () => {
    // Turning it on asks for the phone's lock once, so nobody locks themselves out.
    if (!lock && !(await SuloSession.unlock()).unlocked) return;
    await platform.store.set(LOCK_KEY, !lock);
    setLock(!lock);
  };
  const sendTest = async () => {
    await LocalNotifications.schedule({ notifications: [{ id: 1, title: m.notify.testTitle, body: m.notify.testBody, isExactNotification: false }] });
    setTested(true);
  };

  return (
    <div className="m-touch space-y-4">
      <Card title={t.sections.pengingat} className="!px-0 !pb-0 [&>div:first-child]:px-5">
        <RemindersPanel settings={prefs.reminders} timeZone={timeZone} onChange={(reminders) => void actions.setPrefs({ reminders })} onTest={sendTest} onOpenUpdates={() => (window.location.hash = '#kabar')} />
        {tested && (
          <p role="status" className="px-5 pb-4 text-[12px] text-muted-foreground">
            {t.testSent}
          </p>
        )}
      </Card>

      <Card title={t.sections.kalender}>
        <p className="mb-2 text-[12px] leading-normal text-muted-foreground">{t.calendarHelp}</p>
        {CALENDAR_NOTIFY_KINDS.map((k) => (
          <label key={k} className="flex min-h-11 items-center gap-3 text-[14px]">
            <Checkbox checked={prefs.calendar[k]} onCheckedChange={(v) => void actions.setPrefs({ calendar: { ...prefs.calendar, [k]: v === true } })} />
            {t.calendarKinds[k]}
          </label>
        ))}
      </Card>

      <Card title={t.sections.tampilan}>
        <label className="block text-[14px] font-medium" htmlFor="set-due">
          {t.dueFormat}
        </label>
        <Select value={prefs.dueFormat} onValueChange={(v) => void actions.setPrefs({ dueFormat: v as DueFormat })}>
          <SelectTrigger id="set-due" className="mt-2 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DUE_FORMATS.map((f) => (
              <SelectItem key={f} value={f}>
                {m.popup.settings.formats[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Toggle label={w.settings.privacyOn} help={w.settings.privacyHelp} checked={prefs.privacyMode} onChange={(v) => void actions.setPrefs({ privacyMode: v })} />
        <div className="mt-4">
          <p className="text-[14px] font-medium">{w.settings.language}</p>
          <p className="text-[12px] text-muted-foreground">
            {LANGUAGE_NAMES[locale]}. {w.settings.languageNote}
          </p>
        </div>
      </Card>

      <Card title={w.connected.lock}>
        <Toggle label={w.connected.lock} help={lockAvailable ? w.connected.lockHelp : w.connected.lockUnavailable} checked={lock} disabled={!lockAvailable} onChange={() => void toggleLock()} />
      </Card>

      <Card title={t.bugReport.cardTitle}>
        <p className="mb-3 text-[12px] leading-normal text-muted-foreground">{w.settings.bugHelp}</p>
        <BugReport d={d} lastSyncAt={data!.view.lastSyncAt} store={platform.store} version={__SULO_VERSION__} buttonClassName="w-full" />
      </Card>

      <Card title={t.sections.data}>
        {confirm ? (
          <div role="alertdialog" aria-labelledby="signout-title" className="space-y-2">
            <h3 id="signout-title" className="text-[16px] font-semibold">
              {w.connected.signOutTitle}
            </h3>
            <p className="text-[14px] text-muted-foreground">{w.connected.signOutBody}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={secondaryButton} onClick={() => setConfirm(false)}>
                {w.connected.cancel}
              </button>
              <button
                type="button"
                className={dangerButton}
                onClick={async () => {
                  await signOutEverything(platform);
                  onSignedOut();
                }}
              >
                {w.settings.signOutDelete}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={`${dangerButton} w-full`} onClick={() => setConfirm(true)}>
            {w.settings.signOutDelete}
          </button>
        )}
      </Card>
    </div>
  );
}

function Toggle({ label, help, checked, disabled = false, onChange }: { label: string; help: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-4 flex min-h-11 items-center gap-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium">{label}</span>
        <span className="block text-[12px] text-muted-foreground">{help}</span>
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}
