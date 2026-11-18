// Screens 4 and 5 (M8c.2). Sign-in: an address card (lock + the real host,
// as text), the mascot beside it, "Buka halaman SIKOLA" and "Kenapa aman?".
// Preparing: four rows bound to the real sync stages (stage-timing.ts),
// a calm message when nothing came, and the mascot busy, then relieved.

import { useEffect, useMemo, useState } from 'react';
import type { OnboardingWords } from '@sulo/core/i18n/mobile-onboarding';
import { EyeOffIcon, ShieldIcon } from '@sulo/ui/dashboard-icons';
import { ArrowLeftIcon } from '@sulo/ui/dashboard-icons';
import { KeyIcon, LockIcon } from '@sulo/ui/icons';
import { Card, IconTile } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { Sheet } from '@sulo/ui/mobile/sheet';
import { PrivasiScreen } from '../screens/Privasi';
import { MascotSpot, useMascotCue } from './FlyingMascot';
import { EASE_OUT, MS } from './motion';
import { IntroLayout, useTitleFocus } from './Shell';
import { Piece } from './Stage';
import { PREP_ROWS, shownTimes, type PrepRow, type StageEvent } from './stage-timing';

const POINT_ICONS = [KeyIcon, ShieldIcon, EyeOffIcon];

export function SignIn({ w, welcomeBack, note, busy, paused, onOpen, onBack }: { w: OnboardingWords; welcomeBack: boolean; note: 'cancelled' | 'offline' | null; busy: boolean; paused: string | null; onOpen: () => void; onBack: (() => void) | null }) {
  const t = w.signin;
  const [why, setWhy] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  useMascotCue({ state: note ? 'idle' : 'onboarding' });
  if (privacy) return <PrivacyPage w={w} onBack={() => setPrivacy(false)} />;
  return (
    <>
      <IntroLayout
        stepKey="signin"
        title={t.title}
        body={welcomeBack ? `${t.welcomeBack} ${t.body}` : t.body}
        stageLabel={`${t.address}. ${t.addressNote}`}
        onSwipeBack={onBack}
        action={paused === null ? { label: t.open, onPress: onOpen, disabled: busy } : { label: t.open, onPress: () => undefined, disabled: true }}
        footer={
          <div className="flex flex-col items-center gap-2">
            {paused !== null && (
              <p role="status" className="text-center text-m13">
                {paused}
              </p>
            )}
            {note && paused === null && (
              <p role="status" className="text-center text-m13 text-muted-foreground">
                {note === 'offline' ? t.offline : t.cancelled}
              </p>
            )}
            <button type="button" onClick={() => setWhy(true)} className="m-hit rounded-full px-3 text-m13 text-muted-foreground underline underline-offset-4 outline-none focus-ring:ring-2 focus-ring:ring-focus">
              {t.why}
            </button>
          </div>
        }
        stage={
          <div className="flex h-full items-center justify-center">
            <Piece rest={{ left: 0, top: 34, width: 74, rotate: 0, scale: 1 }} from={{ y: 16 }} delay={80}>
              <Card dense>
                <div className="flex items-center gap-2">
                  <LockIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  {/* Never cut: the user is asked to check this address. */}
                  <span className="min-w-0 text-m15 break-all">{t.address}</span>
                </div>
              </Card>
              <p className="mt-2 px-1 text-m12 text-muted-foreground">{t.addressNote}</p>
            </Piece>
            {/* Beside the address, tilted a little toward it. */}
            <div className="absolute top-[30%] right-0 -rotate-6">
              <MascotSpot size={72} />
            </div>
          </div>
        }
      />
      <Sheet open={why} onOpenChange={setWhy} title={t.whyTitle}>
        <ul className="space-y-2">
          {w.intro3.points.map((p, i) => (
            <li key={p} className="flex items-center gap-3 rounded-card bg-m-inset px-3 py-2">
              <IconTile color="neutral" icon={POINT_ICONS[i]!} />
              <p className="min-w-0 text-m13">{p}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <PillButton
            full
            onPress={() => {
              setWhy(false);
              setPrivacy(true);
            }}
          >
            {t.privacyLink}
          </PillButton>
        </div>
      </Sheet>
    </>
  );
}

function PrivacyPage({ w, onBack }: { w: OnboardingWords; onBack: () => void }) {
  const title = useTitleFocus('privacy');
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pt-[calc(8px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom))]">
      <div className="flex h-11 items-center">
        <button type="button" aria-label={w.back} onClick={onBack} className="m-hit inline-flex size-11 items-center justify-center rounded-full outline-none focus-ring:ring-2 focus-ring:ring-focus">
          <ArrowLeftIcon aria-hidden="true" className="size-5" />
        </button>
        <h1 ref={title} tabIndex={-1} className="sr-only">
          {w.signin.privacyLink}
        </h1>
      </div>
      <PrivasiScreen />
    </main>
  );
}

/** Screen 5: the real stages as they end; at least 250 ms per check; a calm stop when no task came. */
export function Preparing({ w, events, final, onDone, onRetry, onWithout }: { w: OnboardingWords; events: readonly StageEvent[]; final: 'pending' | 'ok' | 'partial' | 'failed'; onDone: () => void; onRetry: () => void; onWithout: () => void }) {
  const t = w.preparing;
  const title = useTitleFocus('preparing');
  const [now, setNow] = useState(() => performance.now());
  const shown = useMemo(() => shownTimes(events), [events]);
  const visible = shown.filter((s) => s.showAt <= now);
  const allShown = final !== 'pending' && final !== 'failed' && visible.length === PREP_ROWS.length;
  const [relieved, setRelieved] = useState(false);
  useMascotCue({ state: final === 'failed' ? 'idle' : relieved ? 'all-done' : 'syncing' });

  // Wake up for the next row's time.
  useEffect(() => {
    const next = shown.find((s) => s.showAt > now);
    if (!next) return;
    const t = window.setTimeout(() => setNow(performance.now()), next.showAt - now);
    return () => window.clearTimeout(t);
  }, [shown, now]);

  // Done: relieved for 600 ms, then on to the courses.
  useEffect(() => {
    if (!allShown) return;
    setRelieved(true);
    const t = window.setTimeout(onDone, 600);
    return () => window.clearTimeout(t);
  }, [allShown, onDone]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center px-4 pt-[calc(48px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom))]">
      <MascotSpot size={104} />
      <h1 ref={title} tabIndex={-1} className="mt-4 text-m26 outline-none">
        {t.title}
      </h1>
      {final === 'failed' ? (
        <div className="mt-6 w-full">
          <Card>
            <p role="status" className="text-m15">
              {t.failedTitle}
            </p>
          </Card>
        </div>
      ) : (
        <div className="mt-6 w-full">
          <Card>
            <ul aria-live="polite" className="space-y-3">
              {PREP_ROWS.map((row) => (
                <Row key={row} row={row} label={t.stages[row]} later={t.later} result={visible.find((v) => v.row === row)?.result ?? null} />
              ))}
            </ul>
          </Card>
        </div>
      )}
      {final === 'failed' && (
        <div className="mt-auto flex w-full flex-col items-center gap-2 pt-6">
          <PillButton kind="primary" full onPress={onRetry}>
            {t.retry}
          </PillButton>
          <button type="button" onClick={onWithout} className="m-hit rounded-full px-3 text-m13 text-muted-foreground outline-none focus-ring:ring-2 focus-ring:ring-focus">
            {t.without}
          </button>
        </div>
      )}
    </main>
  );
}

