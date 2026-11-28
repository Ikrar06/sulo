import React, { useEffect, useState, type ReactNode } from 'react';
import { WHATS_NEW } from '@sulo/core/onboarding/whats-new';
import { NOTICE_VERSION } from '@sulo/core/storage';
import ReactDOM from 'react-dom/client';
import { MOODS, type Mood } from '@sulo/ui/mascot/moods';
import { SuloMascot } from '@sulo/ui/mascot/SuloMascot';
import { CoursesFooter, StepCourses } from '@/components/onboarding/CourseStep';
import { OnboardingShell } from '@/components/onboarding/Shell';
import { Journey } from '@/components/onboarding/journey';
import { INTRO_PAGES, IntroText, introScene, WhyDialog } from '@/components/onboarding/journey-intro';
import { ConnectText, SceneConnect } from '@/components/onboarding/journey-connect';
import { CoursesText, SceneCourses } from '@/components/onboarding/journey-courses';
import { DoneText, doneTasks, SceneDone } from '@/components/onboarding/journey-done';
import { ScenePreparing } from '@/components/onboarding/journey-preparing';
import { StepWhatsNew, type ConnectStatus } from '@/components/onboarding/Steps';
import { ONBOARDING_STEPS, progressOf, type M2StepId } from '@sulo/core/onboarding/flow';
import { I18nProvider } from '@sulo/ui/i18n';
import { NO_ACTIONS, PopupView } from '@/components/popup/PopupView';
import { messagesFor, type Locale } from '@sulo/core/i18n';
import type { DueFormat } from '@sulo/core/prefs';
import { DEFAULT_REMINDERS } from '@sulo/core/reminders/settings';
import { DEFAULT_UPDATES } from '@sulo/core/radar/settings';
import { buildPopupView } from '@sulo/core/view/popup-view';
import { Button } from '@sulo/ui/ui/button';
import { isCourseActive } from '@sulo/core/courses/active-score';
import { id } from '@sulo/core/i18n/id';
import type { CourseId, CourseRecord } from '@sulo/core/types';
import type { MascotState } from '@sulo/core/view/popup-view';
import { NotificationMock, RemindersSim } from './RemindersSim';
import { RadarSim } from './RadarSim';
import { noticeView } from '@sulo/core/reminders/text';
import { courseAlias } from '@sulo/core/courses/display-name';
import { manyCourses, NOW, POPUP_STATES, PREVIEW_COURSES, TZ } from './fixtures';
import '@/assets/tailwind.css';
import { installInputModality } from '@/lib/ui/input-modality';

// Dev-only preview (excluded from production builds), from synthetic fixtures.
// Routes (query string):
//   (none)                               overview: mascot playground, colors, every popup state
//   ?only=popup[&still]                  one popup, for measuring render time
//   ?popup=N&theme=dark|light            one popup state at 380 px, for screenshots
//   ?onboarding=1..4[&connect=..][&many][&notice]&theme=..   one full-screen onboarding step
//   ?mascots&theme=..                    every mascot state, large, for screenshots

// Focus rings for keyboard users only (see assets/tailwind.css).
installInputModality(document, document.documentElement);


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

