import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GUIDE_STEPS } from '../lib/help/guide';

describe('"Mulai pakai" guide', () => {
  it('has six steps; the first one is the drawn toolbar, the rest have pictures', () => {
    expect(GUIDE_STEPS).toHaveLength(6);
    expect(GUIDE_STEPS[0]!.image).toBeNull();
    expect(GUIDE_STEPS.slice(1).every((s) => s.image !== null)).toBe(true);
  });

  it('every picture exists in both themes and both languages, as local WebP files', () => {
    for (const s of GUIDE_STEPS.filter((x) => x.image))
      for (const theme of ['light', 'dark'])
        for (const locale of ['id', 'en']) expect(existsSync(`public/guide/${s.image}-${theme}-${locale}.webp`), `${s.image}-${theme}-${locale}`).toBe(true);
  });

  it('markers sit inside the picture and every one has text in both languages', () => {
    for (const s of GUIDE_STEPS) {
      expect(s.markers.length).toBeGreaterThan(0);
      for (const m of s.markers) {
        for (const locale of ['id', 'en'] as const) {
          const [x, y] = m.at[locale];
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(100);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(100);
          expect(m.text[locale].length).toBeGreaterThan(0);
        }
      }
      expect(s.alt.id && s.alt.en).toBeTruthy();
    }
  });
});
