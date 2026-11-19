import { describe, expect, it } from 'vitest';
import { BUDGET_EXCEPTIONS, budgetedTexts, onboardingWords, SUPPORT_MAX, TITLE_MAX } from '@sulo/core/i18n/mobile-onboarding';

describe('onboarding text budget', () => {
  for (const locale of ['id', 'en'] as const) {
    const { titles, supports } = budgetedTexts(onboardingWords(locale));
    it(`${locale}: titles at most ${TITLE_MAX} characters`, () => {
      for (const t of titles) if (!BUDGET_EXCEPTIONS.includes(t)) expect(t.length, t).toBeLessThanOrEqual(TITLE_MAX);
    });
    it(`${locale}: supporting lines at most ${SUPPORT_MAX} characters, one sentence or two short ones`, () => {
      for (const t of supports) if (!BUDGET_EXCEPTIONS.includes(t)) expect(t.length, t).toBeLessThanOrEqual(SUPPORT_MAX);
    });
  }
  it('the exceptions are the owner\'s exact copy, each over by a single character', () => {
    expect(BUDGET_EXCEPTIONS).toEqual(['Your data stays on your phone', 'Data from the previous account on this phone will be removed.']);
    expect(BUDGET_EXCEPTIONS[0]!.length).toBe(TITLE_MAX + 1);
    expect(BUDGET_EXCEPTIONS[1]!.length).toBe(SUPPORT_MAX + 1);
  });
  it('the disclosure on the watch switch is kept word for word', () => {
    expect(onboardingWords('id').reminders.watchBody).toBe('Sulo mengecek SIKOLA berkala di latar belakang.');
    expect(onboardingWords('id').sheets.watch).toContain('Sesi SIKOLA ikut tetap aktif.');
    expect(onboardingWords('en').sheets.watch).toContain('keeps your SIKOLA session active');
  });
});
