import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sikolaUrl } from '@sulo/core/links';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { AccountMismatch } from '@/components/onboarding/AccountMismatch';
import { CoursesFooter, StepCourses } from '@/components/onboarding/CourseStep';
import { ConnectIllustration, connectVisual } from '@/components/onboarding/illustrations';
import { ManageFooter, ManageNoChanges, ManageSaved } from '@/components/onboarding/ManageCourses';
import { SampleCard } from '@/components/onboarding/SampleCard';
import { OnboardingShell } from '@/components/onboarding/Shell';
import { StepConnect, StepDone, StepIntro, StepWhatsNew, type ConnectStatus } from '@/components/onboarding/Steps';
import { ACCOUNT_PENDING_KEY, readPending } from '@sulo/core/account/pending';
import { accountStatus, decideOnboardingMode, resumeStep, SETUP_PROGRESS_KEY, setupStatus, type OnboardingMode } from '@sulo/core/account/state';
import { createBrowserStore } from '@/src/platform/store';
import { isCourseActive } from '@sulo/core/courses/active-score';
import { systemClock } from '@sulo/core/clock';
import { I18nProvider, useI18n } from '@/components/i18n';
import { Button } from '@/components/ui/button';
import { messagesFor, resolveLocale, type Messages } from '@sulo/core/i18n';
import { readPrefs } from '@sulo/core/prefs';
import type { Message } from '@/lib/messages';
import { readSession } from '@sulo/core/moodle/session';
import { isValidSesskey } from '@sulo/core/sesskey';
import { CURRENT_USER_KEY, currentUser, NOTICE_KEY, NOTICE_VERSION, readUser, writeUserIfCurrent } from '@sulo/core/storage';
import { hasCourseChanges, mergeDraft, toggleDraft } from '@sulo/core/onboarding/course-draft';
import { nextStep, ONBOARDING_STEPS, progressOf, visibleSteps, type M2StepId } from '@sulo/core/onboarding/flow';
import { pendingWhatsNew, WHATS_NEW, type WhatsNewEntry } from '@sulo/core/onboarding/whats-new';
import { loadPopupInput } from '@sulo/core/view/load';
import { buildPopupView, type PopupView } from '@sulo/core/view/popup-view';
import type { CourseId, CourseRecord, SyncOutcome } from '@sulo/core/types';
import '@/assets/tailwind.css';
import { installInputModality } from '@/lib/ui/input-modality';
import { applyTheme } from '@/lib/ui/theme';

// The setup page in a full tab: one flow, four modes (lib/account/state.ts):
// - first-run: resumes at the last step reached (global:setupProgress)
// - manage-courses (#courses): "Mata kuliahmu", no progress dots, cached list
//   plus "Segarkan daftar", saved only on "Simpan"
// - switch-account (#switch-account): starts at the connect step
// - whats-new: one short screen after an update
// While another SIKOLA account is detected, it shows the same two choices as
// the popup instead.

// Focus rings for keyboard users only (see assets/tailwind.css).
installInputModality(document, document.documentElement);

const local = createBrowserStore(browser.storage.local);
const session = createBrowserStore(browser.storage.session);
type Screen = M2StepId | 'whats-new' | 'mismatch' | 'saved' | 'no-changes';
/** How long the lit wire stays on screen before the course step. */
const CONNECTED_PAUSE_MS = 900;
/** "Tidak ada perubahan" stays this long before the tab closes. */
const NO_CHANGES_MS = 1100;
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const sendMessage = async <T,>(message: Message): Promise<T | null> => {
  try {
    return ((await browser.runtime.sendMessage(message)) as T) ?? null;
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
      if (o.reason === 'BUSY') return m.popup.updating;
      return o.reason === 'BUDGET_EXHAUSTED' ? m.result.budget_exhausted : o.reason === 'DISABLED_REMOTELY' ? m.result.disabled_remotely : m.result.no_sesskey;
    default:
      return '';
  }
};

