// The screens before the app (M8c.1, cards). Onboarding: the 96 px mascot,
// the name at 26, one 15 px sentence, three small privacy cards with tinted
// icon tiles, the full-width sign-in pill and the 12 px disclaimer. The
// notification question at the end of setup uses the same pattern, aligned
// to the bottom. The lock screen: an icon tile, the title, one line, Buka;
// a failed unlock says so; without a phone screen lock, Keluar is offered.

import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import type { MobileWords } from '@sulo/core/i18n/mobile';
import { EyeOffIcon, ShieldIcon } from '@sulo/ui/dashboard-icons';
import { BellIcon, KeyIcon } from '@sulo/ui/icons';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { Card, IconTile } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { SuloSession } from '../session';

const PRIVACY_ICONS: ComponentType<SVGProps<SVGSVGElement>>[] = [KeyIcon, ShieldIcon, EyeOffIcon];
/** A full-height column clear of the gesture bar. */
const page = 'mx-auto flex min-h-full max-w-md flex-col px-4 pt-8 pb-[calc(24px+env(safe-area-inset-bottom))]'; // lint-ui-allow: 24 over the gesture bar

/** `paused`: the maintainer paused Sulo; sign-in is not offered, the message shows instead. */
export function Onboarding({ w, note, busy, paused = null, onSignIn }: { w: MobileWords; note: string; busy: boolean; paused?: string | null; onSignIn: () => void }) {
  return (
    <main className={page}>
      <div className="flex flex-col items-center text-center">
        <Mascot state="onboarding" size={96} />
        <h1 className="mt-4 text-m26">{w.onboarding.title}</h1>
        <p className="mt-2 text-m15 text-muted-foreground">{w.onboarding.lead}</p>
      </div>
      <section aria-label={w.onboarding.privacyTitle} className="mt-8">
        <ul className="space-y-3">
          {w.onboarding.privacy.map((p, i) => (
            <li key={p}>
              <Card dense>
                <div className="flex items-center gap-3">
                  <IconTile color="neutral" icon={PRIVACY_ICONS[i] ?? ShieldIcon} />
                  <p className="min-w-0 text-m13">{p}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>
      <div className="mt-auto flex flex-col gap-3 pt-8">
        {paused !== null ? (
          <p role="status" className="rounded-full bg-m-inset px-4 py-2 text-center text-m13">
            {paused}
          </p>
        ) : (
          <PillButton kind="primary" full disabled={busy} onPress={onSignIn}>
            {w.onboarding.signIn}
          </PillButton>
        )}
        {note && (
          <p role="status" className="text-center text-m13 text-muted-foreground">
            {note}
          </p>
        )}
        <p className="text-center text-m12 text-muted-foreground">{w.unofficial}</p>
      </div>
    </main>
  );
}

/** Before Android's own dialog: what the notifications are for, and that they stay on the phone. */
export function NotifyQuestion({ w, onDone }: { w: MobileWords; onDone: (allow: boolean) => void }) {
  return (
    <main className={`${page} justify-end`}>
      <div className="flex flex-col items-center text-center">
        <Mascot state="idle" size={96} />
        <h1 className="mt-4 text-m26">{w.notify.title}</h1>
        <p className="mt-2 text-m15 text-muted-foreground">{w.notify.body}</p>
      </div>
      <div className="mt-8 flex flex-col gap-2">
        <PillButton kind="primary" full icon={BellIcon} onPress={() => onDone(true)}>
          {w.notify.allow}
        </PillButton>
        <PillButton full onPress={() => onDone(false)}>
          {w.notify.later}
        </PillButton>
      </div>
    </main>
  );
}

export function LockScreen({ w, onUnlocked, onSignOut }: { w: MobileWords; onUnlocked: () => void; onSignOut: () => void }) {
  const [state, setState] = useState<'waiting' | 'failed' | 'noDeviceLock'>('waiting');
  const open = async () => {
    const r = await SuloSession.unlock();
    // Fail closed: without the phone's own lock, Sulo stays locked.
    if (r.unlocked) onUnlocked();
    else setState(r.reason === 'no_device_lock' ? 'noDeviceLock' : 'failed');
  };
  useEffect(() => {
    void open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const line = state === 'noDeviceLock' ? w.lock.noDeviceLock : state === 'failed' ? w.lock.failed : w.lock.body;
  return (
    <main className={page}>
      {/* The content centered in the free height; the buttons stay at the bottom. */}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <IconTile color="neutral" icon={KeyIcon} size={64} />
        <h1 className="mt-4 text-m26">{w.lock.title}</h1>
        <p role={state === 'waiting' ? undefined : 'status'} className="mt-2 text-m15 text-muted-foreground">
          {line}
        </p>
      </div>
      <div className="mt-8 flex flex-col gap-2">
        <PillButton kind="primary" full onPress={() => void open()}>
          {w.lock.open}
        </PillButton>
        {state === 'noDeviceLock' && (
          <PillButton full danger onPress={onSignOut}>
            {w.lock.signOut}
          </PillButton>
        )}
      </div>
    </main>
  );
}
