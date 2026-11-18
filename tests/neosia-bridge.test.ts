import { describe, expect, it } from 'vitest';
import { CAPTURE_SCHEMA_VERSION, CAPTURE_TYPE, ENDPOINTS, MAX_MESSAGE_CHARS } from '../lib/neosia/allowlist';
import { createBridge, DEDUP_MS, sha256Hex } from '../lib/neosia/bridge';
import { NEOSIA_MODULE_KEY } from '../lib/neosia/module';
import { projectResponse } from '../lib/neosia/project';
import { parseCapture } from '../lib/neosia/schema';
import { ingestCapture, readSnapshots, snapshotKey } from '../lib/neosia/store';
import { memoryStore } from './helpers';
import { PLACEHOLDER, SECRET, SYNTHETIC } from './neosia-synthetic';

const ORIGIN = 'https://neosia.unhas.ac.id';
const self = { name: 'this window' };

function capture(endpoint: (typeof ENDPOINTS)[number]['id'] = 'max_sks') {
  const e = ENDPOINTS.find((x) => x.id === endpoint)!;
  const result = projectResponse(e.spec, SYNTHETIC[endpoint]);
  if (result.status !== 'ok') throw new Error('fixture');
  return { type: CAPTURE_TYPE, v: CAPTURE_SCHEMA_VERSION, endpoint, status: 'ok' as const, data: result.data, at: 1_794_000_000 };
}

function bridge(start = 0) {
  let now = start;
  const sent: unknown[] = [];
  const onMessage = createBridge({ self, nowMs: () => now, hash: sha256Hex, send: (c) => void sent.push(c) });
  return { onMessage, sent, advance: (ms: number) => void (now += ms) };
}

describe('the bridge', () => {
  it('passes a valid capture from this window and the NEOSIA origin', async () => {
    const b = bridge();
    expect(await b.onMessage({ source: self, origin: ORIGIN, data: capture() })).toBe('sent');
    expect(b.sent).toHaveLength(1);
  });

  it('ignores messages from another source or origin', async () => {
    const b = bridge();
    expect(await b.onMessage({ source: {}, origin: ORIGIN, data: capture() })).toBe('ignored');
    expect(await b.onMessage({ source: null, origin: ORIGIN, data: capture() })).toBe('ignored');
    expect(await b.onMessage({ source: self, origin: 'https://evil.example', data: capture() })).toBe('ignored');
    expect(await b.onMessage({ source: self, origin: 'https://api.neosia.unhas.ac.id', data: capture() })).toBe('ignored');
    expect(await b.onMessage({ source: self, origin: ORIGIN, data: { ...capture(), type: 'other' } })).toBe('ignored');
    expect(b.sent).toEqual([]);
  });

  it('rejects messages over the size limit', async () => {
    const b = bridge();
    const big = { ...capture('check_survey_status'), data: { is_filled: false }, padding: 'x'.repeat(MAX_MESSAGE_CHARS) };
    expect(await b.onMessage({ source: self, origin: ORIGIN, data: big })).toBe('rejected');
    const many = { ...capture('mahasiswa/semester'), data: Array.from({ length: 5000 }, (_, i) => ({ kode: `k${i}`, nama: 'x'.repeat(150) })) };
    expect(await b.onMessage({ source: self, origin: ORIGIN, data: many })).toBe('rejected');
    expect(b.sent).toEqual([]);
  });

  it('rejects the wrong shape: unknown endpoint, extra keys, dropped fields, sensitive values, wrong types', async () => {
    const b = bridge();
    const bad = [
      { ...capture(), endpoint: 'mahasiswa/mahasiswa' },
      { ...capture(), extra: 1 },
      { ...capture(), v: 1 },
      { ...capture(), at: 'now' },
      { ...capture(), data: { max_sks: 24, nim: PLACEHOLDER.nim } },
      { ...capture(), data: { max_sks: 24, context: { current_semester: 4, nik: PLACEHOLDER.nik } } },
      { ...capture('getStatusPembayaran'), data: { status: true, pembayaran: { sudah_bayar: true, nominal: 7654321 } } },
      { ...capture('belanja_krs'), data: { kartu_rencana_studi: { is_approved: true, mahasiswa: { nik: PLACEHOLDER.nik } } } },
      { ...capture('check_survey_status'), data: { is_filled: false, survey_url: 'https://survey.example.invalid' } },
      { ...capture('dashboard'), data: { indeks_prestasi: { ipk: { nested: true } } } },
      { ...capture('getStatusPembayaran'), data: { status: 'Rp 2.500.000' } },
      { ...capture(), data: '<img src=x onerror=alert(1)>' },
      { type: CAPTURE_TYPE },
      'just a string',
    ];
    for (const data of bad) expect(await b.onMessage({ source: self, origin: ORIGIN, data }), JSON.stringify(data).slice(0, 80)).not.toBe('sent');
    expect(b.sent).toEqual([]);
  });

  it('drops the same endpoint and data within 5 seconds, passes it again after', async () => {
    const b = bridge();
    expect(await b.onMessage({ source: self, origin: ORIGIN, data: capture() })).toBe('sent');
    b.advance(DEDUP_MS - 1);
    expect(await b.onMessage({ source: self, origin: ORIGIN, data: { ...capture(), at: 1_794_000_001 } })).toBe('duplicate');
    expect(await b.onMessage({ source: self, origin: ORIGIN, data: capture('dashboard') })).toBe('sent');
    b.advance(DEDUP_MS);
    expect(await b.onMessage({ source: self, origin: ORIGIN, data: capture() })).toBe('sent');
    expect(b.sent).toHaveLength(3);
    expect(DEDUP_MS).toBe(5000);
  });

  it('accepts unknown_shape without data', async () => {
    const b = bridge();
    expect(await b.onMessage({ source: self, origin: ORIGIN, data: { type: CAPTURE_TYPE, v: CAPTURE_SCHEMA_VERSION, endpoint: 'dashboard', status: 'unknown_shape', at: 1 } })).toBe('sent');
    expect(await b.onMessage({ source: self, origin: ORIGIN, data: { type: CAPTURE_TYPE, v: CAPTURE_SCHEMA_VERSION, endpoint: 'dashboard', status: 'unknown_shape', at: 1, data: {} } })).toBe('rejected');
  });

  it('accepts every synthetic golden projection', () => {
    for (const e of ENDPOINTS) expect(parseCapture(capture(e.id)), e.id).not.toBeNull();
  });
});

