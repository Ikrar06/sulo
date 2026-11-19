import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { browser } from 'wxt/browser';
import { I18nProvider } from '@sulo/ui/i18n';
import { Button } from '@sulo/ui/ui/button';
import { NEOSIA_PAGES, parseRoute, SENSITIVE_PAGES, type Page, type Route } from '@sulo/core/dashboard/routes';
import { PrivacyProvider } from '@sulo/ui/private';
import { NeosiaArrivals } from './NeosiaArrivals';
import { messagesFor, resolveLocale } from '@sulo/core/i18n';
import { dashFor } from '@sulo/core/i18n/dashboard';
import { DashboardProvider, timeZone, useDashboard } from './data';
import { DashboardShell } from './Shell';
import { StatusLine } from '@sulo/ui/status-line';
import { sikolaUrl } from '@sulo/core/links';
import { useCountdownTicker } from '@/components/countdown-ticker';
import { ToastProvider } from '@sulo/ui/ui/toast';
import { refreshFeedback } from '@sulo/core/view/refresh-feedback';
import { MismatchCard } from './MismatchCard';
import type { PageProps } from './types';

// Each page is its own chunk, loaded when first opened.
const PAGES: Record<Page, ComponentType<PageProps>> = {
  ringkasan: lazy(() => import('./pages/Ringkasan').then((m) => ({ default: m.RingkasanPage }))),
  tugas: lazy(() => import('./pages/Tugas').then((m) => ({ default: m.TugasPage }))),
  'mata-kuliah': lazy(() => import('./pages/MataKuliah').then((m) => ({ default: m.MataKuliahPage }))),
  presensi: lazy(() => import('./pages/Presensi').then((m) => ({ default: m.PresensiPage }))),
  kabar: lazy(() => import('./pages/Kabar').then((m) => ({ default: m.KabarPage }))),
  kalender: lazy(() => import('./pages/Kalender').then((m) => ({ default: m.KalenderPage }))),
  jadwal: lazy(() => import('./pages/Jadwal').then((m) => ({ default: m.JadwalPage }))),
  nilai: lazy(() => import('./pages/Nilai').then((m) => ({ default: m.NilaiPage }))),
  pengaturan: lazy(() => import('./pages/Pengaturan').then((m) => ({ default: m.PengaturanPage }))),
  bantuan: lazy(() => import('./pages/Bantuan').then((m) => ({ default: m.BantuanPage }))),
  tentang: lazy(() => import('./pages/Tentang').then((m) => ({ default: m.TentangPage }))),
};

/**
 * #dev-sesi: the session age log, tester and development builds only. The
 * condition is a build-time constant, so production drops the page.
 */
const DevSession = import.meta.env.MODE === 'production' ? null : lazy(() => import('./DevSession'));
const DEV_SESSION_HASH = '#dev-sesi';

/** Pages whose data changes with a check: only these show "Diperbarui ... / Perbarui". */
const REFRESH_PAGES: ReadonlySet<Page> = new Set(['ringkasan', 'tugas', 'kabar', 'kalender']);

/** Data pages: they show the status notice (expired session, data that could not be updated). */
const DATA_PAGES: ReadonlySet<Page> = new Set(['ringkasan', 'tugas', 'kabar', 'kalender', 'mata-kuliah', 'presensi']);

/** Pages that work without a connected account. */
const WITHOUT_ACCOUNT: ReadonlySet<Page> = new Set(['kalender', 'jadwal', 'nilai', 'pengaturan', 'bantuan', 'tentang']);

const uiLanguage = browser.i18n.getUILanguage();

