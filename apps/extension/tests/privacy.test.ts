import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRIVACY_INTRO, PRIVACY_SECTIONS } from '@sulo/core/privacy/content';
import { renderPrivacyMarkdown } from '@sulo/core/privacy/render';

describe('privacy policy single source', () => {
  it('PRIVACY.md matches lib/privacy/content.ts (run node scripts/build-privacy.ts)', () => {
    expect(readFileSync(new URL('../../../PRIVACY.md', import.meta.url), 'utf8')).toBe(renderPrivacyMarkdown('en'));
  });

  it('every block has both languages', () => {
    const texts = [...PRIVACY_INTRO, ...PRIVACY_SECTIONS.flatMap((s) => s.blocks)].flatMap((b) => (b.kind === 'p' ? [b.text] : b.items));
    for (const t of texts) {
      expect(t.id.trim().length).toBeGreaterThan(0);
      expect(t.en.trim().length).toBeGreaterThan(0);
    }
    for (const s of PRIVACY_SECTIONS) expect(s.heading.id && s.heading.en).toBeTruthy();
  });

  it('states the unofficial status in both languages', () => {
    expect(renderPrivacyMarkdown('id')).toContain('tidak berafiliasi dengan');
    expect(renderPrivacyMarkdown('en')).toContain('not affiliated with');
  });
});
