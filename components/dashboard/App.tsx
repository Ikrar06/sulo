import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { browser } from 'wxt/browser';
import { I18nProvider } from '@/components/i18n';
import { Button } from '@/components/ui/button';
import { parseRoute, type Page, type Route } from '@/lib/dashboard/routes';
import { resolveLocale } from '@/lib/i18n';
import { dashFor } from '@/lib/i18n/dashboard';
import { DashboardProvider, timeZone, useDashboard } from './data';
import { DashboardShell } from './Shell';
import { StatusNotice } from './StatusNotice';
import { ToastProvider } from '@/components/ui/toast';
import { refreshFeedback } from '@/lib/view/refresh-feedback';
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

/** Pages whose data changes with a check: only these show "Diperbarui ... / Perbarui". */
const REFRESH_PAGES: ReadonlySet<Page> = new Set(['ringkasan', 'tugas', 'kabar', 'kalender']);

/** Data pages: they show the status notice (expired session, data that could not be updated). */
const DATA_PAGES: ReadonlySet<Page> = new Set(['ringkasan', 'tugas', 'kabar', 'kalender', 'mata-kuliah']);

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

  // Mata kuliah reloads the course list itself; the others sync tasks and updates.
  const reloadsCourses = route.page === 'mata-kuliah';
  const refresh = async (): Promise<boolean> => {
    setSyncing(true);
    const outcome = await actions.sync(reloadsCourses);
    setSyncing(false);
    return refreshFeedback(outcome, data.view.lastSyncAt, Math.floor(Date.now() / 1000)) === 'up-to-date';
  };

  return (
    <I18nProvider locale={locale}>
      <ToastProvider>
      <DashboardShell
        page={route.page}
        d={d}
        unseen={data.view.updatesUnseen}
        lastSyncAt={data.view.lastSyncAt}
        now={data.now}
        syncing={syncing || data.view.syncing}
        // Another SIKOLA account is signed in: no refresh and no "Diperbarui" in the header (the M4 message card explains).
        onRefresh={connected && !data.pending && (REFRESH_PAGES.has(route.page) || reloadsCourses) ? refresh : null}
        refreshLabel={reloadsCourses ? d.mataKuliah.refreshList : undefined}
        showUpdated={!reloadsCourses}
        onOpenPrivacy={() => actions.openTab(browser.runtime.getURL('/privacy.html'))}
      >
        {blocked ? (
          <NotConnected d={d} mismatch={data.pending !== null} onSetup={() => actions.openTab(browser.runtime.getURL('/onboarding.html'))} />
        ) : (
          <>
            {DATA_PAGES.has(route.page) && <StatusNotice banner={data.view.banner} d={d} locale={locale} timeZone={timeZone} className="mb-4" />}
            <Suspense fallback={<p className="text-[14px] text-muted-foreground">{d.common.loading}</p>}>
              <Page d={d} data={data} actions={actions} route={route} />
            </Suspense>
          </>
        )}
      </DashboardShell>
      </ToastProvider>
    </I18nProvider>
  );
}

function NotConnected({ d, mismatch, onSetup }: { d: ReturnType<typeof dashFor>; mismatch: boolean; onSetup: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-[16px] font-semibold">{mismatch ? d.common.mismatchTitle : d.common.notConnectedTitle}</h2>
      <p className="mt-1 max-w-[68ch] text-[14px] text-muted-foreground">{mismatch ? d.common.mismatchBody : d.common.notConnectedBody}</p>
      {!mismatch && (
        <Button className="mt-4" onClick={onSetup}>
          {d.common.continueSetup}
        </Button>
      )}
    </div>
  );
}
