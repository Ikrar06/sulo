import React, { useEffect, useState, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { Mascot } from '@/components/mascot/Mascot';
import { CoursesFooter, StepCourses } from '@/components/onboarding/CourseStep';
import { ConnectIllustration, connectVisual } from '@/components/onboarding/illustrations';
import { SampleCard } from '@/components/onboarding/SampleCard';
import { OnboardingShell } from '@/components/onboarding/Shell';
import { StepConnect, StepDone, StepIntro, StepWhatsNew, type ConnectStatus } from '@/components/onboarding/Steps';
import { ONBOARDING_STEPS, progressOf, type M2StepId } from '@/lib/onboarding/flow';
import { I18nProvider } from '@/components/i18n';
import { NO_ACTIONS, PopupView } from '@/components/popup/PopupView';
import { messagesFor, type Locale } from '@/lib/i18n';
import type { DueFormat } from '@/lib/prefs';
import { buildPopupView } from '@/lib/view/popup-view';
import { Button } from '@/components/ui/button';
import { isCourseActive } from '@/lib/courses/active-score';
import { id } from '@/lib/i18n/id';
import type { CourseId, CourseRecord } from '@/lib/types';
import type { MascotState } from '@/lib/view/popup-view';
import { manyCourses, NOW, POPUP_STATES, PREVIEW_COURSES, TZ } from './fixtures';
import '@/assets/tailwind.css';

// Dev-only preview (excluded from production builds), from synthetic fixtures.
// Routes (query string):
//   (none)                               overview: mascot playground, colors, every popup state
//   ?only=popup[&still]                  one popup, for measuring render time
//   ?popup=N&theme=dark|light            one popup state at 380 px, for screenshots
//   ?onboarding=1..4[&connect=..][&many][&notice]&theme=..   one full-screen onboarding step
//   ?mascots&theme=..                    every mascot state, large, for screenshots


const params = new URLSearchParams(location.search);
type Theme = 'light' | 'dark';
const pageTheme: Theme = params.get('theme') === 'light' ? 'light' : 'dark';
const lang: Locale = params.get('lang') === 'en' ? 'en' : 'id';
const dueFormat = (params.get('format') as DueFormat | null) ?? 'both';
/** Rebuild a fixture view in the preview language (fixtures are built in Indonesian). */
const localized = (index: number) => {
  const state = POPUP_STATES[index] ?? POPUP_STATES[0]!;
  return lang === 'id' ? state.view : buildPopupView({ ...state.input, messages: messagesFor('en') });
};

const MASCOT_STATES: MascotState[] = ['idle', 'onboarding', 'syncing', 'all-done', 'celebrate', 'urgent', 'sleepy', 'stale', 'dizzy'];
const CONNECT: ConnectStatus[] = ['checking', 'need_login', 'waiting', 'connected', 'failed'];

function Themes({ children }: { children: (theme: Theme) => ReactNode }) {
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

/** Switch states and replay the celebrate sequence on a large mascot. */
function MascotPlayground() {
  const [state, setState] = useState<MascotState>('idle');
  const [celebrate, setCelebrate] = useState(0);
  const [follow, setFollow] = useState(true);
  return (
    <Themes>
      {() => (
        <div className="flex w-[620px] flex-col items-center gap-4 p-5">
          <Mascot state={state} size={240} celebrate={celebrate} followCursor={follow} effects grounded />
          <div className="flex flex-wrap justify-center gap-1.5">
            {MASCOT_STATES.filter((s) => s !== 'celebrate').map((s) => (
              <Button key={s} size="sm" variant={s === state ? 'default' : 'outline'} onClick={() => setState(s)}>
                {s}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setCelebrate((n) => n + 1)}>
              Rayakan
            </Button>
            <Button size="sm" variant="outline" onClick={() => setFollow((f) => !f)}>
              Ikuti kursor: {follow ? 'ya' : 'tidak'}
            </Button>
          </div>
        </div>
      )}
    </Themes>
  );
}

function Swatches() {
  const pairs = [
    ['Merah urgensi (terlambat)', 'bg-urgency-overdue', 'text-urgency-overdue'],
    ['Crimson brand', 'bg-brand-crimson', 'text-brand-crimson'],
    ['Oranye brand (tombol)', 'bg-brand-orange', 'text-brand-orange'],
    ['Kuning urgensi (< 24 jam)', 'bg-urgency-soon', 'text-urgency-soon'],
    ['Amber brand', 'bg-brand-amber', 'text-brand-amber'],
    ['Biru urgensi (< 3 hari)', 'bg-urgency-week', 'text-urgency-week'],
  ] as const;
  const courses = [1, 2, 3, 4, 5, 6, 7, 8] as const;
  return (
    <Themes>
      {() => (
        <div className="space-y-4 p-4 text-sm">
          <ul className="space-y-2">
            {pairs.map(([label, bg, text]) => (
              <li key={label} className="flex items-center gap-3">
                <span className={`size-2 rounded-full ${bg}`} />
                <span className={`h-6 w-16 rounded ${bg}`} />
                <span className={`w-52 ${text}`}>{label}</span>
                <span className={`text-xs tabular-nums ${text}`}>terlambat 2 hari</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            {courses.map((n) => (
              <span key={n} className="size-4 rounded-full" style={{ background: `var(--course-${n})` }} title={`course-${n}`} />
            ))}
          </div>
        </div>
      )}
    </Themes>
  );
}

function Overview() {
  return (
    <main className="mx-auto max-w-[1400px] space-y-10 p-6 text-foreground">
      <header className="space-y-1">
        <h1 className="text-xl">Pratinjau Sulo (build dev)</h1>
        <p className="text-sm text-muted-foreground">Data sintetis. Waktu dikunci ke Selasa, 22 September 2026, 12.00 WITA.</p>
      </header>
      <Section title="Maskot">
        <MascotPlayground />
        <Themes>
          {() => (
            <div className="flex flex-wrap gap-4 p-4">
              {MASCOT_STATES.map((s) => (
                <figure key={s} className="flex flex-col items-center gap-1 text-xs">
                  <Mascot state={s} size={72} effects />
                  <figcaption>{s}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </Themes>
      </Section>
      <Section title="Warna urgensi, brand, dan mata kuliah">
        <Swatches />
      </Section>
      <Section title="Popup">
        <div className="space-y-8">
          {POPUP_STATES.map(({ title, view }) => (
            <div key={title} className="space-y-2">
              <h3 className="text-sm">{title}</h3>
              <Themes>{() => <PopupView view={view} now={NOW} timeZone={TZ} dueFormat={dueFormat} {...NO_ACTIONS} dev={null} />}</Themes>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Onboarding (layar penuh)">
        <ul className="list-disc pl-5 text-sm">
          {[1, 2, 3, 4].map((n) => (
            <li key={n}>
              <a className="underline" href={`?onboarding=${n}`}>
                Langkah {n}
              </a>
            </li>
          ))}
          {CONNECT.map((c) => (
            <li key={c}>
              <a className="underline" href={`?onboarding=2&connect=${c}`}>
                Langkah 2: {c}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}

const STEP_IDS: M2StepId[] = ['intro', 'connect', 'courses', 'done'];

function OnboardingPage({ step }: { step: number }) {
  const connect = (params.get('connect') as ConnectStatus | null) ?? 'need_login';
  const [courses, setCourses] = useState<CourseRecord[]>(params.has('many') ? manyCourses() : PREVIEW_COURSES);
  const toggle = (courseId: CourseId, active: boolean) => setCourses((cs) => cs.map((c) => (c.id === courseId ? { ...c, activePin: active } : c)));
  const stepId = STEP_IDS[step - 1]!;
  const visual = connectVisual(connect);
  const own = POPUP_STATES[0]!.view;
  const aside =
    stepId === 'intro' ? (
      <SampleCard now={NOW} timeZone={TZ} mascot="onboarding" />
    ) : stepId === 'connect' ? (
      <ConnectIllustration wire={visual.wire} mascot={visual.mascot} />
    ) : stepId === 'done' ? (
      <SampleCard now={NOW} timeZone={TZ} mascot="all-done" celebrate={params.has('still') ? 0 : 1} view={own} label={id.onboarding.done.listLabel} />
    ) : undefined;
  return (
    <OnboardingShell
      stepKey={stepId}
      progress={progressOf(ONBOARDING_STEPS, stepId)}
      aside={aside}
      full={stepId === 'courses'}
      footer={stepId === 'courses' ? <CoursesFooter selected={courses.filter(isCourseActive).length} onNext={() => {}} /> : undefined}
    >
      {stepId === 'intro' && <StepIntro noticeOutdated={params.has('notice')} onContinue={() => {}} />}
      {stepId === 'connect' && <StepConnect status={connect} failedReason="Tidak terhubung ke SIKOLA." onOpenSikola={() => {}} onRetry={() => {}} />}
      {stepId === 'courses' && <StepCourses courses={courses} onToggle={toggle} />}
      {stepId === 'done' && <StepDone tasks={own.pendingCount} note={params.has('fallback') ? id.onboarding.done.openFallback : null} onOpen={() => {}} />}
    </OnboardingShell>
  );
}

function WhatsNewPage() {
  return (
    <OnboardingShell stepKey="whats-new">
      <StepWhatsNew
        entries={[{ noticeVersion: 2, title: 'Contoh fitur baru', body: 'Isi singkat fitur baru, satu atau dua kalimat.' }]}
        noticeChanged
        onDone={() => {}}
      />
    </OnboardingShell>
  );
}

/** Every mascot state at screenshot size. */
function MascotSheet() {
  return (
    <main className="grid grid-cols-3 gap-6 p-8 text-foreground">
      {MASCOT_STATES.map((s) => (
        <figure key={s} className="flex flex-col items-center gap-2 rounded-xl bg-surface p-4 text-sm">
          <Mascot state={s} size={160} effects />
          <figcaption>{s}</figcaption>
        </figure>
      ))}
    </main>
  );
}

/** One popup, for measuring: records ms from navigation start to the first commit. */
function SinglePopup({ still, index = 0 }: { still: boolean; index?: number }) {
  useEffect(() => {
    (window as unknown as { __suloRenderMs?: number }).__suloRenderMs = Math.round(performance.now());
  }, []);
  return (
    <div className="w-[380px]">
      <PopupView view={localized(index)} now={NOW} timeZone={TZ} dueFormat={dueFormat} {...NO_ACTIONS} dev={null} mascotStill={still} />
    </div>
  );
}

/**
 * One large mascot for recordings: ?mascot=<state>[&celebrate] (celebrate
 * starts 600 ms after load, on top of <state>).
 */
function MascotStage() {
  const state = (params.get('mascot') as MascotState | null) || 'idle';
  const [celebrate, setCelebrate] = useState(0);
  useEffect(() => {
    if (!params.has('celebrate')) return;
    const t = window.setTimeout(() => setCelebrate(1), 600);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Mascot state={state} size={Number(params.get('size')) || 300} celebrate={celebrate} effects={!params.has('nofx')} grounded still={params.has('still')} />
    </main>
  );
}

/** Every due format in both languages, side by side: one screenshot to check widths. */
function FormatGrid() {
  const formats: DueFormat[] = ['both', 'remaining', 'clock', 'countdown'];
  return (
    <main className="grid grid-cols-4 gap-4 p-4">
      {(['id', 'en'] as Locale[]).flatMap((l) =>
        formats.map((f) => (
          <I18nProvider key={`${l}-${f}`} locale={l}>
            <figure className="space-y-1">
              <figcaption className="text-xs text-muted-foreground">{`${l} / ${f}`}</figcaption>
              <div className="overflow-hidden rounded-lg border border-border">
                <PopupView
                  view={l === 'id' ? POPUP_STATES[0]!.view : buildPopupView({ ...POPUP_STATES[0]!.input, messages: messagesFor('en') })}
                  now={NOW}
                  timeZone={TZ}
                  dueFormat={f}
                  {...NO_ACTIONS}
                  dev={null}
                  mascotStill
                />
              </div>
            </figure>
          </I18nProvider>
        )),
      )}
    </main>
  );
}

function Route() {
  if (params.has('formats')) return <FormatGrid />;
  if (params.has('mascot')) return <MascotStage />;
  if (params.get('only') === 'popup') return <SinglePopup still={params.has('still')} />;
  if (params.has('popup')) return <SinglePopup still={params.has('still')} index={Number(params.get('popup'))} />;
  if (params.get('onboarding') === 'whats-new') return <WhatsNewPage />;
  const step = Number(params.get('onboarding'));
  if (step >= 1 && step <= 4) return <OnboardingPage step={step} />;
  if (params.has('mascots')) return <MascotSheet />;
  return <Overview />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Preview root element not found');
document.documentElement.dataset.theme = pageTheme;
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <I18nProvider locale={lang}>
      <Route />
    </I18nProvider>
  </React.StrictMode>,
);
