// Which screen shows for the current place in the navigation. While another
// SIKOLA account is signed in, the previous account's data stays hidden and
// only the choice shows (CLAUDE.md, hard rule 10).

import { lazy, Suspense, useState } from 'react';
import { useNewAccount } from '@sulo/core/account/actions';
import { useI18n } from '@sulo/ui/i18n';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { mobileWords } from '@sulo/core/i18n/mobile';
import { useMobileData } from '../shell/data';
import { NoDataSkeleton } from './Skeletons';
import type { Screen } from '../shell/nav';
import { clearScheduledReminders } from '../reminders';
import { RingkasanScreen } from './Ringkasan';
import { TugasScreen } from './Tugas';
import { TaskScreen } from './TaskDetail';
import { KalenderScreen } from './Kalender';
import { PresensiScreen } from './Presensi';
import { LainnyaScreen } from './Lainnya';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';

// Pages under "Lainnya" load when first opened.
const KabarScreen = lazy(() => import('./Kabar').then((m) => ({ default: m.KabarScreen })));
const MataKuliahScreen = lazy(() => import('./MataKuliah').then((m) => ({ default: m.MataKuliahScreen })));
const PengaturanScreen = lazy(() => import('./Pengaturan').then((m) => ({ default: m.PengaturanScreen })));
const BantuanScreen = lazy(() => import('./Bantuan').then((m) => ({ default: m.BantuanScreen })));
const TentangScreen = lazy(() => import('./Tentang').then((m) => ({ default: m.TentangScreen })));
const PrivasiScreen = lazy(() => import('./Privasi').then((m) => ({ default: m.PrivasiScreen })));
const JadwalScreen = lazy(() => import('./neosia/Jadwal').then((m) => ({ default: m.JadwalScreen })));
const NilaiScreen = lazy(() => import('./neosia/Nilai').then((m) => ({ default: m.NilaiScreen })));

export function Screens({ screen, go, onSignedOut }: { screen: Screen; go: (s: Screen) => void; onSignedOut: () => void }) {
  const { data } = useMobileData();
  const { locale } = useI18n();
  if (!data) return null;
  if (data.pending) return <AccountPending />;
  // Settings, help, about and privacy work without account data too.
  const page = (() => {
    switch (screen.name) {
      case 'pengaturan':
        return <PengaturanScreen onSignedOut={onSignedOut} section={screen.detail} />;
      case 'bantuan':
        return <BantuanScreen initialOpen={screen.detail} />;
      case 'tentang':
        return <TentangScreen />;
      case 'privasi':
        return <PrivasiScreen />;
      case 'lainnya':
        return <LainnyaScreen go={go} onSignedOut={onSignedOut} />;
      default:
        return null;
    }
  })();
  if (page) return <Suspense fallback={null}>{page}</Suspense>;
  // No data yet (a new account, or Hapus data): a skeleton shaped like the screen, until the sync brings it.
  if (!data.user) return <NoDataSkeleton screen={screen.name} label={mobileWords(locale).connected.sync.updating} />;
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
    case 'jadwal':
      return (
        <Suspense fallback={null}>
          <JadwalScreen />
        </Suspense>
      );
    case 'nilai':
      return (
        <Suspense fallback={null}>
          <NilaiScreen go={go} />
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
    <Card>
      <div className="flex flex-col items-center text-center">
        <Mascot state="sleepy" size={48} />
        <h2 className="mt-3 text-m18 font-semibold">{later ? a.deferredTitle : a.title}</h2>
        <p className="mt-1 text-m15r text-muted-foreground">{later ? a.deferredBody : a.body}</p>
      </div>
      {!later && (
        <div className="mt-4 flex flex-col gap-2">
          <PillButton
            kind="primary"
            full
            onPress={async () => {
              await useNewAccount({ store: platform.store, clearNotifications: () => clearScheduledReminders(platform), openSetup: async () => undefined });
              await reload();
            }}
          >
            {a.useThis}
          </PillButton>
          <p className="text-center text-m12 text-muted-foreground">{a.useThisNote}</p>
          <PillButton full onPress={() => setLater(true)}>
            {a.later}
          </PillButton>
        </div>
      )}
    </Card>
  );
}
