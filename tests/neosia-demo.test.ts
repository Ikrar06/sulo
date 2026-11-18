import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS helper shared with the screenshot scripts
import { demoNeosia } from '../scripts/lib/demo-neosia.mjs';
import { CAPTURE_SCHEMA_VERSION, CAPTURE_TYPE } from '../lib/neosia/allowlist';
import { parseCapture } from '../lib/neosia/schema';

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
  it("Sulo's count matches NEOSIA's GPA (2.95) and passed credits (27)", async () => {
    const { computeIpk, passedSks, readTranscript, differsFromNeosia } = await import('../lib/grades/transcript');
    const storage = demoNeosia(1_794_000_000) as Record<string, { data: never }>;
    const rows = readTranscript(storage['neosia:snap:getTranskripMahasiswa']!.data);
    expect(computeIpk(rows)).toBe(2.95);
    expect(passedSks(rows)).toBe(27);
    expect(differsFromNeosia(computeIpk(rows), 2.95)).toBe(false);
  });
});

describe('transcript diagnostics on the synthetic demo (reported for M7.1)', () => {
  it('every row maps to a semester through semesters[].id', async () => {
    const { readSemesters, readTranscript, transcriptDiagnostics } = await import('../lib/grades/transcript');
    const storage = demoNeosia(1_794_000_000) as Record<string, { data: never }>;
    const rows = readTranscript(storage['neosia:snap:getTranskripMahasiswa']!.data);
    const semesters = readSemesters(storage['neosia:snap:mahasiswa/semester']!.data);
    expect(transcriptDiagnostics(rows, semesters)).toEqual({ stored: 11, counted: 10, mapped: 11, notUsed: 1, noLetter: 0, noCredits: 0, noSemester: 0 });
  });
});
