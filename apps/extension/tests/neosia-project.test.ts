import { describe, expect, it } from 'vitest';
import { DROPPED_FIELDS, ENDPOINTS, isSumSpec, NEVER_READ_PATHS, type FieldSpec } from '@sulo/core/neosia/allowlist';
import { matchUrl, scrubPath } from '@sulo/core/neosia/match';
import { projectResponse, projectValue, sumAt } from '@sulo/core/neosia/project';
import { PLACEHOLDER, SECRET, SYNTHETIC } from './neosia-synthetic';

const DROPPED = new Set<string>(DROPPED_FIELDS);

/** Every key name anywhere in a value. */
function allKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      allKeys(v, out);
    }
  }
  return out;
}

/** Every primitive anywhere in a value, as text. */
function allValues(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => allValues(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => allValues(v, out));
  else out.push(String(value));
  return out;
}

function specKeys(spec: FieldSpec, out = new Set<string>()): Set<string> {
  if (spec === 'v') return out;
  // A computed sum names every key on its path.
  if (isSumSpec(spec)) {
    spec.$sum.split('.').forEach((k) => out.add(k));
    return out;
  }
  if (Array.isArray(spec)) return specKeys(spec[0] as FieldSpec, out);
  for (const [k, v] of Object.entries(spec)) {
    out.add(k);
    specKeys(v as FieldSpec, out);
  }
  return out;
}

/** A tiny deterministic PRNG, so the shuffled cases are the same every run. */
function prng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
}

/** Every synthetic sensitive value, as text. */
const SENSITIVE = Object.values(SECRET).map(String);

describe('the allowlist', () => {
  it('names no dropped field in any projection', () => {
    for (const e of ENDPOINTS) {
      const named = [...specKeys(e.spec)].filter((k) => DROPPED.has(k.toLowerCase()));
      expect(named, e.id).toEqual([]);
    }
  });

  it('never lists survey_url, mahasiswa/mahasiswa or pengunduran-diri-semester', () => {
    expect(ENDPOINTS.some((e) => e.path.includes('mahasiswa/mahasiswa') || e.path.includes('pengunduran'))).toBe(false);
    expect([...ENDPOINTS.flatMap((e) => [...specKeys(e.spec)])]).not.toContain('survey_url');
    expect(NEVER_READ_PATHS).toEqual(['mahasiswa/mahasiswa', 'pengunduran-diri-semester']);
  });

  it('has one entry per endpoint id', () => {
    expect(new Set(ENDPOINTS.map((e) => e.id)).size).toBe(ENDPOINTS.length);
  });
});

describe('golden projections (synthetic responses shaped like the observation)', () => {
  it('covers exactly 12 endpoints', () => {
    expect(ENDPOINTS).toHaveLength(12);
    expect(ENDPOINTS.map((e) => e.id)).toContain('getCurrentPenasihatAkademik');
    expect(ENDPOINTS.map((e) => e.id as string)).not.toContain('getStatusPembayaran');
  });

  for (const e of ENDPOINTS) {
    it(e.id, async () => {
      const result = projectResponse(e.spec, SYNTHETIC[e.id]);
      expect(result.status).toBe('ok');
      await expect(JSON.stringify(result, null, 2) + '\n').toMatchFileSnapshot(`../fixtures/neosia/golden/${e.id.replace('/', '__')}.json`);
    });
  }
});

