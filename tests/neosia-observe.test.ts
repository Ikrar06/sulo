import { describe, expect, it } from 'vitest';
import { addObservation, observationsMarkdown, OBSERVED_MAX, recordObservation } from '../lib/dev/neosia-observe';
import { memoryStore } from './helpers';

const obs = (path: string, endpoint: string, keys: string[] | null, at = 1_794_000_000) => ({ type: 'sulo:observe:v1' as const, path, endpoint, keys, at });

describe('dev observation listing', () => {
  it('keeps one row per path, newest first, counting repeats', () => {
    let list = addObservation([], obs('/api/max_sks', 'max_sks', ['max_sks']));
    list = addObservation(list, obs('/api/pengumuman', 'other', null));
    list = addObservation(list, obs('/api/max_sks', 'max_sks', ['max_sks', 'context']));
    expect(list.map((o) => [o.path, o.count, o.keys])).toEqual([
      ['/api/max_sks', 2, ['max_sks', 'context']],
      ['/api/pengumuman', 1, null],
    ]);
    const many = Array.from({ length: OBSERVED_MAX + 10 }, (_, i) => obs(`/p${i}`, 'other', null)).reduce(addObservation, [] as ReturnType<typeof addObservation>);
    expect(many).toHaveLength(OBSERVED_MAX);
  });

  it('accepts only the observation shape (no values field, bounded keys)', async () => {
    const store = memoryStore();
    expect(await recordObservation(store, { ...obs('/a', 'other', null), values: ['x'] })).toBe(false);
    expect(await recordObservation(store, obs('/a', 'other', Array.from({ length: 401 }, () => 'k')))).toBe(false);
    expect(await recordObservation(store, obs('/a', 'dashboard', ['indeks_prestasi.ipk']))).toBe(true);
  });

  it('writes Markdown with paths and key names, and lists allowlisted paths not seen yet', () => {
    const md = observationsMarkdown([{ ...obs('/api/dashboard', 'dashboard', ['indeks_prestasi.ipk']), count: 2, pages: ['/'] }, { ...obs('/api/mahasiswa/mahasiswa', 'never', null), count: 1, pages: ['/transkrip-nilai'] }], ['dashboard', 'max_sks']);
    expect(md).toContain('- halaman NEOSIA: `/`');
    expect(md).toContain('### dashboard');
    expect(md).toContain('indeks_prestasi.ipk');
    expect(md).toContain('- max_sks');
    expect(md).toContain('`/api/mahasiswa/mahasiswa` (tidak pernah dibaca)');
  });
});

describe('the NEOSIA page each response came from', () => {
  it('keeps every page a response was seen on', () => {
    let list = addObservation([], { ...obs('/api/mahasiswa/dashboard', 'dashboard', ['x']), page: '/' });
    list = addObservation(list, { ...obs('/api/mahasiswa/dashboard', 'dashboard', ['x']), page: '/transkrip-nilai' });
    expect(list[0]!.pages).toEqual(['/', '/transkrip-nilai']);
  });
});