function Row({ row, label, later, result }: { row: PrepRow; label: string; later: string; result: 'ok' | 'failed' | null }) {
  return (
    <li className="flex min-h-7 items-center gap-3" data-row={row}>
      <span aria-hidden="true" className="inline-flex size-6 shrink-0 items-center justify-center">
        {result === null ? <span className="m-spin size-5 rounded-full border-2 border-m-line border-t-foreground" /> : result === 'ok' ? <DrawnCheck /> : <span className="size-2 rounded-full bg-muted-foreground" />}
      </span>
      <span className={`min-w-0 flex-1 text-m15 ${result === 'failed' ? 'text-muted-foreground' : ''}`}>{label}</span>
      {result === 'failed' && <span className="shrink-0 text-m12 text-muted-foreground">{later}</span>}
    </li>
  );
}

function DrawnCheck() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M5 12.5 10 17 19 7.5"
        ref={(p) => {
          if (!p || p.dataset.drawn || typeof p.animate !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
          p.dataset.drawn = '1';
          const len = p.getTotalLength();
          p.style.strokeDasharray = `${len}`;
          p.animate([{ strokeDashoffset: `${len}` }, { strokeDashoffset: '0' }], { duration: MS.check + 60, easing: EASE_OUT });
        }}
      />
    </svg>
  );
}
