import React, { useEffect, useState, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { Mascot } from '@/components/mascot/Mascot';
import { OnboardingShell, StepConnect, StepCourses, StepDone, StepIntro, type ConnectStatus } from '@/components/onboarding/Steps';
import { PopupView, type PopupActions } from '@/components/popup/PopupView';
import type { CourseId, CourseRecord } from '@/lib/types';
import type { MascotState } from '@/lib/view/popup-view';
import { manyCourses, NOW, POPUP_STATES, PREVIEW_COURSES } from './fixtures';
import '@/assets/tailwind.css';

// Dev-only preview (excluded from production builds): renders the popup and
// every onboarding step from synthetic fixtures in all states, in light and
// dark, so the UI can be reviewed without logging in to SIKOLA.
// ?only=popup renders a single popup, used to measure render time.

const noop: PopupActions = {
  onDone: () => {},
  onOpenTask: () => {},
  onRefresh: () => {},
  onCopy: () => {},
  onOpenOnboarding: () => {},
  onOpenSikola: () => {},
  onReport: () => {},
  onOpenPrivacy: () => {},
};

function Themes({ children }: { children: (theme: 'light' | 'dark') => ReactNode }) {
  return (
    <div className="flex flex-wrap gap-4">
      {(['dark', 'light'] as const).map((theme) => (
        <div key={theme} data-theme={theme} className="rounded-lg border border-border bg-background text-foreground shadow-sm">
          {children(theme)}
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg">{title}</h2>
      {children}
    </section>
  );
}

function CoursesPreview({ initial }: { initial: CourseRecord[] }) {
  const [courses, setCourses] = useState(initial);
  const toggle = (id: CourseId, active: boolean) => setCourses((cs) => cs.map((c) => (c.id === id ? { ...c, activePin: active } : c)));
  return <StepCourses courses={courses} onToggle={toggle} onReset={() => setCourses((cs) => cs.map((c) => ({ ...c, activePin: null })))} onSave={() => {}} />;
}

const MASCOT_STATES: MascotState[] = ['idle', 'syncing', 'all-done', 'celebrate', 'urgent', 'sleepy', 'dizzy', 'onboarding'];
const CONNECT: ConnectStatus[] = ['checking', 'need_login', 'waiting', 'connected', 'failed'];

function Swatches() {
  const pairs = [
    ['Merah urgensi (terlambat)', 'bg-urgency-overdue', 'text-urgency-overdue'],
    ['Crimson brand', 'bg-brand-crimson', 'text-brand-crimson'],
    ['Oranye brand (tombol)', 'bg-brand-orange', 'text-brand-orange'],
    ['Kuning urgensi (< 24 jam)', 'bg-urgency-soon', 'text-urgency-soon'],
    ['Amber brand', 'bg-brand-amber', 'text-brand-amber'],
    ['Biru urgensi (< 3 hari)', 'bg-urgency-week', 'text-urgency-week'],
  ] as const;
  return (
    <Themes>
      {() => (
        <ul className="space-y-2 p-4 text-sm">
          {pairs.map(([label, bg, text]) => (
            <li key={label} className="flex items-center gap-3">
              <span className={`size-2 rounded-full ${bg}`} />
              <span className={`h-6 w-16 rounded ${bg}`} />
              <span className={`w-52 ${text}`}>{label}</span>
              <span className={`text-xs tabular-nums ${text}`}>terlambat 2 hari</span>
            </li>
          ))}
        </ul>
      )}
    </Themes>
  );
}

function Preview() {
  return (
    <main className="mx-auto max-w-[1400px] space-y-10 p-6 text-foreground">
      <header className="space-y-1">
        <h1 className="text-xl">Pratinjau Sulo (build dev)</h1>
        <p className="text-sm text-muted-foreground">Data sintetis. Waktu dikunci ke Selasa, 22 September 2026, 12.00 WITA.</p>
      </header>

      <Section title="Merah urgensi dan crimson brand (tinjauan M2)">
        <Swatches />
      </Section>

      <Section title="Maskot">
        <Themes>
          {() => (
            <div className="flex flex-wrap gap-4 p-4">
              {MASCOT_STATES.map((s) => (
                <figure key={s} className="flex flex-col items-center gap-1 text-xs">
                  <Mascot state={s} size={64} />
                  <figcaption>{s}</figcaption>
                </figure>
              ))}
              <figure className="flex flex-col items-center gap-1 text-xs">
                <Mascot state="idle" size={64} still />
                <figcaption>idle (statis)</figcaption>
              </figure>
            </div>
          )}
        </Themes>
      </Section>

      <Section title="Popup">
        <div className="space-y-8">
          {POPUP_STATES.map(({ title, view }) => (
            <div key={title} className="space-y-2">
              <h3 className="text-sm">{title}</h3>
              <Themes>{() => <PopupView view={view} now={NOW} {...noop} dev={null} />}</Themes>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Onboarding">
        <div className="space-y-8">
          <Themes>{() => <OnboardingShell step={1} mascot="onboarding"><StepIntro noticeOutdated={false} onContinue={() => {}} /></OnboardingShell>}</Themes>
          <Themes>{() => <OnboardingShell step={1} mascot="onboarding"><StepIntro noticeOutdated onContinue={() => {}} /></OnboardingShell>}</Themes>
          {CONNECT.map((status) => (
            <Themes key={status}>
              {() => (
                <OnboardingShell step={2} mascot={status === 'failed' ? 'sleepy' : 'onboarding'}>
                  <StepConnect status={status} failedReason="Tidak terhubung ke SIKOLA." onOpenSikola={() => {}} onRetry={() => {}} />
                </OnboardingShell>
              )}
            </Themes>
          ))}
          <Themes>{() => <OnboardingShell step={3} mascot="onboarding"><CoursesPreview initial={PREVIEW_COURSES} /></OnboardingShell>}</Themes>
          <Themes>{() => <OnboardingShell step={3} mascot="onboarding"><CoursesPreview initial={manyCourses()} /></OnboardingShell>}</Themes>
          <Themes>{() => <OnboardingShell step={4} mascot="celebrate"><StepDone tasks={6} courses={4} onClose={() => {}} /></OnboardingShell>}</Themes>
        </div>
      </Section>
    </main>
  );
}

/** One popup, for measuring: records ms from navigation start to the first commit. */
function SinglePopup({ still }: { still: boolean }) {
  useEffect(() => {
    (window as unknown as { __suloRenderMs?: number }).__suloRenderMs = Math.round(performance.now());
  }, []);
  return <PopupView view={POPUP_STATES[0]!.view} now={NOW} {...noop} dev={null} mascotStill={still} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Preview root element not found');
const only = new URLSearchParams(location.search).get('only');
const still = new URLSearchParams(location.search).has('still');
ReactDOM.createRoot(root).render(<React.StrictMode>{only === 'popup' ? <SinglePopup still={still} /> : <Preview />}</React.StrictMode>);