describe('dropped fields never pass', () => {
  it('none of the synthetic sensitive keys or values survive any projection', () => {
    for (const e of ENDPOINTS) {
      const result = projectResponse(e.spec, SYNTHETIC[e.id]);
      const keys = [...allKeys(result)].filter((k) => DROPPED.has(k));
      const values = allValues(result).filter((v) => SENSITIVE.some((s) => v.includes(s)));
      expect({ endpoint: e.id, keys, values }).toEqual({ endpoint: e.id, keys: [], values: [] });
    }
  });

  it('a dropped field moved into a kept object is still dropped', () => {
    const moved = structuredClone(SYNTHETIC.belanja_krs) as { kartu_rencana_studi: Record<string, unknown> & { kelas_kuliahs: Record<string, unknown>[] } };
    Object.assign(moved.kartu_rencana_studi, { nim: PLACEHOLDER.nim, nik: PLACEHOLDER.nik });
    Object.assign(moved.kartu_rencana_studi.kelas_kuliahs[0]!, { nilai_angka: 91, survey_url: 'x', alamat: 'Jalan Contoh No. 1', whatsapp: SECRET.whatsapp });
    const result = projectResponse(ENDPOINTS.find((e) => e.id === 'belanja_krs')!.spec, moved);
    expect([...allKeys(result)].filter((k) => DROPPED.has(k))).toEqual([]);
  });

  it('a sensitive value that moves into a kept field is dropped', () => {
    const spec = { nama: 'v', kode: 'v', status: 'v', sks: 'v' } as const;
    const out = projectValue(spec, { nama: `Nama ${PLACEHOLDER.nim}`, kode: PLACEHOLDER.nik, status: 'contoh@example.invalid', sks: 9 * 10 ** 17 });
    expect(out).toEqual({});
    expect(projectValue({ status: 'v' }, { status: 'Rp 2.500.000' })).toEqual({});
    expect(projectValue({ nama: 'v' }, { nama: 'telp 081234567890' })).toEqual({});
  });

  it('a kept primitive field that turns into an object is dropped', () => {
    expect(projectValue({ nama: 'v' }, { nama: { nik: PLACEHOLDER.nik } })).toEqual({});
    expect(projectValue({ ipk: 'v' }, { ipk: [PLACEHOLDER.nik] })).toEqual({});
  });

  it('even a spec that names a dropped field cannot copy it', () => {
    expect(projectValue({ nik: 'v', nim: 'v', ok: 'v' } as FieldSpec, { nik: 'x', nim: 'y', ok: 1 })).toEqual({ ok: 1 });
  });

  it('random placements of dropped fields at any depth never pass (300 shuffled cases)', () => {
    const rand = prng(42);
    const inject = (value: unknown, depth: number): unknown => {
      if (Array.isArray(value)) return value.map((v) => inject(v, depth + 1));
      if (!value || typeof value !== 'object') {
        // Sometimes a primitive becomes an object holding a dropped field.
        return rand() < 0.1 ? { [DROPPED_FIELDS[Math.floor(rand() * DROPPED_FIELDS.length)]!]: PLACEHOLDER.nik } : value;
      }
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) out[k] = inject(v, depth + 1);
      if (rand() < 0.6) {
        const field = DROPPED_FIELDS[Math.floor(rand() * DROPPED_FIELDS.length)]!;
        out[field] = rand() < 0.5 ? PLACEHOLDER.nik : { nested: PLACEHOLDER.nim, [field]: PLACEHOLDER.nip };
      }
      // Field order shuffled.
      return Object.fromEntries(Object.entries(out).sort(() => rand() - 0.5));
    };
    for (let i = 0; i < 300; i++) {
      const e = ENDPOINTS[i % ENDPOINTS.length]!;
      const result = projectResponse(e.spec, inject(SYNTHETIC[e.id], 0));
      expect([...allKeys(result)].filter((k) => DROPPED.has(k)), `${e.id} #${i}`).toEqual([]);
      expect(allValues(result).filter((v) => v.includes(PLACEHOLDER.nik) || v.includes(PLACEHOLDER.nim) || v.includes(PLACEHOLDER.nip)), `${e.id} #${i}`).toEqual([]);
    }
  });

  it('a response with none of the known keys is unknown_shape, with no data', () => {
    expect(projectResponse(ENDPOINTS[0]!.spec, { mahasiswa: { nik: PLACEHOLDER.nik } })).toEqual({ status: 'unknown_shape' });
    expect(projectResponse(ENDPOINTS[0]!.spec, 'plain text')).toEqual({ status: 'unknown_shape' });
    expect(projectResponse(ENDPOINTS[0]!.spec, null)).toEqual({ status: 'unknown_shape' });
  });

  it('caps long lists, long strings and deep nesting', () => {
    const many = projectValue(['v'], Array.from({ length: 1000 }, (_, i) => i)) as unknown[];
    expect(many.length).toBe(400);
    expect(projectValue({ nama: 'v' }, { nama: 'x'.repeat(201) })).toEqual({});
  });

  it('survives getters that throw', () => {
    const hostile = Object.defineProperty({}, 'kartu_rencana_studi', {
      enumerable: true,
      get() {
        throw new Error('boom');
      },
    });
    expect(projectResponse(ENDPOINTS[0]!.spec, hostile)).toEqual({ status: 'unknown_shape' });
  });
});

