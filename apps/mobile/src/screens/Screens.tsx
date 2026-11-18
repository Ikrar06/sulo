// Which screen shows for the current place in the navigation. While another
// SIKOLA account is signed in, the previous account's data stays hidden and
// only the choice shows (CLAUDE.md, hard rule 10).

import { lazy, Suspense, useState } from 'react';
import { useNewAccount } from '@sulo/core/account/actions';
import { useI18n } from '@sulo/ui/i18n';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { useMobileData } from '../shell/data';
import type { Screen } from '../shell/nav';
import { clearScheduledReminders } from '../reminders';
import { RingkasanScreen } from './Ringkasan';
import { TaskScreen, TugasScreen } from './Tugas';
import { KalenderScreen } from './Kalender';
import { PresensiScreen } from './Presensi';
import { LainnyaScreen } from './Lainnya';
import { primaryButton, secondaryButton } from './ui';

// Pages under "Lainnya" load when first opened.
const KabarScreen = lazy(() => import('./Kabar').then((m) => ({ default: m.KabarScreen })));
const MataKuliahScreen = lazy(() => import('./MataKuliah').then((m) => ({ default: m.MataKuliahScreen })));
const PengaturanScreen = lazy(() => import('./Pengaturan').then((m) => ({ default: m.PengaturanScreen })));
const BantuanScreen = lazy(() => import('./Bantuan').then((m) => ({ default: m.BantuanScreen })));
const TentangScreen = lazy(() => import('./Tentang').then((m) => ({ default: m.TentangScreen })));
const PrivasiScreen = lazy(() => import('./Privasi').then((m) => ({ default: m.PrivasiScreen })));

export function Screens({ screen, go, onSignedOut }: { screen: Screen; go: (s: Screen) => void; onSignedOut: () => void }) {
  const { data } = useMobileData();
  if (!data) return null;
  if (data.pending) return <AccountPending />;
  // Settings, help, about and privacy work without account data too.
  const page = (() => {
    switch (screen.name) {
      case 'pengaturan':
        return <PengaturanScreen onSignedOut={onSignedOut} />;
      case 'bantuan':
        return <BantuanScreen />;
      case 'tentang':
        return <TentangScreen />;
      case 'privasi':
        return <PrivasiScreen />;
      case 'lainnya':
        return <LainnyaScreen go={go} />;
      default:
        return null;
    }
  })();
  if (page) return <Suspense fallback={null}>{page}</Suspense>;
  if (!data.user) return null;
  switch (screen.name) {
    case 'tugas':
      return screen.detail !== null ? <TaskScreen eventId={Number(screen.detail)} /> : <TugasScreen go={go} />;
    case 'kalender':
      return <KalenderScreen />;
    case 'presensi':
      return <PresensiScreen courseId={screen.detail !== null ? Number(screen.detail) : null} go={go} />;
    case 'kabar':
      return (
        <Suspense fallback={null}>
          <KabarScreen courseId={screen.detail !== null ? Number(screen.detail) : null} go={go} />
        </Suspense>
      );
    case 'mata-kuliah':
      return (
        <Suspense fallback={null}>
          <MataKuliahScreen />
        </Suspense>
      );
    default:
      return <RingkasanScreen go={go} />;
  }
}

/** Another account is signed in: use it (the previous account's data is deleted) or wait for the previous one. */
function AccountPending() {
  const { m } = useI18n();
  const { platform, reload } = useMobileData();
  const [later, setLater] = useState(false);
  const a = m.popup.account;
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-5 text-center">
      <Mascot state="sleepy" size={56} />
      <h2 className="text-[16px] font-semibold">{later ? a.deferredTitle : a.title}</h2>
      <p className="text-[14px] text-muted-foreground">{later ? a.deferredBody : a.body}</p>
      {!later && (
        <div className="mt-2 flex w-full flex-col gap-2">
          <button
            type="button"
            className={primaryButton}
            onClick={async () => {
              await useNewAccount({ store: platform.store, clearNotifications: () => clearScheduledReminders(platform), openSetup: async () => undefined });
              await reload();
            }}
          >
            {a.useThis}
          </button>
          <p className="text-[12px] text-muted-foreground">{a.useThisNote}</p>
          <button type="button" className={secondaryButton} onClick={() => setLater(true)}>
            {a.later}
          </button>
        </div>
      )}
    </section>
  );
}
