import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { CoursesFooter, StepCourses } from '@/components/onboarding/CourseStep';
import { ConnectIllustration, connectVisual } from '@/components/onboarding/illustrations';
import { SampleCard } from '@/components/onboarding/SampleCard';
import { OnboardingShell } from '@/components/onboarding/Shell';
import { StepConnect, StepDone, StepIntro, StepWhatsNew, type ConnectStatus } from '@/components/onboarding/Steps';
import { createBrowserStore } from '@/lib/browser-store';
import { isCourseActive } from '@/lib/courses/active-score';
import { systemClock } from '@/lib/clock';
import { I18nProvider, useI18n } from '@/components/i18n';
import { messagesFor, resolveLocale, type Messages } from '@/lib/i18n';
import { readPrefs } from '@/lib/prefs';
import type { Message } from '@/lib/messages';
import { SIKOLA_ORIGIN } from '@/lib/moodle/limits';
import { isValidSesskey } from '@/lib/sesskey';
import { currentUser, NOTICE_KEY, NOTICE_VERSION, readUser, writeUser } from '@/lib/storage';
import { nextStep, ONBOARDING_STEPS, progressOf, visibleSteps, type M2StepId } from '@/lib/onboarding/flow';
import { pendingWhatsNew, WHATS_NEW, type WhatsNewEntry } from '@/lib/onboarding/whats-new';
import { loadPopupInput } from '@/lib/view/load';
import { buildPopupView, type PopupView } from '@/lib/view/popup-view';
import type { CourseId, CourseRecord, SyncOutcome } from '@/lib/types';
import '@/assets/tailwind.css';

// Onboarding in a full tab. Opened on install, from the popup ("Lanjutkan
// pengaturan"), at the course step with #courses ("Atur mata kuliah"), or as
// "Yang baru di Sulo" with #whats-new after an update. The steps come from
// lib/onboarding/flow.ts; this page only renders the current one.

const local = createBrowserStore(browser.storage.local);
const session = createBrowserStore(browser.storage.session);
type Screen = M2StepId | 'whats-new';
/** How long the lit wire stays on screen before the course step. */
const CONNECTED_PAUSE_MS = 900;
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const syncFromOnboarding = async (): Promise<SyncOutcome | null> => {
  try {
    return ((await browser.runtime.sendMessage({ type: 'sync/request', trigger: 'onboarding' } satisfies Message)) as SyncOutcome) ?? null;
  } catch {
    return null;
  }
};

const outcomeText = (o: SyncOutcome | null, m: Messages): string => {
  if (!o) return m.unexpectedError;
  switch (o.status) {
    case 'session_expired':
    case 'invalid_sesskey':
      return m.result.session_expired;
    case 'offline':
      return m.result.offline;
    case 'server_error':
      return m.result.server_error;
    case 'parser_broken':
      return m.result.parser_broken;
    case 'skipped':
      return o.reason === 'BUDGET_EXHAUSTED' ? m.result.budget_exhausted : o.reason === 'DISABLED_REMOTELY' ? m.result.disabled_remotely : m.result.no_sesskey;
    default:
      return '';
  }
};