describe('which URLs count', () => {
  it('matches allowlisted paths on the API host only, ignoring the query', () => {
    expect(matchUrl('https://api.neosia.unhas.ac.id/api/mahasiswa/belanja_krs?x=1')).toMatchObject({ kind: 'endpoint', endpoint: { id: 'belanja_krs' } });
    expect(matchUrl('https://api.neosia.unhas.ac.id/api/mahasiswa/belanja_krs/max_sks')).toMatchObject({ kind: 'endpoint', endpoint: { id: 'max_sks' } });
    expect(matchUrl('https://api.neosia.unhas.ac.id/api/mahasiswa/belanja_krs/checkJadwalBelanjaKRS')).toMatchObject({ kind: 'endpoint', endpoint: { id: 'checkJadwalBelanjaKRS' } });
    expect(matchUrl('https://api.neosia.unhas.ac.id/api/mahasiswa/kartu_hasil_studi/semester/20251')).toMatchObject({ kind: 'endpoint', endpoint: { id: 'kartu_hasil_studi/semester' } });
    expect(matchUrl('https://api.neosia.unhas.ac.id/api/mahasiswa/semester')).toMatchObject({ kind: 'endpoint', endpoint: { id: 'mahasiswa/semester' } });
    // Anchored at the root: the same name elsewhere is not the endpoint.
    expect(matchUrl('https://api.neosia.unhas.ac.id/api/dosen/semester')?.kind).toBe('other');
    expect(matchUrl('https://neosia.unhas.ac.id/belanja_krs')).toBeNull();
    expect(matchUrl('https://jsonplaceholder.typicode.com/todos/1')).toBeNull();
    expect(matchUrl('http://api.neosia.unhas.ac.id/belanja_krs')).toBeNull();
    expect(matchUrl('https://api.neosia.unhas.ac.id.example.com/belanja_krs')).toBeNull();
  });

  it('never reads mahasiswa/mahasiswa or pengunduran-diri-semester, even under an allowlisted name', () => {
    expect(matchUrl('https://api.neosia.unhas.ac.id/api/mahasiswa/mahasiswa')?.kind).toBe('never');
    expect(matchUrl('https://api.neosia.unhas.ac.id/api/mahasiswa/mahasiswa/semester')?.kind).toBe('never');
    expect(matchUrl('https://api.neosia.unhas.ac.id/pengunduran-diri-semester/dashboard')?.kind).toBe('never');
  });

  it('other API paths, or an allowlisted name followed by more than ids, are "other"', () => {
    for (const path of ['api/me', 'oauth/token', 'api/notice_board', 'api/feature_flag', 'api/dosen/semester', 'api/mahasiswa/getCurrentPenasihatAkademik']) {
      expect(matchUrl(`https://api.neosia.unhas.ac.id/${path}`)?.kind, path).toBe('other');
    }
    expect(matchUrl('https://api.neosia.unhas.ac.id/api/mahasiswa/dashboard/admin/settings')?.kind).toBe('other');
  });

  it('scrubs ids and student numbers from paths', () => {
    expect(scrubPath(`/api/v1/mahasiswa/${PLACEHOLDER.nim}/transkrip/20251`)).toBe('/api/v1/mahasiswa/{id}/transkrip/{id}');
  });
});

