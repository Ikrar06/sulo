import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { browser } from 'wxt/browser';
import { I18nProvider } from '@/components/i18n';
import { Button } from '@/components/ui/button';
import { parseRoute, type Page, type Route } from '@/lib/dashboard/routes';
import { resolveLocale } from '@/lib/i18n';
import { dashFor } from '@/lib/i18n/dashboard';
import { DashboardProvider, useDashboard } from './data';
import { DashboardShell } from './Shell';
import type { PageProps } from './types';

// Each page is its own chunk, loaded when first opened.
const PAGES: Record<Page, ComponentType<PageProps>> = {
  ringkasan: lazy(() => import('./pages/Ringkasan').then((m) => ({ default: m.RingkasanPage }))),
  tugas: lazy(() => import('./pages/Tugas').then((m) => ({ default: m.TugasPage }))),
  'mata-kuliah': lazy(() => import('./pages/MataKuliah').then((m) => ({ default: m.MataKuliahPage }))),
  kabar: lazy(() => import('./pages/Kabar').then((m) => ({ default: m.KabarPage }))),
  kalender: lazy(() => import('./pages/Kalender').then((m) => ({ default: m.KalenderPage }))),
  pengaturan: lazy(() => import('./pages/Pengaturan').then((m) => ({ default: m.PengaturanPage }))),
  bantuan: lazy(() => import('./pages/Bantuan').then((m) => ({ default: m.BantuanPage }))),
  tentang: lazy(() => import('./pages/Tentang').then((m) => ({ default: m.TentangPage }))),
};

/** Pages that work without a connected account. */
const WITHOUT_ACCOUNT: ReadonlySet<Page> = new Set(['kalender', 'pengaturan', 'bantuan', 'tentang']);

const uiLanguage = browser.i18n.getUILanguage();

export function DashboardApp() {
  return (
    <DashboardProvider>
      <Router />
    </DashboardProvider>
  );
}

function Router() {
  const { data, actions } = useDashboard();
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const locale = resolveLocale(data?.prefs.locale ?? null, uiLanguage);
  const d = dashFor(locale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `${d.nav[route.page]} · Sulo`;
  }, [locale, d, route.page]);

  if (!data) return null;
  const Page = PAGES[route.page];
  const connected = data.user !== null && data.view.onboarded;
  const blocked = !connected && !WITHOUT_ACCOUNT.has(route.page);

  const refresh = async () => {
    setSyncing(true);
    await actions.sync();
    setSyncing(false);
  };

  return (
    <I18nProvider locale={locale}>
      <DashboardShell
        page={route.page}
        d={d}
        unseen={data.view.updatesUnseen}
        lastSyncAt={data.view.lastSyncAt}
        now={data.now}
        syncing={syncing || data.view.syncing}
        onRefresh={connected || data.pending ? () => void refresh() : null}
        onOpenPrivacy={() => actions.openTab(browser.runtime.getURL('/privacy.html'))}
      >
        {blocked ? (
          <NotConnected d={d} mismatch={data.pending !== null} onSetup={() => actions.openTab(browser.runtime.getURL('/onboarding.html'))} />
        ) : (
          <Suspense fallback={<p className="text-[14px] text-muted-foreground">{d.common.loading}</p>}>
            <Page d={d} data={data} actions={actions} route={route} />
          </Suspense>
        )}
      </DashboardShell>
    </I18nProvider>
  );
}

function NotConnected({ d, mismatch, onSetup }: { d: ReturnType<typeof dashFor>; mismatch: boolean; onSetup: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="font-heading text-[18px]">{mismatch ? d.common.mismatchTitle : d.common.notConnectedTitle}</h2>
      <p className="mt-1 max-w-[46em] text-[14px] text-muted-foreground">{mismatch ? d.common.mismatchBody : d.common.notConnectedBody}</p>
      {!mismatch && (
        <Button className="mt-4" onClick={onSetup}>
          {d.common.continueSetup}
        </Button>
      )}
    </div>
  );
}
