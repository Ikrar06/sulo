import { describe, expect, it } from 'vitest';
import { type FlowContext, nextStep, previousStep, progressOf, skipStep, type StepDef, visibleSteps } from '@sulo/core/onboarding/flow';
import { pendingWhatsNew, type WhatsNewEntry } from '@sulo/core/onboarding/whats-new';

const ctx: FlowContext = { completed: false };
const steps: StepDef[] = [
  { id: 'intro', optional: false, show: () => true },
  { id: 'connect', optional: false, show: () => true },
  { id: 'extra', optional: true, show: (c) => !c.completed },
  { id: 'done', optional: false, show: () => true },
];

describe('onboarding flow', () => {
  it('lists the steps whose condition holds', () => {
    expect(visibleSteps(steps, ctx).map((s) => s.id)).toEqual(['intro', 'connect', 'extra', 'done']);
    expect(visibleSteps(steps, { completed: true }).map((s) => s.id)).toEqual(['intro', 'connect', 'done']);
  });

  it('moves forward and back through visible steps only', () => {
    const shown = visibleSteps(steps, { completed: true });
    expect(nextStep(shown, 'connect')).toBe('done');
    expect(nextStep(shown, 'done')).toBeNull();
    expect(previousStep(shown, 'done')).toBe('connect');
    expect(previousStep(shown, 'intro')).toBeNull();
  });

  it('reports progress as a 1-based position', () => {
    expect(progressOf(visibleSteps(steps, ctx), 'extra')).toEqual({ position: 3, total: 4 });
  });

  it('records a skipped optional step once, and refuses to skip a required one', () => {
    const state = { completedAt: null, confirmedInProgress: [], reviewSuggested: [] };
    const once = skipStep(state, steps[2]!);
    expect(once.skippedSteps).toEqual(['extra']);
    expect(skipStep(once, steps[2]!).skippedSteps).toEqual(['extra']);
    expect(state).not.toHaveProperty('skippedSteps');
    expect(() => skipStep(state, steps[0]!)).toThrow();
  });
});

describe("what's new", () => {
  const entries: WhatsNewEntry[] = [
    { noticeVersion: 2, id: 'a', title: { id: 'A', en: 'A' }, body: { id: 'a', en: 'a' } },
    { noticeVersion: 3, id: 'b', title: { id: 'B', en: 'B' }, body: { id: 'b', en: 'b' } },
  ];

  it('shows entries newer than the notice version the user read', () => {
    expect(pendingWhatsNew(entries, 2, true).map((e) => e.id)).toEqual(['b']);
  });

  it('shows nothing to someone who has not finished onboarding', () => {
    expect(pendingWhatsNew(entries, 1, false)).toEqual([]);
  });

  it('shows nothing when there are no entries', () => {
    expect(pendingWhatsNew([], 0, true)).toEqual([]);
  });

  it('1.1.0 shows at most three entries on each platform, each in both languages, newer than notice version 1', async () => {
    const { WHATS_NEW } = await import('@sulo/core/onboarding/whats-new');
    const { NOTICE_VERSION } = await import('@sulo/core/storage');
    const current = WHATS_NEW.filter((e) => e.noticeVersion === NOTICE_VERSION);
    expect(current.length).toBeGreaterThan(0);
    for (const platform of ['extension', 'android', 'ios'] as const) {
      const shown = pendingWhatsNew(WHATS_NEW, NOTICE_VERSION - 1, true, platform);
      expect(shown.length).toBeGreaterThan(0);
      expect(shown.length).toBeLessThanOrEqual(3);
    }
    for (const e of current) for (const t of [e.title, e.body]) expect(t.id && t.en).toBeTruthy();
  });
});