function App() {
  const { m } = useI18n();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [completed, setCompleted] = useState(false);
  const [noticeRead, setNoticeRead] = useState(0);
  const [whatsNew, setWhatsNew] = useState<WhatsNewEntry[]>([]);
  const [connect, setConnect] = useState<ConnectStatus>('checking');
  const [failedReason, setFailedReason] = useState('');
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [ownView, setOwnView] = useState<PopupView | null>(null);
  const [saving, setSaving] = useState(false);
  const [doneNote, setDoneNote] = useState<string | null>(null);
  const connecting = useRef(false);

  const steps = visibleSteps(ONBOARDING_STEPS, { completed });
  const goNext = (from: M2StepId) => setScreen(nextStep(steps, from));

  const loadCourses = useCallback(async () => {
    const userId = await currentUser(local);
    if (userId !== null) setCourses(await readUser(local, userId, 'courses'));
  }, []);

  // Where to start: #courses, "Yang baru", or the first step.
  useEffect(() => {
    void (async () => {
      const read = (await local.get<{ version: number }>(NOTICE_KEY))?.version ?? 0;
      const userId = await currentUser(local);
      const done = userId !== null && (await readUser(local, userId, 'onboarding')).completedAt !== null;
      const hasCourses = userId !== null && (await readUser(local, userId, 'courses')).length > 0;
      const pending = pendingWhatsNew(WHATS_NEW, read, done);
      setNoticeRead(read);
      setCompleted(done);
      setWhatsNew(pending);
      if (location.hash === '#courses' && read >= NOTICE_VERSION && hasCourses) {
        await loadCourses();
        setScreen('courses');
      } else if (done && (pending.length > 0 || read < NOTICE_VERSION)) {
        setScreen('whats-new');
      } else {
        setScreen('intro');
      }
    })();
  }, [loadCourses]);

  const tryConnect = useCallback(async () => {
    if (connecting.current) return;
    connecting.current = true;
    setConnect('checking');
    const sesskey = await session.get<string>('sesskey');
    if (!isValidSesskey(sesskey)) {
      setConnect('need_login');
      connecting.current = false;
      return;
    }
    setConnect('connected');
    const [outcome] = await Promise.all([syncFromOnboarding(), new Promise((r) => window.setTimeout(r, CONNECTED_PAUSE_MS))]);
    connecting.current = false;
    if (outcome?.status === 'ok') {
      await loadCourses();
      setScreen('courses');
    } else if (outcome?.status === 'session_expired' || outcome?.status === 'invalid_sesskey') {
      setConnect('need_login');
    } else {
      setFailedReason(outcomeText(outcome, m));
      setConnect('failed');
    }
  }, [loadCourses, m]);

  // The connect step notices a fresh sesskey from the content script without a reload.
  useEffect(() => {
    if (screen !== 'connect') return;
    void tryConnect();
    const onChange = (changes: Record<string, unknown>, area: string) => {
      if (area === 'session' && 'sesskey' in changes) void tryConnect();
    };
    browser.storage.onChanged.addListener(onChange);
    return () => browser.storage.onChanged.removeListener(onChange);
  }, [screen, tryConnect]);

  const writeCourses = async (next: CourseRecord[]) => {
    setCourses(next);
    const userId = await currentUser(local);
    if (userId !== null) await writeUser(local, userId, 'courses', next);
  };

  const onToggle = (courseId: CourseId, active: boolean) =>
    void writeCourses(courses.map((c) => (c.id === courseId ? { ...c, activePin: active } : c)));

  const onSave = async () => {
    setSaving(true);
    const userId = await currentUser(local);
    if (userId !== null) {
      const onboarding = await readUser(local, userId, 'onboarding');
      await writeUser(local, userId, 'onboarding', {
        ...onboarding,
        completedAt: onboarding.completedAt ?? Math.floor(Date.now() / 1000),
        confirmedInProgress: courses.filter((c) => c.inProgress).map((c) => c.id),
        reviewSuggested: [],
      });
      // The done step shows the user's own list in the same popup component.
      setOwnView(buildPopupView(await loadPopupInput(local, systemClock, timeZone)));
    }
    setSaving(false);
    goNext('courses');
  };

  const onNoticeRead = async (then: Screen | null) => {
    await local.set(NOTICE_KEY, { version: NOTICE_VERSION });
    setNoticeRead(NOTICE_VERSION);
    setScreen(then);
  };

  // chrome.action.openPopup() needs a user gesture and is not available in
  // every browser version. If it fails, tell the user where the icon is.
  const onOpenPopup = async () => {
    try {
      await browser.action.openPopup();
      window.close();
    } catch {
      setDoneNote(m.onboarding.done.openFallback);
    }
  };

  if (screen === null) return null;

  if (screen === 'whats-new') {
    return (
      <OnboardingShell stepKey="whats-new">
        <StepWhatsNew entries={whatsNew} noticeChanged={noticeRead < NOTICE_VERSION} onDone={() => void onNoticeRead(null).then(() => window.close())} />
      </OnboardingShell>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const visual = connectVisual(connect);
  const aside =
    screen === 'intro' ? (
      <SampleCard now={now} timeZone={timeZone} mascot="onboarding" />
    ) : screen === 'connect' ? (
      <ConnectIllustration wire={visual.wire} mascot={visual.mascot} />
    ) : screen === 'done' && ownView ? (
      <SampleCard now={now} timeZone={timeZone} mascot="all-done" celebrate={1} view={ownView} label={m.onboarding.done.listLabel} />
    ) : undefined;

  return (
    <OnboardingShell
      stepKey={screen}
      progress={progressOf(steps, screen)}
      aside={aside}
      full={screen === 'courses'}
      footer={screen === 'courses' ? <CoursesFooter selected={courses.filter(isCourseActive).length} saving={saving} onNext={() => void onSave()} /> : undefined}
    >
      {screen === 'intro' && <StepIntro noticeOutdated={noticeRead > 0 && noticeRead < NOTICE_VERSION} onContinue={() => void onNoticeRead(nextStep(steps, 'intro'))} />}
      {screen === 'connect' && (
        <StepConnect
          status={connect}
          failedReason={failedReason}
          onOpenSikola={() => {
            setConnect('waiting');
            void browser.tabs.create({ url: `${SIKOLA_ORIGIN}/my/` });
          }}
          onRetry={() => void tryConnect()}
        />
      )}
      {screen === 'courses' && <StepCourses courses={courses} onToggle={onToggle} />}
      {screen === 'done' && <StepDone tasks={ownView?.pendingCount ?? 0} note={doneNote} onOpen={() => void onOpenPopup()} />}
    </OnboardingShell>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Onboarding root element not found');
// The language is resolved before the first render: stored choice, else the browser's.
void readPrefs(local).then((prefs) => {
  const locale = resolveLocale(prefs.locale, browser.i18n.getUILanguage());
  document.documentElement.lang = locale;
  document.title = messagesFor(locale).onboarding.pageTitle;
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <I18nProvider locale={locale}>
        <App />
      </I18nProvider>
    </React.StrictMode>,
  );
});
