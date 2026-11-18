// Pengaturan (M8c.1, cards): one group card per topic, switches instead of
// checkboxes, and times or formats as a value on the right that opens a
// bottom sheet. Pengingat, Jam tenang, Ringkasan pagi, Kalender akademik,
// Tampilan, Keamanan, Laporan bug, Data. Only what makes sense on a phone;
// every value is the same prefs field the extension uses.

import { useEffect, useState, type ReactNode } from 'react';
import { CALENDAR_NOTIFY_KINDS } from '@sulo/core/calendar/notify-settings';
import { formatClock } from '@sulo/core/format/time';
import { LANGUAGE_NAMES } from '@sulo/core/i18n';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import { readTechLog } from '@sulo/core/net/tech-log';
import { DUE_FORMATS, NICKNAME_MAX, normalizeNickname, type DueFormat } from '@sulo/core/prefs';
import { STAGE_OPTIONS, type StageMin } from '@sulo/core/reminders/settings';
import { zonedToUnix } from '@sulo/core/reminders/zoned';
import { readSyncStatus } from '@sulo/core/storage';
import { buildBugReport } from '@sulo/core/support/bug-report';
import { useI18n } from '@sulo/ui/i18n';
import { ChevronRightIcon } from '@sulo/ui/icons';
import { PillButton, Toggle } from '@sulo/ui/mobile/controls';
import { Sheet, SheetOptions } from '@sulo/ui/mobile/sheet';
import { Input } from '@sulo/ui/ui/input';
import { stageAmount } from '@sulo/ui/reminders/RemindersPanel';
import { LocalNotifications } from '@capacitor/local-notifications';
import { LOCK_KEY } from '../account';
import { SuloSession } from '../session';
import { timeZone, useMobileData } from '../shell/data';

const HOURS = Array.from({ length: 24 }, (_, h) => h * 60);

type Picker = 'quietStart' | 'quietEnd' | 'morning' | 'snooze' | 'due' | 'nickname' | null;

