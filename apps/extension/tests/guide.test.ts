import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GUIDE_STEPS, GUIDE_TIP } from '@sulo/core/help/guide';

describe('"Mulai pakai" guide', () => {
  it('has eight steps (the last two need NEOSIA), each with a clip; pinning is a tip, not a step', () => {
    expect(GUIDE_STEPS.map((s) => s.clip)).toEqual(['popup', 'tugas', 'mata-kuliah', 'presensi', 'kalender', 'kabar', 'jadwal', 'neosia']);
    expect(GUIDE_TIP.id).toMatch(/puzzle/);
  });

  it('every clip exists as local WebM with a WebP poster, in both themes and both languages', () => {
    for (const s of GUIDE_STEPS)
      for (const theme of ['light', 'dark'])
        for (const locale of ['id', 'en'])
          for (const ext of ['webm', 'webp']) expect(existsSync(`public/guide/${s.clip}-${theme}-${locale}.${ext}`), `${s.clip}-${theme}-${locale}.${ext}`).toBe(true);
  });

  it('each step states the size its clip was recorded at (scripts/guide/sizes.json, written by pnpm guide:shots)', () => {
    const recorded = JSON.parse(readFileSync('scripts/guide/sizes.json', 'utf8')) as Record<string, { width: number; height: number }>;
    for (const s of GUIDE_STEPS) expect(s.size, s.clip).toEqual(recorded[s.clip]);
  });

  it('every step lists what it shows, in both languages, with alt text', () => {
    for (const s of GUIDE_STEPS) {
      expect(s.points.length).toBeGreaterThan(0);
      for (const p of s.points) expect(p.id.length > 0 && p.en.length > 0).toBe(true);
      expect(s.alt.id && s.alt.en).toBeTruthy();
    }
  });
});
