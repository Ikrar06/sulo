// Pengaturan, Notifikasi (M8c.3): the "Pantau tugas baru" switch with what
// it means, when the last background check ran and a link to the FAQ; a
// one-time offer of the app lock when watching is first turned on; help
// when the phone keeps holding checks back; and the guide to SIKOLA's own
// email notifications. While the remote config turns watching off, the
// switch is disabled with the config's message.

import { useEffect, useState, type ReactNode } from 'react';
import { formatAgo } from '@sulo/core/format/time';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import { SIKOLA_ORIGIN } from '@sulo/core/moodle/limits';
import type { KeepAliveConfig } from '@sulo/core/remote/keep-alive';
import { sleepHelpDue } from '@sulo/core/watch/sleep-help';
import { useI18n } from '@sulo/ui/i18n';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton, Toggle } from '@sulo/ui/mobile/controls';
import { Sheet, afterSheetClosed } from '@sulo/ui/mobile/sheet';
import { LOCK_KEY } from '../account';
import { readKeepAlive } from '../public-data';
import { SuloSession } from '../session';
import { useMobileData } from '../shell/data';
import { DEFAULT_WATCH, readWatch, updateWatch, type WatchState } from '../watch';
import { applyWatchPlan, readWatchStatus, type WatchTiming } from '../watch-native';
import { Group, Row } from './settings-rows';

/** SIKOLA's preferences page (its "Notification preferences" link is there); opened in the browser, never changed by Sulo. */
export const SIKOLA_PREFERENCES_URL = `${SIKOLA_ORIGIN}/user/preferences.php`;
/** Bantuan, opened at the question on how fast Sulo hears about new tasks. */
const FAQ_HASH = '#bantuan/seberapa-cepat-hp';

export function WatchSettings({ lock, lockAvailable, onLockOn, after }: { lock: boolean; lockAvailable: boolean; onLockOn: () => void; /** More rows of the Notifikasi group, under the watching rows (the notification sound). */ after?: ReactNode }) {
  const { m, locale } = useI18n();
  const t = mobileDash(locale).pengaturan;
  const k = mobileWords(locale).watch;
  const { data, actions, platform } = useMobileData();
  const [watch, setWatch] = useState<WatchState>(DEFAULT_WATCH);
  const [remote, setRemote] = useState<KeepAliveConfig | null>(null);
  const [offer, setOffer] = useState(false);
  const [timings, setTimings] = useState<WatchTiming[]>([]);

  useEffect(() => {
    void readWatch(platform).then(setWatch);
    void readKeepAlive(platform).then(setRemote);
    void readWatchStatus().then((s) => setTimings(s.timings));
  }, [platform]);

  const remoteOff = remote !== null && !remote.enabled;
  const offMessage = remote?.message?.[locale] ?? k.remoteOff;
  const toggle = async (on: boolean) => {
    const offerNow = on && !lock && lockAvailable && !watch.lockOffered;
    setWatch(await updateWatch(platform, { enabled: on, ...(offerNow ? { lockOffered: true } : {}) }));
    // On: the first check a full interval from now. Off: every check stops at once.
    await applyWatchPlan(platform);
    if (offerNow) setOffer(true);
  };
  const turnOnLock = async () => {
    setOffer(false);
    // The phone's own prompt comes once the sheet is gone.
    await new Promise<void>((r) => afterSheetClosed(r));
    // Turning the lock on asks for the phone's lock once, so nobody locks themselves out.
    if (!(await SuloSession.unlock()).unlocked) return;
    await platform.store.set(LOCK_KEY, true);
    onLockOn();
  };
  const lastOk = [...timings].reverse().find((x) => x.outcome === 'ok')?.ranAt ?? null;
  const showSleepHelp = watch.enabled && !remoteOff && !watch.sleepHelpDismissed && sleepHelpDue(timings.filter((x) => x.plannedAt > 0));
  const status = lastOk !== null ? k.lastCheck(formatAgo(lastOk, data!.now, m)) : k.noCheck;

  return (
    <>
      <Group title={t.sections.notifikasi}>
        <Row label={k.title} help={remoteOff ? offMessage : k.help} dim={remoteOff}>
          <Toggle checked={watch.enabled && !remoteOff} disabled={remoteOff} label={k.title} onChange={(v) => void toggle(v)} />
        </Row>
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line">
          <span className="text-m12 text-muted-foreground tabular-nums">{watch.enabled && !remoteOff ? status : k.noCheck}</span>
          <a href={FAQ_HASH} className="m-hit rounded text-m13 underline underline-offset-2 outline-none focus-ring:ring-2 focus-ring:ring-focus">
            {k.more}
          </a>
        </div>
        {after}
      </Group>

      {showSleepHelp && (
        <Card>
          <h2 className="text-m15 font-semibold">{k.sleepTitle}</h2>
          <p className="mt-1 text-m13 text-muted-foreground">{k.sleepBody}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <PillButton small kind="primary" onPress={() => void SuloSession.openAppSettings()}>
              {k.sleepOpen}
            </PillButton>
            <PillButton small onPress={() => void updateWatch(platform, { sleepHelpDismissed: true }).then(setWatch)}>
              {k.sleepDismiss}
            </PillButton>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-m15 font-semibold">{k.emailTitle}</h2>
        <p className="mt-1 text-m13 text-muted-foreground">{k.emailBody}</p>
        <div className="mt-3">
          <PillButton small onPress={() => actions.openExternal(SIKOLA_PREFERENCES_URL)}>
            {k.emailOpen}
          </PillButton>
        </div>
      </Card>

      <Sheet open={offer} onOpenChange={setOffer} title={k.lockOfferTitle}>
        <p className="text-m15r text-muted-foreground">{k.lockOfferBody}</p>
        <div className="mt-4 flex flex-col gap-2">
          <PillButton kind="primary" full onPress={() => void turnOnLock()}>
            {k.lockOfferYes}
          </PillButton>
          <PillButton full onPress={() => setOffer(false)}>
            {k.lockOfferLater}
          </PillButton>
        </div>
      </Sheet>
    </>
  );
}
