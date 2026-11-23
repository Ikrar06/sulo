// Pengaturan (M8c.1, cards): one group card per topic, switches instead of
// checkboxes, and times or formats as a value on the right that opens a
// bottom sheet. Pengingat, Jam tenang, Ringkasan pagi, Kalender akademik,
// Tampilan, NEOSIA (once connected), Keamanan, Laporan bug, Data. Only what makes sense on a phone;
// every value is the same prefs field the extension uses.

import { useCallback, useEffect, useRef, useState } from 'react';
import { CALENDAR_NOTIFY_KINDS } from '@sulo/core/calendar/notify-settings';
import { formatClock } from '@sulo/core/format/time';
import { LANGUAGE_NAMES } from '@sulo/core/i18n';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import { NOTIFY_SOUNDS, type NotifySound } from '@sulo/core/notify/channels';
import { readTechLog } from '@sulo/core/net/tech-log';
import { ANIMATION_PREFS, type AnimationPref } from '@sulo/core/perf/tier';
import { DUE_FORMATS, NICKNAME_MAX, normalizeNickname, type DueFormat } from '@sulo/core/prefs';
import { STAGE_OPTIONS, type StageMin } from '@sulo/core/reminders/settings';
import { zonedToUnix } from '@sulo/core/reminders/zoned';
import { readSyncStatus } from '@sulo/core/storage';
import { buildBugReport } from '@sulo/core/support/bug-report';
import { useI18n } from '@sulo/ui/i18n';
import { PillButton, Toggle } from '@sulo/ui/mobile/controls';
import { Sheet, SheetOptions, SheetTextForm, afterSheetClosed } from '@sulo/ui/mobile/sheet';
import { stageAmount } from '@sulo/ui/reminders/RemindersPanel';
import { changeNotifySound, previewFile, readNotifySound } from '../notify-sound';
import { notificationsAllowed, scheduleOnChannels } from '../platform/notifications';
import { scheduleReminders } from '../reminders';
import { applyWatchPlan } from '../watch-native';
import { LOCK_KEY } from '../account';
import { setAnimationPref } from '../perf';
import { SuloSession } from '../session';
import { timeZone, useMobileData } from '../shell/data';

const HOURS = Array.from({ length: 24 }, (_, h) => h * 60);

type Picker = 'quietStart' | 'quietEnd' | 'morning' | 'snooze' | 'due' | 'nickname' | 'animation' | 'sound' | null;

