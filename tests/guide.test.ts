import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GUIDE_STEPS } from '../lib/help/guide';

describe('"Mulai pakai" guide', () => {
  it('has six steps; the first one is the drawn toolbar, the rest have clips', () => {
    expect(GUIDE_STEPS).toHaveLength(6);
    expect(GUIDE_STEPS[0]!.clip).toBeNull();
    expect(GUIDE_STEPS.slice(1).every((s) => s.clip !== null)).toBe(true);
  });

  it('every clip exists as local WebM with a WebP poster, in both themes and both languages', () => {
    for (const s of GUIDE_STEPS.filter((x) => x.clip))
      for (const theme of ['light', 'dark'])
        for (const locale of ['id', 'en'])
          for (const ext of ['webm', 'webp']) expect(existsSync(`public/guide/${s.clip}-${theme}-${locale}.${ext}`), `${s.clip}-${theme}-${locale}.${ext}`).toBe(true);
  });

  it('every step lists what it shows, in both languages, with alt text', () => {
    for (const s of GUIDE_STEPS) {
      expect(s.points.length).toBeGreaterThan(0);
      for (const p of s.points) expect(p.id.length > 0 && p.en.length > 0).toBe(true);
      expect(s.alt.id && s.alt.en).toBeTruthy();
    }
  });
});
