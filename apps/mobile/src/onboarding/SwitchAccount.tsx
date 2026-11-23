// "Akun berbeda" (M8c.2): another SIKOLA account signed in than the one
// whose data is on this phone (switch-account.ts). The onboarding's pattern:
// the mascot in the middle with a small surprise, the title and one line,
// "Pakai akun ini" and "Batal". It never shows a name, NIM or userid. Back
// is "Batal", the action that changes nothing.

import { useEffect, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import type { OnboardingWords } from '@sulo/core/i18n/mobile-onboarding';
import { closeTopSheet } from '@sulo/ui/mobile/sheet-motion';
import { FlyingMascotLayer, MascotSpot, useExpression, useMascot } from './FlyingMascot';
import { Frame, TextBlock, TextLink, useTitleFocus } from './Frame';
import { SHORT_SCREEN } from './motion';

function SwitchScreen({ w, busy, onUse, onCancel }: { w: OnboardingWords; busy: boolean; onUse: () => void; onCancel: () => void }) {
  const t = w.switchAccount;
  const mascot = useMascot();
  const title = useTitleFocus('switch');
  useExpression('surprised');
  // The surprise is short; then it waits, calm.
  useEffect(() => {
    const id = window.setTimeout(() => mascot.express('neutral'), 900);
    return () => window.clearTimeout(id);
  }, [mascot]);
  return (
    <Frame primary={{ label: t.use, onPress: onUse, disabled: busy }} secondary={<TextLink onPress={onCancel}>{t.cancel}</TextLink>}>
      {/* The group (mascot, title, line) sits in the middle of the stage, as on the done screen. */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <MascotSpot size={SHORT_SCREEN ? 150 : 176} />
        <TextBlock title={t.title} body={t.body} titleRef={title} />
      </div>
    </Frame>
  );
}

export function SwitchAccount({ w, onUse, onCancel }: { w: OnboardingWords; onUse: () => Promise<void>; onCancel: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  // Android's back button: "Batal".
  useEffect(() => {
    const handle = CapApp.addListener('backButton', () => {
      if (closeTopSheet()) return;
      void cancel.current();
    });
    return () => void handle.then((h) => h.remove());
  }, []);
  const run = (fn: () => Promise<void>) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  return (
    // A fixed layer, like the onboarding's steps: the body's own top padding (the status bar's inset) would come on
    // top of the frame's, pushing "Batal" under the gesture bar.
    <div className="fixed inset-0 bg-m-screen">
      <FlyingMascotLayer spotKey="switch">
        <SwitchScreen w={w} busy={busy} onUse={() => void run(onUse)()} onCancel={() => void run(onCancel)()} />
      </FlyingMascotLayer>
    </div>
  );
}
