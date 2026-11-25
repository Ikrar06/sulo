// The extension's dashboard as the extension draws it: its shell (sidebar,
// header) and Ringkasan, with the sample data. NEOSIA is off, as when the
// extension is installed, so Jadwal and Nilai are not in the sidebar.
import { NEOSIA_PAGES } from '@sulo/core/dashboard/routes';
import { dashFor } from '@sulo/core/i18n/dashboard';
import type { DashboardData } from '@sulo/core/view/dashboard-data';
import { I18nProvider } from '@sulo/ui/i18n';
import { PrivacyProvider } from '@sulo/ui/private';
import { ToastProvider } from '@sulo/ui/ui/toast';
import { DashboardShell } from '../../../extension/components/dashboard/Shell';
import { RingkasanPage } from '../../../extension/components/dashboard/pages/Ringkasan';
import type { Bahasa } from '../teks';

const noop = () => undefined;

export function LayarLaptop({ data, bahasa }: { data: DashboardData; bahasa: Bahasa }) {
  const d = dashFor(bahasa);
  const actions = { updateUser: async () => true, setPrefs: async () => undefined, send: async () => undefined, sync: async () => null, openTab: noop };
  return (
    <I18nProvider locale={bahasa}>
      <PrivacyProvider value={false}>
        <ToastProvider viewportClassName="bottom-6 db-toasts">
          <DashboardShell page="ringkasan" d={d} unseen={data.view.updatesUnseen} lastSyncAt={data.view.lastSyncAt} now={data.now} syncing={false} onRefresh={async () => true} showUpdated onOpenPrivacy={noop} hiddenPages={NEOSIA_PAGES} privacy={null}>
            <div className="ext-page-in">
              <RingkasanPage d={d} data={data} actions={actions as never} route={{ page: 'ringkasan', detail: null } as never} />
            </div>
          </DashboardShell>
        </ToastProvider>
      </PrivacyProvider>
    </I18nProvider>
  );
}
