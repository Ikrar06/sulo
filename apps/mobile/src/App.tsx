// The Android app's screens in M8b: onboarding, "Terhubung" (or a calm
// "sesi habis" line), the optional app lock and a hidden debug screen.
// Data screens come in M8c.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatAgo } from '@sulo/core/format/time';
import { messagesFor, resolveLocale, type Locale } from '@sulo/core/i18n';
import { mobileWords } from '@sulo/core/i18n/mobile';
import { readPrefs } from '@sulo/core/prefs';
import type { Platform } from '@sulo/core/platform';
import type { SyncOutcome, UnixSeconds } from '@sulo/core/types';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { DevScreen } from './DevScreen';
import { scheduleReminders } from './reminders';
import { SuloSession, type SessionStatus } from './session';
import { lastSyncAt, resumeNeedsSync, syncAfterLogin, syncNow } from './sync';

export const LOCK_KEY = 'mobile:lockEnabled';

const button = 'inline-flex h-11 items-center justify-center rounded-lg px-4 text-[16px] font-medium outline-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-focus';
const primary = `${button} bg-primary text-primary-foreground`;
const secondary = `${button} border border-border bg-surface`;

export function App({ platform }: { platform: Platform }) {
  const [locale, setLocale] = useState<Locale>('id');
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [locked, setLocked] = useState(false);
  const [last, setLast] = useState<UnixSeconds | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [dev, setDev] = useState(false);
  const w = mobileWords(locale);
  const m = useMemo(() => messagesFor(locale), [locale]);

  const refreshState = useCallback(async () => {
    setStatus((await SuloSession.status()).status);
    setLast(await lastSyncAt(platform));
  }, [platform]);

  const explain = (o: SyncOutcome) => (o.status === 'ok' ? '' : o.status === 'skipped' && o.reason === 'FRESH' ? w.connected.upToDate : o.status === 'offline' ? w.connected.offline : o.status === 'session_expired' ? '' : w.connected.failed);

  const sync = useCallback(
    async (after: () => Promise<SyncOutcome>) => {
      setBusy(true);
      setNote('');
      try {
        const outcome = await after();
        setNote(explain(outcome));
        await scheduleReminders(platform).catch(() => 0);
      } catch {
        setNote(w.connected.failed);
      } finally {
        await refreshState();
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [platform, refreshState, locale],
  );

  // Start: language, lock, state, and the reminders from the data already here.
  useEffect(() => {
    void (async () => {
      setLocale(resolveLocale((await readPrefs(platform.store)).locale, navigator.language));
      if ((await platform.store.get<boolean>(LOCK_KEY)) === true) setLocked(true);
      await refreshState();
      await scheduleReminders(platform).catch(() => 0);
    })();
  }, [platform, refreshState]);

  // Back in the foreground: lock again if on, and sync when the data is older than 15 minutes.
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      if ((await platform.store.get<boolean>(LOCK_KEY)) === true) setLocked(true);
      const s = (await SuloSession.status()).status;
      setStatus(s);
      if (s === 'connected' && resumeNeedsSync(await lastSyncAt(platform), platform.clock.now())) await sync(() => syncNow(platform, { userInitiated: true, dev: __SULO_DEV__ }));
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [platform, sync]);

  const signIn = async () => {
    const r = await SuloSession.login();
    if (r.status === 'cancelled') {
      setNote(w.onboarding.cancelled);
      return;
    }
    await sync(() => syncAfterLogin(platform, __SULO_DEV__));
  };

  if (status === null) return null;
  if (locked)
    return (
      <LockScreen
        w={w}
        onUnlocked={() => setLocked(false)}
        onSignOut={async () => {
          await signOutEverything(platform);
          setLocked(false);
          await refreshState();
        }}
      />
    );
  if (dev && __SULO_DEV__) return <DevScreen platform={platform} w={w} onBack={() => setDev(false)} />;
  if (status === 'none') return <Onboarding w={w} note={note} busy={busy} onSignIn={signIn} />;
  return (
    <Connected
      w={w}
      expired={status === 'expired'}
      updated={last === null ? w.connected.never : w.connected.updated(formatAgo(last, platform.clock.now(), m))}
      busy={busy}
      note={note}
      platform={platform}
      onRefresh={() => sync(() => syncNow(platform, { userInitiated: true, dev: __SULO_DEV__ }))}
      onSignIn={signIn}
      onSignedOut={async () => {
        setNote('');
        await refreshState();
      }}
      onDev={() => setDev(true)}
    />
  );
}

type W = ReturnType<typeof mobileWords>;

function Onboarding({ w, note, busy, onSignIn }: { w: W; note: string; busy: boolean; onSignIn: () => void }) {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Mascot state="onboarding" size={96} />
        <h1 className="text-[24px] leading-8 font-semibold">{w.onboarding.title}</h1>
        <p className="text-[16px] text-muted-foreground">{w.onboarding.lead}</p>
      </div>
      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-[16px] font-semibold">{w.onboarding.privacyTitle}</h2>
        <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-[14px] leading-normal">
          {w.onboarding.privacy.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
      <div className="mt-auto flex flex-col gap-3">
        <button type="button" className={primary} disabled={busy} onClick={onSignIn}>
          {w.onboarding.signIn}
        </button>
        {note && <p className="text-center text-[14px] text-muted-foreground">{note}</p>}
        <p className="text-center text-[12px] text-muted-foreground">{w.unofficial}</p>
      </div>
    </main>
  );
}

function Connected(props: {
  w: W;
  expired: boolean;
  updated: string;
  busy: boolean;
  note: string;
  platform: Platform;
  onRefresh: () => void;
  onSignIn: () => void;
  onSignedOut: () => void;
  onDev: () => void;
}) {
  const { w, expired, busy, platform } = props;
  const [confirm, setConfirm] = useState(false);
  const [lock, setLock] = useState(false);
  const [lockAvailable, setLockAvailable] = useState(false);
  const [taps, setTaps] = useState(0);
  useEffect(() => {
    void platform.store.get<boolean>(LOCK_KEY).then((v) => setLock(v === true));
    void SuloSession.lockAvailable().then((r) => setLockAvailable(r.available));
  }, [platform]);

  const signOut = async () => {
    await signOutEverything(platform);
    setConfirm(false);
    props.onSignedOut();
  };

  const toggleLock = async () => {
    if (!lock && !(await SuloSession.unlock()).unlocked) return;
    await platform.store.set(LOCK_KEY, !lock);
    setLock(!lock);
  };

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="text-[20px] leading-7 font-semibold">{expired ? w.connected.expiredTitle : w.connected.title}</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">{props.updated}</p>
      </header>

      {/* Expired: one calm line and one button, the data stays. */}
      {expired ? (
        <p className="flex items-center gap-3 text-[14px]" role="status">
          <span className="min-w-0 flex-1">{w.connected.expiredLine}</span>
          <button type="button" className={primary} disabled={busy} onClick={props.onSignIn}>
            {w.connected.signInAgain}
          </button>
        </p>
      ) : (
        <button type="button" className={secondary} disabled={busy} onClick={props.onRefresh}>
          {busy ? w.connected.refreshing : w.connected.refresh}
        </button>
      )}
      {props.note && <p className="text-[14px] text-muted-foreground">{props.note}</p>}

      <p className="rounded-xl border border-border bg-surface p-4 text-[14px] text-muted-foreground">{w.connected.dataSoon}</p>

      <section className="rounded-xl border border-border bg-surface p-4">
        <label className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-medium">{w.connected.lock}</span>
            <span className="block text-[12px] text-muted-foreground">{lockAvailable ? w.connected.lockHelp : w.connected.lockUnavailable}</span>
          </span>
          <input type="checkbox" role="switch" className="size-5" checked={lock} disabled={!lockAvailable} onChange={() => void toggleLock()} />
        </label>
      </section>

      <div className="mt-auto flex flex-col gap-3">
        {confirm ? (
          <section className="rounded-xl border border-border bg-surface p-4" role="alertdialog" aria-labelledby="signout-title">
            <h2 id="signout-title" className="text-[16px] font-semibold">
              {w.connected.signOutTitle}
            </h2>
            <p className="mt-1 text-[14px] text-muted-foreground">{w.connected.signOutBody}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className={secondary} onClick={() => setConfirm(false)}>
                {w.connected.cancel}
              </button>
              <button type="button" className={`${button} border border-urgency-overdue text-urgency-overdue`} onClick={() => void signOut()}>
                {w.connected.signOut}
              </button>
            </div>
          </section>
        ) : (
          <button type="button" className={secondary} onClick={() => setConfirm(true)}>
            {w.connected.signOut}
          </button>
        )}
        {/* Debug builds: seven taps on the version open the session-age screen. */}
        <button
          type="button"
          className="text-center text-[12px] text-muted-foreground"
          onClick={() => {
            const n = taps + 1;
            setTaps(n);
            if (n >= 7 && __SULO_DEV__) {
              setTaps(0);
              props.onDev();
            }
          }}
        >
          Sulo {__SULO_VERSION__} · {w.unofficial}
        </button>
      </div>
    </main>
  );
}

/** "Keluar": the native session and Keystore key, every Sulo key here, every scheduled reminder. */
async function signOutEverything(platform: Platform) {
  await SuloSession.logout();
  await platform.store.remove(await platform.store.keys(''));
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
}

function LockScreen({ w, onUnlocked, onSignOut }: { w: W; onUnlocked: () => void; onSignOut: () => void }) {
  const [noDeviceLock, setNoDeviceLock] = useState(false);
  const open = async () => {
    const r = await SuloSession.unlock();
    // Fail closed: without the phone's own lock, Sulo stays locked.
    setNoDeviceLock(r.reason === 'no_device_lock');
    if (r.unlocked) onUnlocked();
  };
  useEffect(() => {
    void open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 px-4">
      <Mascot state="sleepy" size={72} />
      <h1 className="text-[20px] font-semibold">{w.lock.title}</h1>
      {noDeviceLock && <p className="max-w-sm text-center text-[14px] text-muted-foreground">{w.lock.noDeviceLock}</p>}
      <button type="button" className={primary} onClick={() => void open()}>
        {w.lock.open}
      </button>
      {noDeviceLock && (
        <button type="button" className={secondary} onClick={onSignOut}>
          {w.lock.signOut}
        </button>
      )}
    </main>
  );
}
