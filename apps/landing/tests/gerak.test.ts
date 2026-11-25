// The page decides how much it moves before its first paint, in a few lines
// of inline script (tata/Dasar.astro), by the phone app's own rule for a weak
// device (core perf/tier.ts). This keeps the two the same.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LITE_MAX_CORES, LITE_MAX_RAM_MB } from '@sulo/core/perf/tier';

const dasar = readFileSync(new URL('../src/tata/Dasar.astro', import.meta.url), 'utf8');

describe('tingkat gerak di kepala halaman', () => {
  it('memakai batas memori dan inti yang sama dengan aplikasi', () => {
    expect(dasar).toContain(`mem * 1024 <= ${LITE_MAX_RAM_MB}`);
    expect(dasar).toContain(`inti <= ${LITE_MAX_CORES}`);
  });
  it('diam di bawah reduced motion', () => {
    expect(dasar).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
  });
});
