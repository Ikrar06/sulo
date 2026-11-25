// The extension's dashboard as the extension draws it: its shell (sidebar,
// header) and one of its pages, with the sample data. NEOSIA is off, as when
// the extension is installed, so Jadwal and Nilai are not in the sidebar;
// the user guide hands in sample data with NEOSIA connected to show them.
import { NEOSIA_PAGES, type Page } from '@sulo/core/dashboard/routes';
import { dashFor } from '@sulo/core/i18n/dashboard';
import type { DashboardData } from '@sulo/core/view/dashboard-data';
import { I18nProvider } from '@sulo/ui/i18n';
import { PrivacyProvider } from '@sulo/ui/private';
import { ToastProvider } from '@sulo/ui/ui/toast';
import type { ComponentType } from 'react';
import { DashboardShell } from '../../../extension/components/dashboard/Shell';
import { JadwalPage } from '../../../extension/components/dashboard/pages/Jadwal';
import { KabarPage } from '../../../extension/components/dashboard/pages/Kabar';
import { KalenderPage } from '../../../extension/components/dashboard/pages/Kalender';
import { MataKuliahPage } from '../../../extension/components/dashboard/pages/MataKuliah';
import { NilaiPage } from '../../../extension/components/dashboard/pages/Nilai';
import { PengaturanPage } from '../../../extension/components/dashboard/pages/Pengaturan';
import { PresensiPage } from '../../../extension/components/dashboard/pages/Presensi';
import { RingkasanPage } from '../../../extension/components/dashboard/pages/Ringkasan';
import { TugasPage } from '../../../extension/components/dashboard/pages/Tugas';
import type { PageProps } from '../../../extension/components/dashboard/types';
import type { Bahasa } from '../teks';

const noop = () => undefined;

/** The dashboard pages the landing page shows (Bantuan and Tentang are text the guide itself says). */
export type HalamanDasbor = Exclude<Page, 'bantuan' | 'tentang'>;
const HALAMAN: Record<HalamanDasbor, ComponentType<PageProps>> = {
  ringkasan: RingkasanPage,
  tugas: TugasPage,
  'mata-kuliah': MataKuliahPage,
  presensi: PresensiPage,
  kabar: KabarPage,
  kalender: KalenderPage,
  jadwal: JadwalPage,
  nilai: NilaiPage,
  pengaturan: PengaturanPage,
};
/** As in the extension (dashboard/App.tsx): only these pages show "Diperbarui ... / Perbarui"; Mata kuliah has the button alone. */
const BISA_DIPERBARUI: ReadonlySet<Page> = new Set(['ringkasan', 'tugas', 'kabar', 'kalender']);

export function LayarLaptop({ data, bahasa, halaman = 'ringkasan', rincian = null }: { data: DashboardData; bahasa: Bahasa; halaman?: HalamanDasbor; rincian?: string | null }) {
  const d = dashFor(bahasa);
  const actions = { updateUser: async () => true, setPrefs: async () => undefined, send: async () => undefined, sync: async () => null, openTab: noop };
  const Halaman = HALAMAN[halaman];
  return (
    <I18nProvider locale={bahasa}>
      <PrivacyProvider value={false}>
        <ToastProvider viewportClassName="bottom-6 db-toasts">
          <DashboardShell page={halaman} d={d} unseen={data.view.updatesUnseen} lastSyncAt={data.view.lastSyncAt} now={data.now} syncing={false} onRefresh={BISA_DIPERBARUI.has(halaman) || halaman === 'mata-kuliah' ? async () => true : null} showUpdated={BISA_DIPERBARUI.has(halaman)} onOpenPrivacy={noop} hiddenPages={data.neosia.module.enabled ? new Set() : NEOSIA_PAGES} privacy={null}>
            <div className="ext-page-in">
              <Halaman d={d} data={data} actions={actions as never} route={{ page: halaman, detail: rincian }} />
            </div>
          </DashboardShell>
        </ToastProvider>
      </PrivacyProvider>
    </I18nProvider>
  );
}