import { SignOutSheet } from './SignOutSheet';
import { Group, Row, ValueRow } from './settings-rows';
import { WatchSettings } from './WatchSettings';
import { NeosiaSettings } from './neosia/NeosiaSettings';
export function PengaturanScreen({ onSignedOut, section = null }: { onSignedOut: () => void; section?: string | null }) {
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
  // The notification sound: the saved choice, its preview, and whether it changed while the sheet was open.
  const [sound, setSound] = useState<NotifySound | null>(null);
  const preview = useRef<HTMLAudioElement | null>(null);
  const soundChanged = useRef(false);
  const stopPreview = useCallback(() => {
    preview.current?.pause();
    preview.current = null;
  }, []);
  // Leaving the screen with a preview still playing: it stops.
  useEffect(() => stopPreview, [stopPreview]);
  const chooseSound = (next: NotifySound) => {
    // The preview is ordinary media playback: once, at the phone's media volume. "Bawaan HP" and "Senyap" have nothing to play.
    stopPreview();
    const file = previewFile(next);
    if (file) {
      const audio = new Audio(new URL(file, document.baseURI).href);
      preview.current = audio;
      void audio.play().catch(() => undefined);
    }
    if (next === sound) return;
    setSound(next);
    soundChanged.current = true;
    // Saved at once, and the channels swapped: the new sound's are made, the previous one's removed. No permission is asked.
    void changeNotifySound(platform.store, next);
  };
  const closeSound = () => {
    stopPreview();
    if (!soundChanged.current) return;
    soundChanged.current = false;
    // What is already scheduled names the previous sound's channels: plan again, and tell the background worker.
    void scheduleReminders(platform).catch(() => 0);
    void applyWatchPlan(platform).catch(() => undefined);
  };

  useEffect(() => {
    void readNotifySound(platform.store).then(setSound);
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
      <WatchSettings lock={lock} lockAvailable={lockAvailable} onLockOn={() => setLock(true)} after={<ValueRow label={w.notifySound.label} value={sound ? w.notifySound.options[sound] : ''} onPress={() => setPicker('sound')} />} />

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
              // Without permission the test would make Android ask; that question is the onboarding's alone.
              if (!(await notificationsAllowed())) return setNote(w.notify.denied);
              // On the reminders' channel, so it sounds as a real reminder will.
              await scheduleOnChannels(platform.store, [{ id: 1, title: m.notify.testTitle, body: m.notify.testBody, extra: { suloId: 'test|1' }, isExactNotification: false }]);
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
            setPicker('nickname');
          }}
        />
        <ValueRow label={t.dueFormat} value={m.popup.settings.formats[prefs.dueFormat]} onPress={() => setPicker('due')} />
        <ValueRow label={w.settings.animation} help={w.settings.animationHelp} value={w.settings.animationOptions[prefs.animation]} onPress={() => setPicker('animation')} />
        <Row label={w.settings.privacyOn} help={w.settings.privacyHelp}>
          <Toggle checked={prefs.privacyMode} label={w.settings.privacyOn} onChange={(v) => void actions.setPrefs({ privacyMode: v })} />
        </Row>
        <Row label={w.settings.language} help={w.settings.languageNote}>
          <span className="text-m13 text-muted-foreground">{LANGUAGE_NAMES[locale]}</span>
        </Row>
      </Group>

      <NeosiaSettings scrollTo={section === 'neosia'} />

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

      <Sheet
        open={picker !== null}
        onOpenChange={(o) => {
          if (o) return;
          if (picker === 'sound') closeSound();
          setPicker(null);
        }}
        title={picker === 'nickname' ? t.nickname : picker === 'due' ? t.dueFormat : picker === 'sound' ? w.notifySound.label : picker === 'animation' ? w.settings.animation : picker === 'quietStart' ? `${r.quiet}: ${r.from}` : picker === 'quietEnd' ? `${r.quiet}: ${r.to}` : picker === 'morning' ? r.morning : r.snoozeMorning}>
        {picker === 'nickname' ? (
          <SheetTextForm label={t.nickname} initial={prefs.nickname} maxLength={NICKNAME_MAX} help={w.settings.nicknameHelp} submitLabel={w.app.doneSheet} onSave={(v) => void actions.setPrefs({ nickname: normalizeNickname(v) })} />
        ) : picker === 'due' ? (
          <SheetOptions
            value={prefs.dueFormat}
            options={DUE_FORMATS.map((f) => ({ value: f, label: m.popup.settings.formats[f] }))}
            onChoose={(v: DueFormat) => {
              void actions.setPrefs({ dueFormat: v });
              setPicker(null);
            }}
          />
        ) : picker === 'sound' ? (
          <>
            {/* Stays open after a choice, so the sounds can be tried one after another; each tap plays its preview once. */}
            <SheetOptions value={sound ?? NOTIFY_SOUNDS[0]} options={NOTIFY_SOUNDS.map((s) => ({ value: s, label: w.notifySound.options[s] }))} onChoose={chooseSound} />
            <p className="mt-3 px-1 text-m12 font-normal text-muted-foreground">{w.notifySound.help}</p>
          </>
        ) : picker === 'animation' ? (
          <SheetOptions
            value={prefs.animation}
            options={ANIMATION_PREFS.map((a) => ({ value: a, label: w.settings.animationOptions[a] }))}
            onChoose={(v: AnimationPref) => {
              // The setting is written at once; the motion changes once the sheet is gone.
              void actions.setPrefs({ animation: v });
              setPicker(null);
              afterSheetClosed(() => setAnimationPref(v));
            }}
          />
        ) : picker !== null ? (
          <div className="max-h-[50dvh] overflow-y-auto">
            <SheetOptions
              value={picker === 'quietStart' ? rem.quiet.startMin : picker === 'quietEnd' ? rem.quiet.endMin : picker === 'morning' ? rem.morning.atMin : rem.snoozeMorningMin}
              options={HOURS.map((h) => ({ value: h, label: hour(h) }))}
              onChoose={(v: number) => {
                const which = picker;
                if (which === 'quietStart') setRem({ quiet: { ...rem.quiet, startMin: v } });
                else if (which === 'quietEnd') setRem({ quiet: { ...rem.quiet, endMin: v } });
                else if (which === 'morning') setRem({ morning: { ...rem.morning, atMin: v } });
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
              afterSheetClosed(() => setNote(w.settings.copied));
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
