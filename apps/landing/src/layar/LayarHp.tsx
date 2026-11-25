// The Android app's screen as the app draws it: its own shell (header, status
// line, the screens, the tab bar) on Ringkasan or another screen, with the
// sample data. The providers stand in the same order as in apps/mobile/src/App.tsx.
// Sample data with NEOSIA connected (the user guide) brings the NEOSIA screens along.
import { I18nProvider } from '@sulo/ui/i18n';
import { MascotScopeContext } from '@sulo/ui/mascot/context';
import { PrivacyProvider } from '@sulo/ui/private';
import { ToastProvider } from '@sulo/ui/ui/toast';
import type { DashboardData } from '@sulo/core/view/dashboard-data';
import { AppShell } from '../../../mobile/src/shell/AppShell';
import type { ScreenName } from '../../../mobile/src/shell/nav';
import { LandingMobileData } from './ganti/mobile-data';
import { memoryStore } from './ganti/memory-store';
import { NeosiaContoh } from './ganti/neosia-provider';
import type { Bahasa } from '../teks';

const noop = () => undefined;

export function LayarHp({ data, bahasa, layar = 'ringkasan', rincian = null }: { data: DashboardData; bahasa: Bahasa; layar?: ScreenName; rincian?: string | null }) {
  // On the server (the build), Node has a navigator without onLine: the app would think it is offline.
  if (typeof window === 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === undefined) {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  }
  const platform = { store: memoryStore(), clock: { now: () => data.now } } as never;
  const actions = { updateUser: async () => true, setPrefs: async () => undefined, openExternal: noop };
  const shell = (
    <AppShell
      expired={false}
      busy={false}
      lastSyncAt={data.view.lastSyncAt}
      onRefresh={async () => ''}
      onSignIn={noop}
      onSignedOut={noop}
      initialScreen={layar === 'ringkasan' ? null : { name: layar, detail: rincian }}
    />
  );
  return (
    <I18nProvider locale={bahasa}>
      <MascotScopeContext.Provider value={{ lite: false }}>
        <LandingMobileData value={{ data, actions, platform, reload: async () => undefined }}>
          <PrivacyProvider value={false}>
            <ToastProvider viewportClassName="bottom-[72px]">
              {data.neosia.module.enabled ? (
                <NeosiaContoh snapshots={data.neosia.snapshots} courseMap={data.neosia.courseMap}>
                  {shell}
                </NeosiaContoh>
              ) : (
                shell
              )}
            </ToastProvider>
          </PrivacyProvider>
        </LandingMobileData>
      </MascotScopeContext.Provider>
    </I18nProvider>
  );
}
