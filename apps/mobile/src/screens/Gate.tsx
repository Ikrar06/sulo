// The lock screen before the app (M8c.1, cards): an icon tile, the title,
// one line, Buka; a failed unlock says so; without a phone screen lock,
// Keluar is offered. The onboarding lives in onboarding/ (M8c.2).

import { useEffect, useState } from 'react';
import type { MobileWords } from '@sulo/core/i18n/mobile';
import { KeyIcon } from '@sulo/ui/icons';
import { IconTile } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { SuloSession } from '../session';

/** A full-height column clear of the gesture bar. */
const page = 'mx-auto flex min-h-full max-w-md flex-col px-4 pt-8 pb-[calc(24px+env(safe-area-inset-bottom))]'; // lint-ui-allow: 24 over the gesture bar

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
