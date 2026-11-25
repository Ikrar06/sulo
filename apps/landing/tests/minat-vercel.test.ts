// The iPhone interest counter on Vercel (api/minat-ios.ts): the same rules as the Cloudflare one, over a Redis
// store reached by REST. Tested against a small Redis in memory that answers the few commands used, with a clock
// of its own: same origin only, off unless switched on, five a day per address, nothing about a visitor
// outliving its day, the total only ever counting what was accepted, and a store that fails never counted as a vote.
import { describe, expect, it } from 'vitest';
import { tangani, type Lingkungan } from '../api/minat-ios';
import { BATAS_HARIAN } from '../functions/lib/minat';

const SITUS = 'https://sulo.example';
const ALAMAT = 'https://redis.example';
const LINGKUNGAN: Lingkungan = { MINAT_IOS_AKTIF: '1', UPSTASH_REDIS_REST_URL: ALAMAT, UPSTASH_REDIS_REST_TOKEN: 'rahasia-uji' };
const HARI = '2026-11-25';
const TENGAH_HARI = new Date(`${HARI}T04:00:00Z`);
const AKHIR_HARI = Date.UTC(2026, 10, 26) / 1000;

const permintaan = (lain: { metode?: string; asal?: string | null; ip?: string } = {}) =>
  new Request(`${SITUS}/api/minat-ios`, {
    method: lain.metode ?? 'POST',
    headers: {
      host: 'sulo.example',
      'x-forwarded-proto': 'https',
      'x-real-ip': lain.ip ?? '203.0.113.7',
      ...(lain.asal === null ? {} : { origin: lain.asal ?? SITUS }),
    },
  });

/** A Redis in memory behind Upstash's REST shapes (/pipeline and /multi-exec), with expiry by its own clock. */
function redisTiruan() {
  const isi = new Map<string, { nilai: string | Map<string, number>; habis?: number }>();
  const panggilan: { url: string; token: string | null; perintah: (string | number)[][] }[] = [];
  let kini = TENGAH_HARI.getTime() / 1000;
  let rusak: number | null = null;
  const hidup = (kunci: string) => {
    const e = isi.get(kunci);
    if (e?.habis !== undefined && e.habis <= kini) isi.delete(kunci);
    return isi.get(kunci);
  };
  const jalankan = ([nama, kunci, ...arg]: (string | number)[]): { result?: unknown; error?: string } => {
    const k = String(kunci);
    switch (nama) {
      case 'SET': {
        const [nilai, nx, exat, waktu] = arg;
        if (nx !== 'NX' || exat !== 'EXAT') return { error: 'ERR syntax' };
        if (hidup(k)) return { result: null };
        isi.set(k, { nilai: String(nilai), habis: Number(waktu) });
        return { result: 'OK' };
      }
      case 'GET':
        return { result: (hidup(k)?.nilai as string | undefined) ?? null };
      case 'INCR': {
        const e = hidup(k);
        const n = Number(e?.nilai ?? 0) + 1;
        isi.set(k, { nilai: String(n), habis: e?.habis });
        return { result: n };
      }
      case 'EXPIREAT': {
        const e = hidup(k);
        if (!e) return { result: 0 };
        e.habis = Number(arg[0]);
        return { result: 1 };
      }
      case 'HINCRBY': {
        const e = hidup(k) ?? { nilai: new Map<string, number>() };
        const peta = e.nilai as Map<string, number>;
        peta.set(String(arg[0]), (peta.get(String(arg[0])) ?? 0) + Number(arg[1]));
        isi.set(k, e);
        return { result: peta.get(String(arg[0])) };
      }
      default:
        return { error: `ERR unknown command '${nama}'` };
    }
  };
  const ambil = (async (url: string | URL | Request, init?: RequestInit) => {
    const perintah = JSON.parse(String(init?.body)) as (string | number)[][];
    panggilan.push({ url: String(url), token: new Headers(init?.headers).get('authorization'), perintah });
    if (rusak !== null) return new Response(JSON.stringify({ error: 'ERR tiruan' }), { status: rusak });
    return new Response(JSON.stringify(perintah.map(jalankan)), { status: 200 });
  }) as typeof fetch;
  return {
    ambil,
    panggilan,
    total: () => Number(hidup('minat:total')?.nilai ?? 0),
    harian: (hari: string) => (hidup('minat:harian')?.nilai as Map<string, number> | undefined)?.get(hari) ?? 0,
    kunci: () => [...isi.keys()].filter((k) => hidup(k)),
    habis: (kunci: string) => isi.get(kunci)?.habis,
    majukanKe: (detik: number) => void (kini = detik),
    rusakkan: (status: number) => void (rusak = status),
  };
}

