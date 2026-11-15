import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { OnboardingShell, StepConnect, StepCourses, StepDone, StepIntro, type ConnectStatus } from '@/components/onboarding/Steps';
import { createBrowserStore } from '@/lib/browser-store';
import { activeCourseIds } from '@/lib/courses/active-score';
import { id } from '@/lib/i18n/id';
import type { Message } from '@/lib/messages';
import { SIKOLA_ORIGIN } from '@/lib/moodle/limits';
import { isValidSesskey } from '@/lib/sesskey';
import { currentUser, NOTICE_KEY, NOTICE_VERSION, readUser, writeUser } from '@/lib/storage';
import { pendingTasks } from '@/lib/tasks/group';
import type { CourseId, CourseRecord, SyncOutcome } from '@/lib/types';
import '@/assets/tailwind.css';

// Onboarding in a full tab. Opened on install, from the popup ("Lanjutkan
// pengaturan"), or at step 3 with #courses ("Atur mata kuliah").

const local = createBrowserStore(browser.storage.local);
const session = createBrowserStore(browser.storage.session);
type Step = 1 | 2 | 3 | 4;

const syncFromOnboarding = async (): Promise<SyncOutcome | null> => {
  try {
    return ((await browser.runtime.sendMessage({ type: 'sync/request', trigger: 'onboarding' } satisfies Message)) as SyncOutcome) ?? null;
  } catch {
    return null;
  }
};

const outcomeText = (o: SyncOutcome | null): string => {
  if (!o) return id.unexpectedError;
  switch (o.status) {
    case 'session_expired':
    case 'invalid_sesskey':
      return id.result.session_expired;
    case 'offline':
      return id.result.offline;
    case 'server_error':
      return id.result.server_error;
    case 'parser_broken':
      return id.result.parser_broken;
    case 'skipped':
      return o.reason === 'BUDGET_EXHAUSTED' ? id.result.budget_exhausted : o.reason === 'DISABLED_REMOTELY' ? id.result.disabled_remotely : id.result.no_sesskey;
    default:
      return '';
  }
};

function App() {
  const [step, setStep] = useState<Step>(1);
  const [noticeOutdated, setNoticeOutdated] = useState(false);
  const [connect, setConnect] = useState<ConnectStatus>('checking');
  const [failedReason, setFailedReason] = useState('');
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [summary, setSummary] = useState({ tasks: 0, courses: 0 });
  const [saving, setSaving] = useState(false);
  const connecting = useRef(false);

  const loadCourses = useCallback(async () => {
    const userId = await currentUser(local);
    if (userId !== null) setCourses(await readUser(local, userId, 'courses'));
  }, []);

  // Start: notice read already? jump to courses with #courses?
  useEffect(() => {
    void (async () => {
      const notice = await local.get<{ version: number }>(NOTICE_KEY);
      const read = notice?.version ?? 0;
      setNoticeOutdated(read > 0 && read < NOTICE_VERSION);
      const userId = await currentUser(local);
      const hasCourses = userId !== null && (await readUser(local, userId, 'courses')).length > 0;
      if (location.hash === '#courses' && read >= NOTICE_VERSION && hasCourses) {
        await loadCourses();
        setStep(3);
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
    const outcome = await syncFromOnboarding();
    connecting.current = false;
    if (outcome?.status === 'ok') {
      await loadCourses();
      setStep(3);
    } else if (outcome?.status === 'session_expired' || outcome?.status === 'invalid_sesskey') {
      setConnect('need_login');
    } else {
      setFailedReason(outcomeText(outcome));
      setConnect('failed');
    }
  }, [loadCourses]);

  // Step 2 notices a fresh sesskey from the content script without a reload.
  useEffect(() => {
    if (step !== 2) return;
    void tryConnect();
    const onChange = (changes: Record<string, unknown>, area: string) => {
      if (area === 'session' && 'sesskey' in changes) void tryConnect();
    };
    browser.storage.onChanged.addListener(onChange);
    return () => browser.storage.onChanged.removeListener(onChange);
  }, [step, tryConnect]);

  const writeCourses = async (next: CourseRecord[]) => {
    setCourses(next);
    const userId = await currentUser(local);
    if (userId !== null) await writeUser(local, userId, 'courses', next);
  };

  const onToggle = (courseId: CourseId, active: boolean) =>
    void writeCourses(courses.map((c) => (c.id === courseId ? { ...c, activePin: active } : c)));

  const onReset = () => void writeCourses(courses.map((c) => ({ ...c, activePin: null })));

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
      const active = activeCourseIds(courses);
      const [tasks, state] = await Promise.all([readUser(local, userId, 'tasks'), readUser(local, userId, 'taskState')]);
      setSummary({ tasks: pendingTasks(tasks, state, active).length, courses: active.size });
    }
    setSaving(false);
    setStep(4);
  };

  const onIntroDone = async () => {
    await local.set(NOTICE_KEY, { version: NOTICE_VERSION });
    setStep(2);
  };

  const mascot = step === 4 ? 'celebrate' : step === 2 && connect === 'failed' ? 'sleepy' : 'onboarding';

  return (
    <OnboardingShell step={step} mascot={mascot}>
      {step === 1 && <StepIntro noticeOutdated={noticeOutdated} onContinue={() => void onIntroDone()} />}
      {step === 2 && (
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
      {step === 3 && <StepCourses courses={courses} onToggle={onToggle} onReset={onReset} onSave={() => void onSave()} saving={saving} />}
      {step === 4 && <StepDone tasks={summary.tasks} courses={summary.courses} onClose={() => window.close()} />}
    </OnboardingShell>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Onboarding root element not found');
document.title = id.onboarding.pageTitle;
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