function App() {
  const { m } = useI18n();
  const [mode, setMode] = useState<OnboardingMode | null>(null);
  const [screen, setScreen] = useState<Screen | null>(null);
  const [completed, setCompleted] = useState(false);
  const [noticeRead, setNoticeRead] = useState(0);
  const [whatsNew, setWhatsNew] = useState<WhatsNewEntry[]>([]);
  const [connect, setConnect] = useState<ConnectStatus>('checking');
  const [failedReason, setFailedReason] = useState('');
  // The stored list and the draft the user edits; only "Simpan" writes.
  const [storedCourses, setStoredCourses] = useState<CourseRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [ownView, setOwnView] = useState<PopupView | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [manageNote, setManageNote] = useState<string | null>(null);
  const [doneNote, setDoneNote] = useState<string | null>(null);
  // The account this tab works for, once its courses are loaded. Every write
  // checks it is still the active account (compare-and-set); otherwise the
  // tab stops and asks to reload instead of writing into another account.
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [accountChanged, setAccountChanged] = useState(false);
  const connecting = useRef(false);

  const steps = visibleSteps(ONBOARDING_STEPS, { completed, mode: mode === 'switch-account' ? 'switch-account' : 'first-run' });
  const goNext = (from: M2StepId) => setScreen(nextStep(steps, from));

  const loadCourses = useCallback(async () => {
    const userId = await currentUser(local);
    if (userId !== null) {
      const list = await readUser(local, userId, 'courses');
      setOwnerId(userId);
      setStoredCourses(list);
      setCourses(list);
    }
  }, []);

  // Another account became active (logged in on SIKOLA in another tab), or
  // another account was detected while this one is stored.
  useEffect(() => {
    const onChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local') return;
      const account = changes[CURRENT_USER_KEY];
      if (account && ownerId !== null && account.newValue !== ownerId) setAccountChanged(true);
      if (changes[ACCOUNT_PENDING_KEY]?.newValue) setScreen('mismatch');
    };
    browser.storage.onChanged.addListener(onChange);
    return () => browser.storage.onChanged.removeListener(onChange);
  }, [ownerId]);

  // Which mode, and where it starts.
  useEffect(() => {
    void (async () => {
      const read = (await local.get<{ version: number }>(NOTICE_KEY))?.version ?? 0;
      const userId = await currentUser(local);
      const done = userId !== null && (await readUser(local, userId, 'onboarding')).completedAt !== null;
      const hasCourses = userId !== null && (await readUser(local, userId, 'courses')).length > 0;
      const entries = pendingWhatsNew(WHATS_NEW, read, done);
      const account = accountStatus({ hasUser: userId !== null, session: (await readSession(local)).state, pending: await readPending(local) });
      const next = decideOnboardingMode({
        hash: location.hash,
        account,
        setup: setupStatus({ hasUser: userId !== null, completedAt: done ? 0 : null }),
        hasCourses,
        whatsNew: entries.length > 0 || read < NOTICE_VERSION,
      });
      setNoticeRead(read);
      setCompleted(done);
      setWhatsNew(entries);
      setMode(next);
      if (next === 'mismatch') return setScreen('mismatch');
      if (next === 'whats-new') return setScreen('whats-new');
      if (next === 'switch-account') return setScreen('connect');
      if (next === 'manage-courses') {
        await loadCourses();
        return setScreen('courses');
      }
      const saved = (await local.get<{ step: M2StepId }>(SETUP_PROGRESS_KEY))?.step ?? null;
      const start = resumeStep({ saved, noticeRead: read >= NOTICE_VERSION, hasUser: userId !== null, hasCourses });
      if (start === 'courses') await loadCourses();
      setScreen(start);
    })();
  }, [loadCourses]);

  // First-run remembers the step it reached, so closing the tab resumes there.
  useEffect(() => {
    if (mode !== 'first-run' || (screen !== 'intro' && screen !== 'connect' && screen !== 'courses')) return;
    void local.set(SETUP_PROGRESS_KEY, { step: screen });
  }, [mode, screen]);

  // Setup is thrifty (docs/ATURAN-REQUEST.md): at most one automatic sync
  // per onboarding session, none after a success, and data younger than 5
  // minutes is reused (runSync answers FRESH without a request). A new
  // sesskey only retries after the session was gone, once per sesskey.
  // "Coba lagi" still syncs, subject to single-flight and the budget.
  const synced = useRef(false);
  const autoTriedFor = useRef<string | null | undefined>(undefined);

  const tryConnect = useCallback(
    async (reason: 'auto' | 'retry') => {
      if (connecting.current || synced.current) return;
      const sesskey = await session.get<string>('sesskey');
      const key = isValidSesskey(sesskey) ? sesskey : null;
      if (reason === 'auto') {
        if (autoTriedFor.current !== undefined && autoTriedFor.current === key) return;
        // Without a sesskey, one automatic try is enough (it may fetch /my/ once per 6 hours).
        if (autoTriedFor.current !== undefined && key === null) return;
        autoTriedFor.current = key;
      }
      connecting.current = true;
      setConnect(key ? 'connected' : 'checking');
      const [outcome] = await Promise.all([
        sendMessage<SyncOutcome>({ type: 'sync/request', trigger: 'onboarding' }),
        new Promise((r) => window.setTimeout(r, key ? CONNECTED_PAUSE_MS : 0)),
      ]);
      connecting.current = false;
      const fresh = outcome?.status === 'skipped' && outcome.reason === 'FRESH';
      if (outcome?.status === 'account_mismatch') {
        setScreen('mismatch');
      } else if (outcome?.status === 'ok' || fresh) {
        synced.current = true;
        setConnect('connected');
        await loadCourses();
        setScreen('courses');
      } else if (
        outcome?.status === 'session_expired' ||
        outcome?.status === 'invalid_sesskey' ||
        (outcome?.status === 'skipped' && (outcome.reason === 'NO_SESSKEY' || outcome.reason === 'SESSION_EXPIRED'))
      ) {
        setConnect('need_login');
      } else {
        setFailedReason(outcomeText(outcome, m));
        setConnect('failed');
      }
    },
    [loadCourses, m],
  );

  // The connect step notices a fresh sesskey from the content script without a reload.
  useEffect(() => {
    if (screen !== 'connect') return;
    void tryConnect('auto');
    const onChange = (changes: Record<string, unknown>, area: string) => {
      if (area === 'session' && 'sesskey' in changes) void tryConnect('auto');
    };
    browser.storage.onChanged.addListener(onChange);
    return () => browser.storage.onChanged.removeListener(onChange);
  }, [screen, tryConnect]);

  const onToggle = (courseId: CourseId, active: boolean) => setCourses((draft) => toggleDraft(draft, courseId, active));

  /** Writes the draft and the confirmation for the owner account only; false when the account changed. */
  const saveChoice = async (): Promise<boolean> => {
    if (ownerId === null) return false;
    if (!(await writeUserIfCurrent(local, ownerId, 'courses', courses))) return false;
    const onboarding = await readUser(local, ownerId, 'onboarding');
    return writeUserIfCurrent(local, ownerId, 'onboarding', {
      ...onboarding,
      completedAt: onboarding.completedAt ?? Math.floor(Date.now() / 1000),
      confirmedInProgress: courses.filter((c) => c.inProgress).map((c) => c.id),
      reviewSuggested: [],
    });
  };

  const onSave = async () => {
    setSaving(true);
    if (!(await saveChoice())) {
      setSaving(false);
      setAccountChanged(true);
      return;
    }
    await local.remove(SETUP_PROGRESS_KEY);
    // The done step shows the user's own list in the same popup component.
    setOwnView(buildPopupView(await loadPopupInput(local, systemClock, timeZone)));
    setSaving(false);
    goNext('courses');
  };

  /** "Simpan" in "Mata kuliahmu": nothing changed closes the tab after a short note. */
  const onManageSave = async () => {
    if (!hasCourseChanges(storedCourses, courses)) {
      setScreen('no-changes');
      window.setTimeout(() => window.close(), NO_CHANGES_MS);
      return;
    }
    setSaving(true);
    const ok = await saveChoice();
    setSaving(false);
    if (!ok) return setAccountChanged(true);
    setStoredCourses(courses);
    setScreen('saved');
  };

  /** "Segarkan daftar": one sync that fetches the course list even within 24 hours. */
  const onRefreshList = async () => {
    setRefreshing(true);
    setManageNote(null);
    const outcome = await sendMessage<SyncOutcome>({ type: 'sync/request', trigger: 'onboarding', forceCourseList: true });
    if (outcome?.status === 'ok' && ownerId !== null) {
      const refreshed = await readUser(local, ownerId, 'courses');
      setCourses(mergeDraft(refreshed, courses, storedCourses));
      setStoredCourses(refreshed);
      setManageNote(m.onboarding.manage.refreshed);
    } else if (outcome?.status === 'account_mismatch') {
      setScreen('mismatch');
    } else {
      setManageNote(outcomeText(outcome, m));
    }
    setRefreshing(false);
  };

  const onNoticeRead = async (then: Screen | null) => {
    await local.set(NOTICE_KEY, { version: NOTICE_VERSION });
    setNoticeRead(NOTICE_VERSION);
    setScreen(then);
  };

  // chrome.action.openPopup() needs a user gesture and is not available in
  // every browser version. If it fails, tell the user where the icon is.
  const onOpenPopup = async (setNote: (note: string) => void) => {
    try {
      await browser.action.openPopup();
      window.close();
    } catch {
      setNote(m.onboarding.done.openFallback);
    }
  };

  if (screen === null) return null;

  if (accountChanged) {
    return (
      <OnboardingShell stepKey="account-changed">
        <div className="space-y-6">
          <h1 className="font-heading text-[clamp(34px,3.2vw,46px)] leading-[1.08] tracking-[-0.02em]">{m.onboarding.accountChanged.title}</h1>
          <p className="max-w-[34em] text-[18px] leading-[1.6] text-foreground/85">{m.onboarding.accountChanged.body}</p>
          <Button size="lg" className="ob-cta" onClick={() => location.reload()}>
            {m.onboarding.accountChanged.reload}
          </Button>
        </div>
      </OnboardingShell>
    );
  }

  if (screen === 'mismatch') {
    return (
      <OnboardingShell stepKey="mismatch">
        <AccountMismatch
          onUseNew={() => void sendMessage({ type: 'account/useNew' }).then(() => window.close())}
          onDefer={() => void sendMessage({ type: 'account/defer' }).then(() => window.close())}
        />
      </OnboardingShell>
    );
  }

  if (screen === 'whats-new') {
    return (
      <OnboardingShell stepKey="whats-new">
        <StepWhatsNew entries={whatsNew} noticeChanged={noticeRead < NOTICE_VERSION} onDone={() => void onNoticeRead(null).then(() => window.close())} />
      </OnboardingShell>
    );
  }

  if (mode === 'manage-courses') {
    if (screen === 'no-changes') {
      return (
        <OnboardingShell stepKey="no-changes">
          <ManageNoChanges />
        </OnboardingShell>
      );
    }
    if (screen === 'saved') {
      return (
        <OnboardingShell stepKey="saved">
          <ManageSaved note={manageNote} onBack={() => void onOpenPopup(setManageNote)} onClose={() => window.close()} />
        </OnboardingShell>
      );
    }
    return (
      <OnboardingShell
        stepKey="manage"
        full
        footer={
          <ManageFooter
            selected={courses.filter(isCourseActive).length}
            saving={saving}
            refreshing={refreshing}
            note={manageNote}
            onRefresh={() => void onRefreshList()}
            onSave={() => void onManageSave()}
          />
        }
      >
        <StepCourses courses={courses} onToggle={onToggle} title={m.onboarding.manage.title} lead={m.onboarding.manage.lead} />
      </OnboardingShell>
    );
  }

  if (screen !== 'intro' && screen !== 'connect' && screen !== 'courses' && screen !== 'done') return null;
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
          lead={mode === 'switch-account' ? m.onboarding.switchAccount.lead : undefined}
          onOpenSikola={() => {
            setConnect('waiting');
            // First setup: no account yet, so the login page. Switching accounts: another account is signed in, so SIKOLA's dashboard.
            void browser.tabs.create({ url: sikolaUrl(mode === 'switch-account' ? 'mismatch' : 'none') });
          }}
          onRetry={() => void tryConnect('retry')}
        />
      )}
      {screen === 'courses' && <StepCourses courses={courses} onToggle={onToggle} />}
      {screen === 'done' && <StepDone tasks={ownView?.pendingCount ?? 0} note={doneNote} onOpen={() => void onOpenPopup(setDoneNote)} />}
    </OnboardingShell>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Onboarding root element not found');
// The language is resolved before the first render: stored choice, else the browser's.
void readPrefs(local).then((prefs) => {
  applyTheme(document.documentElement, prefs.theme);
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