import { SignOutSheet } from './SignOutSheet';
export function PengaturanScreen({ onSignedOut }: { onSignedOut: () => void }) {
  const { m, locale } = useI18n();
  const d = mobileDash(locale);
  const t = d.pengaturan;
  const w = mobileWords(locale);
  const r = m.popup.reminders;
  const { data, actions, platform } = useMobileData();
  const prefs = data!.prefs;
  const rem = prefs.reminders;
  const [lock, setLock] = useState(false);
  const [lockAvailable, setLockAvailable] = useState(false);
  const [picker, setPicker] = useState<Picker>(null);
  const [confirm, setConfirm] = useState(false);
  const [bug, setBug] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [nickname, setNickname] = useState(prefs.nickname);

  useEffect(() => {
    void platform.store.get<boolean>(LOCK_KEY).then((v) => setLock(v === true));
    void SuloSession.lockAvailable().then((x) => setLockAvailable(x.available));
  }, [platform]);

  const hour = (min: number) => formatClock(zonedToUnix('2026-01-01', min, timeZone), timeZone, m);
  const setRem = (patch: Partial<typeof rem>) => void actions.setPrefs({ reminders: { ...rem, ...patch } });
  const toggleStage = (s: StageMin, on: boolean) => {
    const next = on ? [...rem.stages, s] : rem.stages.filter((x) => x !== s);
    // At least one stage stays.
    if (next.length === 0) return setNote(r.atLeastOne);
    setNote('');
    setRem({ stages: [...new Set(next)].sort((a, b) => b - a) as StageMin[] });
  };
  const toggleLock = async () => {
    // Turning it on asks for the phone's lock once, so nobody locks themselves out.
    if (!lock && !(await SuloSession.unlock()).unlocked) return;
    await platform.store.set(LOCK_KEY, !lock);
    setLock(!lock);
  };
  const openBug = async () => {
    const [log, status] = await Promise.all([readTechLog(platform.store), readSyncStatus(platform.store)]);
    setBug(buildBugReport({ version: __SULO_VERSION__, userAgent: navigator.userAgent, lastSyncAt: data!.view.lastSyncAt, lastAttemptAt: status.lastAttemptAt, lastOutcome: status.lastOutcome, log }));
  };
  const lastStage = Math.min(...rem.stages) as StageMin;

  return (
    <div className="space-y-6">
      <Group title={t.sections.pengingat}>
        <Row label={r.enabled}>
          <Toggle checked={rem.enabled} label={r.enabled} onChange={(v) => setRem({ enabled: v })} />
        </Row>
        {STAGE_OPTIONS.map((s) => (
          <Row key={s} label={r.stage(stageAmount(s, m))} dim={!rem.enabled}>
            <Toggle checked={rem.stages.includes(s)} disabled={!rem.enabled} label={r.stage(stageAmount(s, m))} onChange={(v) => toggleStage(s, v)} />
          </Row>
        ))}
        {note && (
          <p role="status" className="py-2 text-m13 text-muted-foreground">
            {note}
          </p>
        )}
        <Row label={r.test}>
          <PillButton
            small
            onPress={async () => {
              await LocalNotifications.schedule({ notifications: [{ id: 1, title: m.notify.testTitle, body: m.notify.testBody, isExactNotification: false }] });
              setNote(t.testSent);
            }}
          >
            {w.app.send}
          </PillButton>
        </Row>
      </Group>

      <Group title={r.quiet}>
        <Row label={r.quietOn}>
          <Toggle checked={rem.quiet.enabled} label={r.quietOn} onChange={(v) => setRem({ quiet: { ...rem.quiet, enabled: v } })} />
        </Row>
        <ValueRow label={r.from} value={hour(rem.quiet.startMin)} disabled={!rem.quiet.enabled} onPress={() => setPicker('quietStart')} />
        <ValueRow label={r.to} value={hour(rem.quiet.endMin)} disabled={!rem.quiet.enabled} onPress={() => setPicker('quietEnd')} />
        <Row label={r.lastStage(stageAmount(lastStage, m))} dim={!rem.quiet.enabled}>
          <Toggle checked={rem.lastStageDuringQuiet} disabled={!rem.quiet.enabled} label={r.lastStage(stageAmount(lastStage, m))} onChange={(v) => setRem({ lastStageDuringQuiet: v })} />
        </Row>
      </Group>

      <Group title={r.morning}>
        <Row label={r.morningOn}>
          <Toggle checked={rem.morning.enabled} label={r.morningOn} onChange={(v) => setRem({ morning: { ...rem.morning, enabled: v } })} />
        </Row>
        <ValueRow label={r.at} value={hour(rem.morning.atMin)} disabled={!rem.morning.enabled} onPress={() => setPicker('morning')} />
        <ValueRow label={r.snoozeMorning} value={hour(rem.snoozeMorningMin)} onPress={() => setPicker('snooze')} />
      </Group>

      <Group title={t.sections.kalender} help={t.calendarHelp}>
        {CALENDAR_NOTIFY_KINDS.map((k) => (
          <Row key={k} label={t.calendarKinds[k]}>
            <Toggle checked={prefs.calendar[k]} label={t.calendarKinds[k]} onChange={(v) => void actions.setPrefs({ calendar: { ...prefs.calendar, [k]: v } })} />
          </Row>
        ))}
      </Group>

      <Group title={t.sections.tampilan}>
        <ValueRow
          label={t.nickname}
          value={prefs.nickname || '–'}
          onPress={() => {
            setNickname(prefs.nickname);
            setPicker('nickname');
          }}
        />
        <ValueRow label={t.dueFormat} value={m.popup.settings.formats[prefs.dueFormat]} onPress={() => setPicker('due')} />
        <Row label={w.settings.privacyOn} help={w.settings.privacyHelp}>
          <Toggle checked={prefs.privacyMode} label={w.settings.privacyOn} onChange={(v) => void actions.setPrefs({ privacyMode: v })} />
        </Row>
        <Row label={w.settings.language} help={w.settings.languageNote}>
          <span className="text-m13 text-muted-foreground">{LANGUAGE_NAMES[locale]}</span>
        </Row>
      </Group>

      <Group title={w.connected.lock}>
        <Row label={w.connected.lock} help={lockAvailable ? w.connected.lockHelp : w.connected.lockUnavailable}>
          <Toggle checked={lock} disabled={!lockAvailable} label={w.connected.lock} onChange={() => void toggleLock()} />
        </Row>
      </Group>

      <Group title={t.bugReport.cardTitle} help={w.settings.bugHelp}>
        <ValueRow label={t.bugReport.button} value="" onPress={() => void openBug()} />
      </Group>

      <Group title={t.sections.data}>
        <button type="button" onClick={() => setConfirm(true)} className="m-hit flex min-h-12 w-full items-center text-left text-m15 text-urgency-overdue outline-none focus-ring:ring-2 focus-ring:ring-focus">
          {w.settings.signOutDelete}
        </button>
      </Group>

      <Sheet open={picker !== null} onOpenChange={(o) => !o && setPicker(null)} title={picker === 'nickname' ? t.nickname : picker === 'due' ? t.dueFormat : picker === 'quietStart' ? `${r.quiet}: ${r.from}` : picker === 'quietEnd' ? `${r.quiet}: ${r.to}` : picker === 'morning' ? r.morning : r.snoozeMorning}>
        {picker === 'nickname' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void actions.setPrefs({ nickname: normalizeNickname(nickname) });
              setPicker(null);
            }}
          >
            <Input autoFocus aria-label={t.nickname} maxLength={NICKNAME_MAX} value={nickname} onChange={(e) => setNickname(e.target.value)} />
            <p className="mt-2 text-m13 text-muted-foreground">{w.settings.nicknameHelp}</p>
            <button type="submit" className="m-hit m-press mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-m15 text-primary-foreground outline-none focus-ring:ring-2 focus-ring:ring-focus">
              {w.app.doneSheet}
            </button>
          </form>
        ) : picker === 'due' ? (
          <SheetOptions
            value={prefs.dueFormat}
            options={DUE_FORMATS.map((f) => ({ value: f, label: m.popup.settings.formats[f] }))}
            onChoose={(v: DueFormat) => {
              void actions.setPrefs({ dueFormat: v });
              setPicker(null);
            }}
          />
        ) : picker !== null ? (
          <div className="max-h-[50dvh] overflow-y-auto">
            <SheetOptions
              value={picker === 'quietStart' ? rem.quiet.startMin : picker === 'quietEnd' ? rem.quiet.endMin : picker === 'morning' ? rem.morning.atMin : rem.snoozeMorningMin}
              options={HOURS.map((h) => ({ value: h, label: hour(h) }))}
              onChoose={(v: number) => {
                if (picker === 'quietStart') setRem({ quiet: { ...rem.quiet, startMin: v } });
                else if (picker === 'quietEnd') setRem({ quiet: { ...rem.quiet, endMin: v } });
                else if (picker === 'morning') setRem({ morning: { ...rem.morning, atMin: v } });
                else setRem({ snoozeMorningMin: v });
                setPicker(null);
              }}
            />
          </div>
        ) : null}
      </Sheet>

      <Sheet open={bug !== null} onOpenChange={(o) => !o && setBug(null)} title={t.bugReport.title}>
        <p className="text-m13 text-muted-foreground">{t.bugReport.body}</p>
        <pre className="mt-3 max-h-64 overflow-auto rounded-ctl bg-m-inset p-3 text-m12 font-normal whitespace-pre-wrap">{bug}</pre>
        <div className="mt-4">
          <PillButton
            kind="primary"
            full
            onPress={async () => {
              await navigator.clipboard.writeText(bug ?? '').catch(() => undefined);
              setBug(null);
              setNote(w.settings.copied);
            }}
          >
            {t.bugReport.copy}
          </PillButton>
        </div>
      </Sheet>

      <SignOutSheet open={confirm} onOpenChange={setConfirm} onSignedOut={onSignedOut} />
    </div>
  );
}

