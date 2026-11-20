// The new-version texts (M8e E3) keep docs/UI.md's text budget: titles at
// most 28 characters, supporting lines at most 60, in both languages. They
// are reviewed again in the copywriting audit.
import { describe, expect, it } from 'vitest';
import { mobileWords } from '@sulo/core/i18n/mobile';

describe('release texts', () => {
  for (const lang of ['id', 'en'] as const) {
    it(`fit the budget (${lang})`, () => {
      const t = mobileWords(lang).release;
      for (const title of [t.title, t.requiredTitle, t.aboutRow('0.9.12')]) expect([title, title.length <= 28]).toEqual([title, true]);
      for (const line of [t.requiredBody, t.requiredData, t.howTo, t.version('0.9.12')]) expect([line, line.length <= 60]).toEqual([line, true]);
      for (const word of [t.download, t.later, t.copy, t.copied, t.sha]) expect(word.length).toBeLessThanOrEqual(12);
    });
  }
});
