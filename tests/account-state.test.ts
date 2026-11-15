import { describe, expect, it } from 'vitest';
import { mayCheckWhilePending, newPending, resolveCheck } from '../lib/account/pending';
import {
  accountStatus,
  decideOnboardingMode,
  decidePopupScreen,
  resumeStep,
  setupStatus,
  type AccountStatus,
  type OnboardingModeInput,
  type SetupStatus,
} from '../lib/account/state';
import { hasCourseChanges, mergeDraft, toggleDraft } from '../lib/onboarding/course-draft';
import { ONBOARDING_STEPS, visibleSteps } from '../lib/onboarding/flow';
import type { CourseRecord } from '../lib/types';

const NOW = 1_794_000_000;
const pending = newPending(2, NOW);

describe('account status', () => {
  it('none, connected, expired, mismatch', () => {
    expect(accountStatus({ hasUser: false, session: 'UNKNOWN', pending: null })).toBe('none');
    expect(accountStatus({ hasUser: true, session: 'OK', pending: null })).toBe('connected');
    expect(accountStatus({ hasUser: true, session: 'EXPIRED', pending: null })).toBe('expired');
    expect(accountStatus({ hasUser: true, session: 'OK', pending })).toBe('mismatch');
    expect(accountStatus({ hasUser: true, session: 'EXPIRED', pending })).toBe('mismatch');
  });

  it('setup status per account', () => {
    expect(setupStatus({ hasUser: false, completedAt: null })).toBe('not_started');
    expect(setupStatus({ hasUser: true, completedAt: null })).toBe('in_progress');
    expect(setupStatus({ hasUser: true, completedAt: NOW })).toBe('done');
  });
});

describe('popup screen (docs/UI.md, "Keputusan layar")', () => {
  const table: [AccountStatus, SetupStatus, string][] = [
    ['none', 'not_started', 'setup'],
    ['connected', 'in_progress', 'setup'],
    ['connected', 'done', 'main'],
    ['expired', 'done', 'main'],
    ['expired', 'in_progress', 'setup'],
    ['mismatch', 'done', 'mismatch'],
    ['mismatch', 'in_progress', 'mismatch'],
  ];
  it.each(table)('%s + %s -> %s', (account, setup, screen) => {
    expect(decidePopupScreen(account, setup)).toBe(screen);
  });
});

describe('setup page mode', () => {
  const base: OnboardingModeInput = { hash: '', account: 'connected', setup: 'done', hasCourses: true, whatsNew: false };
  it('another account always shows the mismatch choices', () => {
    expect(decideOnboardingMode({ ...base, account: 'mismatch', hash: '#courses' })).toBe('mismatch');
  });
  it('#switch-account starts the switch flow', () => {
    expect(decideOnboardingMode({ ...base, hash: '#switch-account', setup: 'in_progress' })).toBe('switch-account');
  });
  it('first-run until setup is done, whatever the hash', () => {
    expect(decideOnboardingMode({ ...base, setup: 'not_started', account: 'none' })).toBe('first-run');
    expect(decideOnboardingMode({ ...base, setup: 'in_progress', hash: '#courses' })).toBe('first-run');
  });
  it('#courses opens "Mata kuliahmu", even when something new waits', () => {
    expect(decideOnboardingMode({ ...base, hash: '#courses', whatsNew: true })).toBe('manage-courses');
  });
  it('after an update with something new: whats-new', () => {
    expect(decideOnboardingMode({ ...base, hash: '#whats-new', whatsNew: true })).toBe('whats-new');
  });
  it('done but no course list stored: the connect step fetches it', () => {
    expect(decideOnboardingMode({ ...base, hasCourses: false })).toBe('switch-account');
  });
});

describe('first-run resumes at the last step', () => {
  it('the notice first when it was not read', () => {
    expect(resumeStep({ saved: 'courses', noticeRead: false, hasUser: true, hasCourses: true })).toBe('intro');
  });
  it('connect until an account and a course list exist', () => {
    expect(resumeStep({ saved: 'connect', noticeRead: true, hasUser: false, hasCourses: false })).toBe('connect');
    expect(resumeStep({ saved: 'courses', noticeRead: true, hasUser: true, hasCourses: false })).toBe('connect');
  });
  it('the course step when it was reached and the list is there', () => {
    expect(resumeStep({ saved: 'courses', noticeRead: true, hasUser: true, hasCourses: true })).toBe('courses');
  });
  it('nothing saved: from the start', () => {
    expect(resumeStep({ saved: null, noticeRead: true, hasUser: true, hasCourses: true })).toBe('intro');
  });
  it('switch-account skips the intro step', () => {
    expect(visibleSteps(ONBOARDING_STEPS, { completed: false, mode: 'switch-account' }).map((s) => s.id)).toEqual(['connect', 'courses', 'done']);
    expect(visibleSteps(ONBOARDING_STEPS, { completed: false }).map((s) => s.id)).toEqual(['intro', 'connect', 'courses', 'done']);
  });
});

describe('checks while another account is detected', () => {
  it('"Perbarui" always; a new sesskey once per 10 minutes; nothing else', () => {
    expect(mayCheckWhilePending(pending, 'manual', NOW)).toBe(true);
    expect(mayCheckWhilePending(pending, 'sesskey', NOW + 9 * 60)).toBe(false);
    expect(mayCheckWhilePending(pending, 'sesskey', NOW + 10 * 60)).toBe(true);
    for (const t of ['background', 'startup', 'idle', 'onboarding']) expect(mayCheckWhilePending(pending, t, NOW + 3600)).toBe(false);
  });

  it('previous account back, same other account, or a third one', () => {
    expect(resolveCheck(1, pending, 1, NOW + 60)).toEqual({ kind: 'restored', next: null });
    expect(resolveCheck(1, pending, 2, NOW + 60)).toEqual({ kind: 'same', next: { ...pending, lastCheckAt: NOW + 60 } });
    expect(resolveCheck(1, pending, 3, NOW + 60)).toEqual({ kind: 'third', next: newPending(3, NOW + 60) });
  });
});

describe('course draft', () => {
  const c = (id: number, activePin: boolean | null): CourseRecord =>
    ({ id, fullname: `C${id}`, shortname: `C${id}`, inProgress: true, past: false, enddate: 0, activeScore: 5, activeReasons: [], activePin }) as unknown as CourseRecord;

  it('detects a changed tick, and none when toggled back', () => {
    const stored = [c(1, null), c(2, true)];
    expect(hasCourseChanges(stored, stored)).toBe(false);
    const draft = toggleDraft(stored, 1, false);
    expect(hasCourseChanges(stored, draft)).toBe(true);
    expect(hasCourseChanges(stored, toggleDraft(toggleDraft(stored, 2, false), 2, true))).toBe(false);
    expect(stored[0]!.activePin).toBeNull(); // never mutated
  });

  it('a refreshed list keeps the ticks made before the refresh', () => {
    const stored = [c(1, null), c(2, true)];
    const draft = toggleDraft(stored, 1, false);
    const refreshed = [c(1, null), c(2, true), c(3, null)];
    expect(mergeDraft(refreshed, draft, stored).map((x) => [x.id, x.activePin])).toEqual([[1, false], [2, true], [3, null]]);
  });
});