function Group({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-m13 font-semibold text-muted-foreground">{title}</h2>
      <div className="m-card rounded-card px-4 py-1">{children}</div>
      {help && <p className="mt-2 px-1 text-m12 font-normal text-muted-foreground">{help}</p>}
    </section>
  );
}

/** A setting: its label (and help) on the left, its control on the right; an inset hairline between rows. */
function Row({ label, help, dim = false, children }: { label: string; help?: string; dim?: boolean; children: ReactNode }) {
  return (
    <div className={`flex min-h-12 items-center gap-3 py-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line ${dim ? 'opacity-50' : ''}`}>
      <span className="min-w-0 flex-1">
        <span className="block text-m15 font-normal">{label}</span>
        {help && <span className="block text-m12 font-normal text-muted-foreground">{help}</span>}
      </span>
      {children}
    </div>
  );
}

/** A value on the right that opens a bottom sheet. */
function ValueRow({ label, value, onPress, disabled = false }: { label: string; value: string; onPress: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onPress} className="m-hit flex min-h-12 w-full items-center gap-3 py-2 text-left outline-none disabled:opacity-50 focus-ring:ring-2 focus-ring:ring-focus [&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line">
      <span className="min-w-0 flex-1 text-m15 font-normal">{label}</span>
      {value && <span className="text-m13 text-muted-foreground tabular-nums">{value}</span>}
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