const kirim = (r: ReturnType<typeof redisTiruan>, p: Request, lingkungan: Lingkungan = LINGKUNGAN) => tangani(p, lingkungan, r.ambil, TENGAH_HARI);

describe('penghitung minat di Vercel', () => {
  it('mati kecuali dinyalakan dan basis datanya tersambung, tanpa menyentuh basis data', async () => {
    const r = redisTiruan();
    expect((await kirim(r, permintaan(), { ...LINGKUNGAN, MINAT_IOS_AKTIF: undefined })).status).toBe(404);
    expect((await kirim(r, permintaan(), { MINAT_IOS_AKTIF: '1' })).status).toBe(404);
    expect((await kirim(r, permintaan({ metode: 'GET' }), { MINAT_IOS_AKTIF: '0' })).status).toBe(404);
    expect(r.panggilan).toHaveLength(0);
  });
  it('mencatat satu suara dari situs ini: 204 tanpa isi, total dan hitungan hari itu bertambah', async () => {
    const r = redisTiruan();
    const jawab = await kirim(r, permintaan());
    expect(jawab.status).toBe(204);
    expect(await jawab.text()).toBe('');
    expect(jawab.headers.get('cache-control')).toBe('no-store');
    expect(r.total()).toBe(1);
    expect(r.harian(HARI)).toBe(1);
  });
  it('menolak asal lain, permintaan tanpa Origin, dan metode selain POST', async () => {
    const r = redisTiruan();
    expect((await kirim(r, permintaan({ asal: 'https://jahat.example' }))).status).toBe(403);
    expect((await kirim(r, permintaan({ asal: null }))).status).toBe(403);
    expect((await kirim(r, permintaan({ metode: 'GET' }))).status).toBe(405);
    expect(r.total()).toBe(0);
  });
  it('menerima sampai batas harian per alamat, lalu 429 tanpa menambah total; alamat lain tetap diterima', async () => {
    const r = redisTiruan();
    for (let i = 0; i < BATAS_HARIAN; i++) expect((await kirim(r, permintaan())).status).toBe(204);
    expect((await kirim(r, permintaan())).status).toBe(429);
    expect(r.total()).toBe(BATAS_HARIAN);
    expect((await kirim(r, permintaan({ ip: '198.51.100.9' }))).status).toBe(204);
    expect(r.total()).toBe(BATAS_HARIAN + 1);
  });
  it('tidak menyimpan alamat IP, dan garam serta hash habis tepat di akhir hari itu', async () => {
    const r = redisTiruan();
    await kirim(r, permintaan());
    const sementara = r.kunci().filter((k) => k.startsWith('minat:garam:') || k.startsWith('minat:batas:'));
    expect(sementara).toHaveLength(2);
    for (const k of sementara) expect(r.habis(k)).toBe(AKHIR_HARI);
    expect(JSON.stringify(r.panggilan)).not.toContain('203.0.113.7');
    r.majukanKe(AKHIR_HARI);
    expect(r.kunci().sort()).toEqual(['minat:harian', 'minat:total']);
    expect(r.total()).toBe(1);
  });
  it('berbicara ke basis data dengan token, lewat pipeline dan satu transaksi untuk total', async () => {
    const r = redisTiruan();
    await kirim(r, permintaan());
    expect(r.panggilan.map((p) => p.url)).toEqual([`${ALAMAT}/pipeline`, `${ALAMAT}/pipeline`, `${ALAMAT}/multi-exec`]);
    for (const p of r.panggilan) expect(p.token).toBe('Bearer rahasia-uji');
  });
  it('menerima nama variabel dari integrasi Vercel (KV_REST_API_*)', async () => {
    const r = redisTiruan();
    const jawab = await kirim(r, permintaan(), { MINAT_IOS_AKTIF: '1', KV_REST_API_URL: `${ALAMAT}/`, KV_REST_API_TOKEN: 'rahasia-uji' });
    expect(jawab.status).toBe(204);
    expect(r.panggilan[0]!.url).toBe(`${ALAMAT}/pipeline`);
  });
  it('basis data yang menolak atau tidak menjawab: 503 tanpa isi, bukan suara yang tercatat', async () => {
    const r = redisTiruan();
    r.rusakkan(401);
    const jawab = await kirim(r, permintaan());
    expect(jawab.status).toBe(503);
    expect(await jawab.text()).toBe('');
    const putus = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    expect((await tangani(permintaan(), LINGKUNGAN, putus, TENGAH_HARI)).status).toBe(503);
    expect(r.total()).toBe(0);
  });
});