/** Switch expressions and replay the celebration on a large mascot. */
function MascotPlayground() {
  const [state, setState] = useState<Mood>('neutral');
  const [celebrate, setCelebrate] = useState(0);
  const [follow, setFollow] = useState(true);
  return (
    <Themes>
      {() => (
        <div className="flex w-[620px] flex-col items-center gap-4 p-5">
          <SuloMascot mood={state} size={240} reaction={celebrate > 0 ? { name: 'celebrate', key: celebrate } : null} followCursor={follow} effects grounded />
          <div className="flex flex-wrap justify-center gap-1.5">
            {MOODS.map((s) => (
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
              {MOODS.map((s) => (
                <figure key={s} className="flex flex-col items-center gap-1 text-xs">
                  <SuloMascot mood={s} size={72} />
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
              <Themes>{() => <PopupView view={view} now={NOW} timeZone={TZ} dueFormat={dueFormat} reminders={DEFAULT_REMINDERS} updatesSettings={DEFAULT_UPDATES} {...NO_ACTIONS} dev={null} />}</Themes>
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

/** The onboarding journey (Tahap 2), one step at a time, synthetic data:
 *  ?onboarding=1&page=0..2[&why]   the intro's pages ("Kenapa aman?" open with &why)
 *  ?onboarding=2&connect=checking|waiting|need_login|connected|failed[&why]
 *  ?onboarding=2&prep=0..3[&fail]   "Menyiapkan Sulo" with that many stages done (the next one failed)
 *  ?onboarding=3[&many|&none]       courses (many, or none chosen)
 *  ?onboarding=4[&notasks]          done (with no task) */
function OnboardingPage({ step }: { step: number }) {
  const connect = (params.get('connect') as ConnectStatus | null) ?? 'waiting';
  const prep = params.has('prep') ? Number(params.get('prep')) : null;
  const start = params.has('many') ? manyCourses() : PREVIEW_COURSES;
  const [courses, setCourses] = useState<CourseRecord[]>(params.has('none') ? start.map((c) => ({ ...c, activePin: false })) : start);
  const [page, setPage] = useState(Number(params.get('page') ?? 0));
  const [why, setWhy] = useState(params.has('why'));
  const toggle = (courseId: CourseId, active: boolean) => setCourses((cs) => cs.map((c) => (c.id === courseId ? { ...c, activePin: active } : c)));
  const stepId = STEP_IDS[step - 1]!;
  const own = localized(0);
  const pm = messagesFor(lang);
  const tasks = params.has('notasks') ? [] : doneTasks(own.groups);
  // &fail: the stage after the finished ones failed (the sync's own failure shows the same way).
  const fail = params.has('fail');
  const stages = prep === null ? [] : (['tasks', 'courses', 'attendance'] as const).slice(0, prep + (fail ? 1 : 0)).map((stage, i) => ({ stage, result: fail && i === prep ? ('failed' as const) : ('ok' as const) }));
  const selected = courses.filter(isCourseActive).length;
  const scene =
    stepId === 'intro' ? introScene(page) : stepId === 'connect' ? (prep !== null ? <ScenePreparing stages={stages} counts={{ tasks: 12, courses: 5 }} failed={fail} /> : <SceneConnect />) : stepId === 'courses' ? <SceneCourses courses={courses} onToggle={toggle} /> : <SceneDone tasks={tasks} />;
  return (
    <Journey stepKey={stepId === 'intro' ? `intro-${page}` : prep !== null ? 'preparing' : stepId} progress={stepId === 'intro' ? undefined : progressOf(ONBOARDING_STEPS.filter((s) => s.id !== 'intro'), stepId)} onSkip={stepId === 'intro' ? () => {} : undefined} scene={scene} sceneInteractive={stepId === 'courses'} footnote={pm.disclaimerShort}>
      {stepId === 'intro' && <IntroText page={page} onNext={() => setPage(Math.min(INTRO_PAGES - 1, page + 1))} onGo={setPage} onBack={page > 0 ? () => setPage(page - 1) : undefined} onWhy={() => setWhy(true)} />}
      {stepId === 'connect' && <ConnectText phase={prep !== null ? (fail ? 'failed' : 'connected') : connect} preparing={prep !== null} stages={stages} failedReason={pm.result.server_error} switching={false} onOpen={() => {}} onRetry={() => {}} onWhy={() => setWhy(true)} />}
      {stepId === 'courses' && <CoursesText selected={selected} saving={false} onNext={() => {}} />}
      {stepId === 'done' && <DoneText tasks={tasks.length === 0 ? 0 : own.pendingCount} courses={selected} onOpen={() => {}} />}
      <WhyDialog open={why} onOpenChange={setWhy} outdated={params.has('notice') ? pm.onboarding.intro.noticeUpdated : undefined} onPrivacy={() => {}} />
    </Journey>
  );
}

// The real 1.1.0 entries; the one with the watch switch needs the service worker, so the preview leaves it out.
function WhatsNewPage() {
  return (
    <OnboardingShell stepKey="whats-new">
      <StepWhatsNew
        entries={WHATS_NEW.filter((e) => e.noticeVersion === NOTICE_VERSION && e.action === undefined)}
        noticeChanged
        onDone={() => {}}
      />
    </OnboardingShell>
  );
}

/** Every expression at screenshot size. */
function MascotSheet() {
  return (
    <main className="grid grid-cols-3 gap-6 p-8 text-foreground">
      {MOODS.map((s) => (
        <figure key={s} className="flex flex-col items-center gap-2 rounded-xl bg-surface p-4 text-sm">
          <SuloMascot mood={s} size={160} effects />
          <figcaption>{s}</figcaption>
        </figure>
      ))}
    </main>
  );
}

/** One popup, for measuring: records ms from navigation start to the first commit. */
/** Example notifications in both languages, for review and screenshots. */
function NotificationGallery() {
  const input = POPUP_STATES[0]!.input;
  const tasks = input.user!.tasks.filter((t) => t.dueAt !== null && t.dueAt > NOW).sort((a, b) => a.dueAt! - b.dueAt!);
  const byId = new Map(input.user!.courses.map((c) => [c.id, c]));
  const courseName = (t: (typeof tasks)[number]) => (byId.get(t.courseId) ? courseAlias(byId.get(t.courseId)!) : '');
  const nearest = tasks[0]!;
  return (
    <main className="grid grid-cols-2 gap-6 p-6 text-foreground">
      {(['id', 'en'] as Locale[]).map((l) => {
        const m = messagesFor(l);
        const ctx = { now: NOW, timeZone: TZ, m, courseName };
        return (
          <section key={l} className="space-y-3">
            <h2 className="text-sm text-muted-foreground">{l === 'id' ? 'Bahasa Indonesia' : 'English'}</h2>
            <NotificationMock view={noticeView({ kind: 'task', key: 'k', task: nearest, snoozed: false }, ctx)} />
            <NotificationMock view={noticeView({ kind: 'summary', key: 'k', count: 3, nearest }, ctx)} />
            <NotificationMock view={noticeView({ kind: 'morning', key: 'k', today: 1, week: 3, nearest }, ctx)} />
            <NotificationMock view={noticeView({ kind: 'session', key: 'k', repeat: false }, ctx)} />
          </section>
        );
      })}
    </main>
  );
}

function SinglePopup({ still, index = 0 }: { still: boolean; index?: number }) {
  useEffect(() => {
    (window as unknown as { __suloRenderMs?: number }).__suloRenderMs = Math.round(performance.now());
  }, []);
  return (
    <div className="w-[380px]">
      <PopupView initialPanel={params.get('panel') === 'reminders' ? 'reminders' : params.get('panel') === 'updates' ? 'updates' : undefined} view={localized(index)} now={NOW} timeZone={TZ} dueFormat={dueFormat} reminders={DEFAULT_REMINDERS} updatesSettings={DEFAULT_UPDATES} {...NO_ACTIONS} dev={null} mascotStill={still} />
    </div>
  );
}

/**
 * One large mascot for recordings: ?mascot=<expression>[&celebrate] (the
 * celebration starts 600 ms after load, on top of the expression).
 */
function MascotStage() {
  const asked = params.get('mascot') as Mood | null;
  const state: Mood = asked && MOODS.includes(asked) ? asked : 'neutral';
  const [celebrate, setCelebrate] = useState(0);
  useEffect(() => {
    if (!params.has('celebrate')) return;
    const t = window.setTimeout(() => setCelebrate(1), 600);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <SuloMascot mood={state} size={Number(params.get('size')) || 300} reaction={celebrate > 0 ? { name: 'celebrate', key: celebrate } : null} effects={!params.has('nofx')} grounded motion={params.has('still') ? 'off' : undefined} />
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
                  reminders={DEFAULT_REMINDERS} updatesSettings={DEFAULT_UPDATES} {...NO_ACTIONS}
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
  if (params.has('radar')) return <RadarSim />;
  if (params.has('reminders')) return <RemindersSim input={POPUP_STATES[0]!.input} start={NOW} />;
  if (params.has('notifications')) return <NotificationGallery />;
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