describe('the service worker stores snapshots', () => {
  const on = { [NEOSIA_MODULE_KEY]: { enabled: true, changedAt: 1 } };

  it('stores nothing while the module is off', async () => {
    const store = memoryStore();
    expect((await ingestCapture(store, 100, capture())).kind).toBe('off');
    expect(await store.keys('neosia:')).toEqual([]);
  });

  it('stores nothing while Sulo is switched off remotely', async () => {
    const store = memoryStore({ ...on, 'global:remoteConfig': { enabled: false, minIntervalMinutes: 180, message: '', fetchedAt: 1 } });
    expect((await ingestCapture(store, 100, capture())).kind).toBe('off');
    expect(await store.keys('neosia:snap')).toEqual([]);
  });

  it('validates again and rejects what the bridge should have stopped', async () => {
    const store = memoryStore(on);
    expect((await ingestCapture(store, 100, { ...capture(), data: { max_sks: 24, nim: PLACEHOLDER.nim } })).kind).toBe('rejected');
    expect(await store.keys('neosia:')).toEqual([]);
  });

  it('keeps a timestamped snapshot per endpoint and reports changes against the previous one', async () => {
    const store = memoryStore(on);
    const first = await ingestCapture(store, 100, capture());
    expect(first).toMatchObject({ kind: 'stored', changed: true, baseline: true });
    const same = await ingestCapture(store, 200, capture());
    expect(same).toMatchObject({ kind: 'stored', changed: false, baseline: false });
    const changed = await ingestCapture(store, 300, { ...capture(), data: { ...capture().data as object, max_sks: 22 } });
    expect(changed).toMatchObject({ kind: 'stored', changed: true, baseline: false });
    const snap = (await readSnapshots(store)).max_sks!;
    expect(snap).toMatchObject({ changedAt: 300, seenAt: 300, unknownShapeAt: null });
  });

  it('keeps the last good data when NEOSIA answers in an unknown shape', async () => {
    const store = memoryStore(on);
    await ingestCapture(store, 100, capture());
    await ingestCapture(store, 200, { type: CAPTURE_TYPE, v: CAPTURE_SCHEMA_VERSION, endpoint: 'max_sks', status: 'unknown_shape', at: 1 });
    const snap = (await store.get<{ data: unknown; unknownShapeAt: number }>(snapshotKey('max_sks')))!;
    expect(snap.data).toEqual(capture().data);
    expect(snap.unknownShapeAt).toBe(200);
  });

  it('never stores a dropped field (every endpoint, synthetic responses)', async () => {
    const store = memoryStore(on);
    for (const e of ENDPOINTS) await ingestCapture(store, 100, capture(e.id));
    const text = JSON.stringify(store.dump());
    for (const field of ['nim', 'nik', 'nisn', 'nip', 'nidn', 'nuptk', 'whatsapp', 'jalan', 'rt', 'rw', 'dusun', 'nilai_angka', 'total_nilai', 'nominal', 'bank', 'alamat', 'tanggal_lahir', 'survey_url', 'mahasiswa', 'identitas']) {
      expect(text, field).not.toContain(`"${field}"`);
    }
    for (const value of Object.values(SECRET)) expect(text, String(value)).not.toContain(String(value));
  });
});

describe('snapshots from an older projection (M7.1 fix)', () => {
  it('are ignored until NEOSIA is opened again, then replaced', async () => {
    const store = memoryStore({ [NEOSIA_MODULE_KEY]: { enabled: true, changedAt: 1 }, [snapshotKey('getTranskripMahasiswa')]: { endpoint: 'getTranskripMahasiswa', v: 1, data: { transkrip: [{ sks: 3, nilai_huruf: 'A' }] }, changedAt: 1, seenAt: 1, unknownShapeAt: null } });
    expect(await readSnapshots(store)).toEqual({});
    const result = await ingestCapture(store, 100, capture('getTranskripMahasiswa'));
    expect(result).toMatchObject({ kind: 'stored', baseline: true });
    expect(Object.keys(await readSnapshots(store))).toEqual(['getTranskripMahasiswa']);
  });
});
