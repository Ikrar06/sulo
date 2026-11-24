// The iPhone interest counter: the rules in pure logic, then the real SQL on SQLite (node:sqlite), the same
// dialect as Cloudflare D1: same origin only, off unless switched on, five a day per address, nothing about a
// visitor outliving its day, and the total only ever counting what was accepted.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { gudangD1 } from '../functions/api/minat-ios';
import { BATAS_HARIAN, terimaSuara, type Gudang, type Permintaan } from '../functions/lib/minat';

const ASAL = 'https://sulo.example';
const dasar = (lain: Partial<Permintaan> = {}): Permintaan => ({ metode: 'POST', asal: ASAL, asalSitus: ASAL, ip: '203.0.113.7', aktif: true, hari: '2026-11-25', ...lain });

/** An in-memory store with the same day rules as the D1 one. */
function gudangMemori() {
  const garam = new Map<string, string>();
  const batas = new Map<string, number>();
  let total = 0;
  const g: Gudang = {
    async garamHariIni(hari, buat) {
      for (const k of [...garam.keys()]) if (k < hari) garam.delete(k);
      if (!garam.has(hari)) garam.set(hari, buat());
      return garam.get(hari)!;
    },
    async catatSuara(hari, hash) {
      for (const k of [...batas.keys()]) if (k.split('|')[0]! < hari) batas.delete(k);
      const n = (batas.get(`${hari}|${hash}`) ?? 0) + 1;
      batas.set(`${hari}|${hash}`, n);
      return n;
    },
    async tambahTotal() {
      total += 1;
    },
  };
  return { g, total: () => total, garam, batas };
}

describe('aturan penghitung', () => {
  it('menolak asal lain dan permintaan tanpa Origin', async () => {
    const m = gudangMemori();
    expect((await terimaSuara(dasar({ asal: 'https://jahat.example' }), m.g)).status).toBe(403);
    expect((await terimaSuara(dasar({ asal: null }), m.g)).status).toBe(403);
    expect(m.total()).toBe(0);
  });
  it('mati kecuali dinyalakan, dan hanya POST', async () => {
    const m = gudangMemori();
    expect((await terimaSuara(dasar({ aktif: false }), m.g)).status).toBe(404);
    expect((await terimaSuara(dasar({ metode: 'GET' }), m.g)).status).toBe(405);
    expect(m.total()).toBe(0);
  });
  it('menerima sampai batas harian per alamat, lalu menolak tanpa menambah total', async () => {
    const m = gudangMemori();
    for (let i = 0; i < BATAS_HARIAN; i++) expect((await terimaSuara(dasar(), m.g)).status).toBe(204);
    expect((await terimaSuara(dasar(), m.g)).status).toBe(429);
    expect(m.total()).toBe(BATAS_HARIAN);
    // Another address the same day is still fine.
    expect((await terimaSuara(dasar({ ip: '198.51.100.2' }), m.g)).status).toBe(204);
  });
  it('tidak menyimpan alamat IP mentah', async () => {
    const m = gudangMemori();
    await terimaSuara(dasar(), m.g);
    expect([...m.batas.keys()].some((k) => k.includes('203.0.113.7'))).toBe(false);
  });
});

/** node:sqlite in the shape of the few D1 calls the counter makes. */
function d1(db: DatabaseSync) {
  const pernyataan = (sql: string, nilai: unknown[] = []) => ({
    bind: (...n: unknown[]) => pernyataan(sql, n),
    first: async <T>() => (db.prepare(sql).get(...(nilai as never[])) as T | undefined) ?? null,
    run: async () => db.prepare(sql).run(...(nilai as never[])),
    all: async <T>() => ({ results: db.prepare(sql).all(...(nilai as never[])) as T[] }),
    jalan: () => db.prepare(sql).run(...(nilai as never[])),
  });
  return {
    prepare: (sql: string) => pernyataan(sql),
    batch: async (daftar: { jalan: () => unknown }[]) => {
      db.exec('BEGIN');
      try {
        for (const p of daftar) p.jalan();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

describe('SQL D1 (dicoba di SQLite)', () => {
  const buat = () => {
    const db = new DatabaseSync(':memory:');
    db.exec(readFileSync(new URL('../functions/schema.sql', import.meta.url), 'utf8'));
    return { db, g: gudangD1(d1(db) as never) };
  };
  it('menghitung total dan per hari, dan membatasi per alamat', async () => {
    const { db, g } = buat();
    for (let i = 0; i < BATAS_HARIAN + 2; i++) await terimaSuara(dasar(), g);
    expect(db.prepare('SELECT jumlah FROM total WHERE id = 1').get()).toEqual({ jumlah: BATAS_HARIAN });
    expect(db.prepare('SELECT jumlah FROM harian WHERE hari = ?').get('2026-11-25')).toEqual({ jumlah: BATAS_HARIAN });
  });
  it('garam dan hash hari sebelumnya hilang saat hari berganti, batas mulai lagi', async () => {
    const { db, g } = buat();
    for (let i = 0; i < BATAS_HARIAN; i++) await terimaSuara(dasar(), g);
    const garamKemarin = (db.prepare('SELECT nilai FROM garam').get() as { nilai: string }).nilai;
    expect((await terimaSuara(dasar({ hari: '2026-11-26' }), g)).status).toBe(204);
    const sisaGaram = db.prepare('SELECT hari, nilai FROM garam').all() as { hari: string; nilai: string }[];
    expect(sisaGaram).toHaveLength(1);
    expect(sisaGaram[0]!.hari).toBe('2026-11-26');
    expect(sisaGaram[0]!.nilai).not.toBe(garamKemarin);
    expect(db.prepare('SELECT COUNT(*) AS n FROM batas WHERE hari < ?').get('2026-11-26')).toEqual({ n: 0 });
    expect(db.prepare('SELECT jumlah FROM total WHERE id = 1').get()).toEqual({ jumlah: BATAS_HARIAN + 1 });
  });
});