describe('named sensitive values from the observation', () => {
  const projected = JSON.stringify(ENDPOINTS.map((e) => projectResponse(e.spec, SYNTHETIC[e.id])));
  const named = ['nik', 'nisn', 'whatsapp', 'jalan', 'rt', 'rw', 'dusun', 'tanggal_lahir', 'nip', 'nidn', 'nuptk', 'nominal', 'bank', 'nilai_angka', 'total_nilai', 'survey_url'] as const;
  for (const field of named) {
    it(`${field}: neither its value nor its key is in any projection`, () => {
      expect(projected).not.toContain(String(SECRET[field]));
      expect(projected).not.toContain(`"${field}"`);
    });
  }

  it('the student object, identity, programme contacts and the survey link never pass', () => {
    for (const text of [SECRET.nama_mahasiswa, SECRET.nim, SECRET.prodi_email, 'Alamat Prodi Sintetis', 'TELP-RUANG-SINTETIS', 'Catatan ruang sintetis', 'Sumber Sintetis', 'survey.example.invalid']) {
      expect(projected, text).not.toContain(text);
    }
    for (const key of ['"mahasiswa"', '"identitas"', '"pivot"', '"id_user"', '"max_participant":40,"nama"']) expect(projected).not.toContain(key);
  });
});

describe('credits from mata_kuliah_jumlah_skses', () => {
  it('sums every jumlah_sks of the course on the page', () => {
    expect(sumAt({ mata_kuliah: { mata_kuliah_jumlah_skses: [{ jumlah_sks: 2 }, { jumlah_sks: 1 }] } }, 'mata_kuliah.mata_kuliah_jumlah_skses.jumlah_sks')).toBe(3);
    expect(sumAt({ mata_kuliah: { mata_kuliah_jumlah_skses: [{ jumlah_sks: '2' }, { jumlah_sks: 'x' }] } }, 'mata_kuliah.mata_kuliah_jumlah_skses.jumlah_sks')).toBe(2);
    expect(sumAt({ mata_kuliah: { mata_kuliah_jumlah_skses: [] } }, 'mata_kuliah.mata_kuliah_jumlah_skses.jumlah_sks')).toBeUndefined();
    expect(sumAt({}, 'mata_kuliah.mata_kuliah_jumlah_skses.jumlah_sks')).toBeUndefined();
  });

  it('puts the sum on each class and each KHS row, without the list itself', () => {
    const krs = projectResponse(ENDPOINTS.find((e) => e.id === 'belanja_krs')!.spec, SYNTHETIC.belanja_krs);
    const classes = (krs as unknown as { data: { kartu_rencana_studi: { kelas_kuliahs: { sks: number }[] } } }).data.kartu_rencana_studi.kelas_kuliahs;
    expect(classes.map((k) => k.sks)).toEqual([3, 2, 3]);
    const khs = projectResponse(ENDPOINTS.find((e) => e.id === 'kartu_hasil_studi/semester')!.spec, SYNTHETIC['kartu_hasil_studi/semester']);
    expect((khs as unknown as { data: { kartu_hasil_studi: { sks: number }[] } }).data.kartu_hasil_studi[0]!.sks).toBe(3);
    expect(JSON.stringify(krs)).not.toContain('mata_kuliah_jumlah_skses');
  });

  it('drops KHS indeks_prestasi when it is not an object (observed without keys)', () => {
    const khs = projectResponse(ENDPOINTS.find((e) => e.id === 'kartu_hasil_studi/semester')!.spec, SYNTHETIC['kartu_hasil_studi/semester']);
    expect((khs as unknown as { data: Record<string, unknown> }).data).not.toHaveProperty('indeks_prestasi');
  });
});

