import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS helper shared with the screenshot scripts
import { demoNeosia } from '../scripts/lib/demo-neosia.mjs';
import { CAPTURE_SCHEMA_VERSION, CAPTURE_TYPE } from '@sulo/core/neosia/allowlist';
import { parseCapture } from '@sulo/core/neosia/schema';

describe('synthetic NEOSIA demo data (guide and screenshots)', () => {
  it('every snapshot has the exact shape a capture may have', () => {
    const storage = demoNeosia(1_794_000_000) as Record<string, { endpoint: string; data: unknown }>;
    const snaps = Object.entries(storage).filter(([k]) => k.startsWith('neosia:snap:'));
    expect(snaps.length).toBeGreaterThan(5);
    for (const [, s] of snaps) {
      expect(parseCapture({ type: CAPTURE_TYPE, v: CAPTURE_SCHEMA_VERSION, endpoint: s.endpoint, status: 'ok', data: s.data, at: 1 }), s.endpoint).not.toBeNull();
    }
  });
});

describe('GPA check on the synthetic demo transcript', () => {
  it("Sulo's count matches NEOSIA's GPA (3.06) and passed credits (31)", async () => {
    const { computeIpk, passedSks, readTranscript, differsFromNeosia } = await import('@sulo/core/grades/transcript');
    const storage = demoNeosia(1_794_000_000) as Record<string, { data: never }>;
    const rows = readTranscript(storage['neosia:snap:getTranskripMahasiswa']!.data);
    expect(computeIpk(rows)).toBe(3.06);
    expect(passedSks(rows)).toBe(31);
    expect(differsFromNeosia(computeIpk(rows), 3.06)).toBe(false);
  });
});

describe('transcript diagnostics on the synthetic demo (reported for M7.1)', () => {
  it('every row maps to a semester through semesters[].id', async () => {
    const { readSemesters, readTranscript, transcriptDiagnostics } = await import('@sulo/core/grades/transcript');
    const storage = demoNeosia(1_794_000_000) as Record<string, { data: never }>;
    const rows = readTranscript(storage['neosia:snap:getTranskripMahasiswa']!.data);
    const semesters = readSemesters(storage['neosia:snap:mahasiswa/semester']!.data);
    expect(transcriptDiagnostics(rows, semesters)).toEqual({ stored: 13, counted: 12, mapped: 13, notUsed: 1, noLetter: 0, noCredits: 0, noSemester: 0 });
  });
});

describe('MKPK on the synthetic demo', () => {
  it('shows passed, enrolled and offered MKPK courses, and estimates 20 credits', async () => {
    const { summarizeTranscript } = await import('@sulo/core/mkpk/transcript');
    const { mkpkProgress } = await import('@sulo/core/mkpk/progress');
    const { estimateLoad } = await import('@sulo/core/mkpk/load');
    const storage = demoNeosia(1_794_000_000) as Record<string, { data: never }>;
    const snapshots = Object.fromEntries(Object.entries(storage).filter(([k]) => k.startsWith('neosia:snap:')).map(([k, v]) => [k.slice('neosia:snap:'.length), v]));
    const summary = summarizeTranscript(storage['neosia:snap:getTranskripMahasiswa']!.data, 1)!;
    const p = mkpkProgress(snapshots as never, summary);
    expect(p).toMatchObject({ applies: true, passedSks: 4, enrolledSks: 4 });
    expect(p.offered.map((o) => o.name)).toEqual(['Komunikasi Digital', 'Pengambilan Keputusan', 'Pengembangan Talenta']);
    expect(estimateLoad(summary.letters)).toBe(20);
  });
});
