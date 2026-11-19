// The extension's onboarding keeps the phone's text budget (Tahap 2): titles at
// most 28 characters, supporting lines at most 60, no paragraph (one sentence
// or one line, no line break), in both languages.
import { describe, expect, it } from 'vitest';
import { extBudgetedTexts, extOnboardingWords } from '@sulo/core/i18n/ext-onboarding';
import { SUPPORT_MAX, TITLE_MAX } from '@sulo/core/i18n/mobile-onboarding';

describe('extension onboarding text budget', () => {
  for (const locale of ['id', 'en'] as const) {
    const { titles, supports } = extBudgetedTexts(extOnboardingWords(locale));
    it(`${locale}: titles at most ${TITLE_MAX}`, () => {
      for (const t of titles) expect(t.length, t).toBeLessThanOrEqual(TITLE_MAX);
    });
    it(`${locale}: supporting lines at most ${SUPPORT_MAX}, no paragraph`, () => {
      for (const s of supports) {
        expect(s.length, s).toBeLessThanOrEqual(SUPPORT_MAX);
        expect(s, s).not.toMatch(/\n/);
      }
    });
  }
});
