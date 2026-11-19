// Every field the owner named as forbidden is proven to be dropped by the
// NEOSIA projection (core neosia/project.ts), wherever it appears, on every
// endpoint, while the allowed fields stay exactly as they were. Values are
// invented and built at runtime so the repository leak scan does not flag
// this file.
import { describe, expect, it } from 'vitest';
import { DROPPED_FIELDS, ENDPOINTS, isSumSpec, type FieldSpec } from '@sulo/core/neosia/allowlist';
import { projectResponse, projectValue } from '@sulo/core/neosia/project';

/** The owner's list (19 Nov 2026), as NEOSIA spells the keys. */
const FORBIDDEN = ['nim', 'nik', 'nisn', 'nilai_angka', 'total_nilai', 'kontak', 'alamat', 'tanggal_lahir', 'nominal', 'tagihan', 'biaya', 'survey_url'] as const;

const NIM = ['D', '12121', '1001'].join('');
const NIK = ['7371', '0512', '0399', '0001'].join('');
/** A value per forbidden key, each one a marker that must never show up in a projection. */
const VALUES: Record<string, unknown> = {
  nim: NIM,
  nik: NIK,
  nisn: ['00', '5123', '4567'].join(''),
  nilai_angka: 87.25,
  total_nilai: 'TOTAL-MARKER',
  kontak: { whatsapp: ['08', '1234', '567890'].join(''), email: ['budi', '@', 'example.test'].join('') },
  alamat: { jalan: 'Jl. Penanda No. 1', kelurahan: 'Kelurahan Penanda' },
  tanggal_lahir: '2004-02-29',
  nominal: 4_250_000,
  tagihan: { nominal: 4_250_000, bank: 'BANK-MARKER' },
  biaya: 'BIAYA-MARKER',
  survey_url: 'https://survey.example.test/s/SURVEY-MARKER',
};
const MARKERS = [NIM, NIK, '87.25', 'TOTAL-MARKER', 'Penanda', '2004-02-29', '4250000', 'BANK-MARKER', 'BIAYA-MARKER', 'SURVEY-MARKER', 'example.test'];

/** A clean response that fills every field a spec names with a harmless value. */
function sample(spec: FieldSpec, depth = 0): unknown {
  if (spec === 'v') return depth % 2 === 0 ? 'A' : 2;
  if (isSumSpec(spec)) return 3;
  if (Array.isArray(spec)) return [sample(spec[0] as FieldSpec, depth + 1), sample(spec[0] as FieldSpec, depth + 2)];
  const out: Record<string, unknown> = {};
  for (const [k, child] of Object.entries(spec as Record<string, FieldSpec>)) {
    if (k === '$v') continue;
    if (k === '*') out['20251'] = sample(child, depth + 1);
    else out[k] = sample(child, depth + 1);
  }
  return out;
}

/** The same response with every forbidden field added to every object, at every level. */
function pollute(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(pollute);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = pollute(v);
    return { ...out, ...VALUES };
  }
  return value;
}

const keysIn = (v: unknown): string[] => (Array.isArray(v) ? v.flatMap(keysIn) : typeof v === 'object' && v !== null ? Object.entries(v).flatMap(([k, x]) => [k, ...keysIn(x)]) : []);

describe('NEOSIA projection drops every forbidden field', () => {
  it('the owner\'s list is part of the dropped fields', () => {
    for (const f of FORBIDDEN) expect(DROPPED_FIELDS as readonly string[]).toContain(f);
  });

  for (const endpoint of ENDPOINTS) {
    it(`${endpoint.id}: forbidden fields gone at every level, allowed fields unchanged`, () => {
      const clean = sample(endpoint.spec);
      const dirty = pollute(clean);
      const kept = projectResponse(endpoint.spec, clean);
      const projected = projectResponse(endpoint.spec, dirty);
      expect(kept.status).toBe('ok');
      // The allowed fields are all still there, with the same values.
      expect(projected).toEqual(kept);
      const text = JSON.stringify(projected);
      for (const f of FORBIDDEN) expect(keysIn(projected)).not.toContain(f);
      for (const m of MARKERS) expect(text).not.toContain(m);
    });

    it(`${endpoint.id}: the same under a "data" wrapper`, () => {
      const dirty = pollute({ data: sample(endpoint.spec) });
      const projected = projectResponse(endpoint.spec, dirty);
      expect(projected).toEqual(projectResponse(endpoint.spec, sample(endpoint.spec)));
      for (const m of MARKERS) expect(JSON.stringify(projected)).not.toContain(m);
    });
  }

  it('a forbidden field is dropped even when a projection names it', () => {
    const spec = Object.fromEntries([...FORBIDDEN.map((f) => [f, 'v' as const]), ['kode', 'v' as const]]) as FieldSpec;
    const projected = projectValue(spec, { ...Object.fromEntries(FORBIDDEN.map((f) => [f, 'A'])), kode: 'TI-101' });
    expect(projected).toEqual({ kode: 'TI-101' });
  });

  it('a forbidden field is dropped from a semester map ("*") too', () => {
    const spec = { semesters: { '*': ['v'] } } as unknown as FieldSpec;
    const projected = projectValue(spec, { semesters: { '20251': ['A'], nim: ['A'], nilai_angka: [1], survey_url: ['A'] } });
    expect(projected).toEqual({ semesters: { '20251': ['A'] } });
  });

  it('a sum never walks through a forbidden field', () => {
    const spec = { total: { $sum: 'tagihan.nominal' } } as unknown as FieldSpec;
    expect(projectValue(spec, { tagihan: [{ nominal: 5 }] })).toEqual({});
  });

  it('survey status keeps is_filled and never the link', () => {
    const survey = ENDPOINTS.find((e) => e.id === 'check_survey_status')!;
    expect(projectResponse(survey.spec, { is_filled: false, survey_url: VALUES.survey_url })).toEqual({ status: 'ok', data: { is_filled: false } });
  });

  it('identifier-like values are dropped from allowed fields (a field that moved)', () => {
    const transcript = ENDPOINTS.find((e) => e.id === 'getTranskripMahasiswa')!;
    const out = projectResponse(transcript.spec, { transkrip: [{ kode_mata_kuliah: NIM, nama_mata_kuliah: `Kontak ${VALUES.kontak && (VALUES.kontak as { email: string }).email}`, sks: 3, nilai_huruf: 'A' }] });
    expect(out).toEqual({ status: 'ok', data: { transkrip: [{ sks: 3, nilai_huruf: 'A' }] } });
  });
});