/** Settings, scrolled to one of its sections (the status line's "Salin info" and "Lihat caranya"). */
function openSettingsAt(id: string) {
  location.hash = '#pengaturan';
  window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 200);
}

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
  const [devSession, setDevSession] = useState(() => DevSession !== null && location.hash === DEV_SESSION_HASH);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute(location.hash));
      setDevSession(DevSession !== null && location.hash === DEV_SESSION_HASH);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const locale = resolveLocale(data?.prefs.locale ?? null, uiLanguage);
  const d = dashFor(locale);
  // "Hitung mundur": one ticker for the whole dashboard (visible rows only, stops while hidden).
  const words = useMemo(() => messagesFor(locale), [locale]);
  const pageRoot = useRef<HTMLElement | null>(typeof document === 'undefined' ? null : document.body);
  useCountdownTicker(pageRoot, data?.prefs.dueFormat === 'countdown', timeZone, words);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `${d.nav[route.page] ?? d.nav.ringkasan} · Sulo`;
  }, [locale, d, route.page]);

  if (!data) return null;
  // Jadwal exists only while the NEOSIA module is on; its old links land on the overview.
  const neosiaOn = data.neosia.module.enabled;
  const page = !neosiaOn && NEOSIA_PAGES.has(route.page) ? 'ringkasan' : route.page;
  const Page = PAGES[page];
  const connected = data.user !== null && data.view.onboarded;
  const blocked = !connected && !WITHOUT_ACCOUNT.has(page);

  // Mata kuliah reloads the course list itself; the others sync tasks and updates.
  const reloadsCourses = page === 'mata-kuliah';
  const refresh = async (): Promise<boolean> => {
    setSyncing(true);
    const outcome = await actions.sync(reloadsCourses);
    setSyncing(false);
    return refreshFeedback(outcome, data.view.lastSyncAt, Math.floor(Date.now() / 1000)) === 'up-to-date';
  };

  return (
    <I18nProvider locale={locale}>
      <PrivacyProvider value={data.prefs.privacyMode}>
      <ToastProvider>
      {data.neosia.module.enabled && <NeosiaArrivals snapshots={data.neosia.snapshots} page={page} />}
      <DashboardShell
        page={page}
        d={d}
        unseen={data.view.updatesUnseen}
        lastSyncAt={data.view.lastSyncAt}
        now={data.now}
        syncing={syncing || data.view.syncing}
        // Another SIKOLA account is signed in: no refresh and no "Diperbarui" in the header (the M4 message card explains).
        onRefresh={connected && !data.pending && (REFRESH_PAGES.has(page) || reloadsCourses) ? refresh : null}
        refreshLabel={reloadsCourses ? d.mataKuliah.refreshList : undefined}
        showUpdated={!reloadsCourses}
        onOpenPrivacy={() => actions.openTab(browser.runtime.getURL('/privacy.html'))}
        hiddenPages={neosiaOn ? undefined : NEOSIA_PAGES}
        privacy={SENSITIVE_PAGES.has(page) ? { on: data.prefs.privacyMode, toggle: () => void actions.setPrefs({ privacyMode: !data.prefs.privacyMode }) } : null}
      >
        {DevSession && devSession ? (
          <Suspense fallback={null}>
            <DevSession />
          </Suspense>
        ) : blocked ? (
          data.pending !== null ? (
            <MismatchCard deferred={data.pending.deferredAt !== null} onUseNew={() => void actions.send({ type: 'account/useNew' })} onDefer={() => void actions.send({ type: 'account/defer' })} />
          ) : (
            <NotConnected d={d} mismatch={false} onSetup={() => actions.openTab(browser.runtime.getURL('/onboarding.html'))} />
          )
        ) : (
          <>
            {/* The popup's status line (packages/ui/src/status-line.tsx), one line under the header, no box. */}
            {DATA_PAGES.has(page) && data.view.banner && (
              <StatusLine
                banner={data.view.banner}
                className="-mt-2 mb-4"
                actions={{
                  onOpenSikola: () => actions.openTab(sikolaUrl('expired')),
                  onRefresh: () => void refresh(),
                  onReport: () => openSettingsAt('set-laporan'),
                  onOpenReminders: () => openSettingsAt('set-notifikasi'),
                }}
              />
            )}
            <Suspense fallback={<p className="text-[14px] text-muted-foreground">{d.common.loading}</p>}>
              <Page d={d} data={data} actions={actions} route={page === route.page ? route : { page, detail: null }} />
            </Suspense>
          </>
        )}
      </DashboardShell>
      </ToastProvider>
      </PrivacyProvider>
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
