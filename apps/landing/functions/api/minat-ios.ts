// POST /api/minat-ios: Cloudflare Pages Functions with D1 (brief 6.14). Off
// unless the host sets MINAT_IOS_AKTIF=1 and the page shows the button
// (src/data/rilis.json minatIos.aktif). D1, not KV: KV cannot add to a number
// atomically, so votes could be lost when many come at once.
//
// The tables (functions/schema.sql): garam (one salt per day), batas (vote
// counts per salted IP hash per day), total and harian (the counts that last).
// Every request deletes the salts and hashes of earlier days first, so none
// outlives its day.
import { terimaSuara, type Gudang } from '../lib/minat';

/** The few D1 calls used here (Cloudflare's own types are not a dependency of this page). */
interface D1Hasil<T> {
  results?: T[];
}
interface D1Pernyataan {
  bind(...nilai: unknown[]): D1Pernyataan;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
  all<T>(): Promise<D1Hasil<T>>;
}
interface D1 {
  prepare(sql: string): D1Pernyataan;
  batch(pernyataan: D1Pernyataan[]): Promise<unknown>;
}
interface Env {
  MINAT: D1;
  MINAT_IOS_AKTIF?: string;
}
interface Konteks {
  request: Request;
  env: Env;
}

export function gudangD1(db: D1): Gudang {
  return {
    async garamHariIni(hari, buat) {
      await db.prepare('DELETE FROM garam WHERE hari < ?1').bind(hari).run();
      await db.prepare('INSERT OR IGNORE INTO garam (hari, nilai) VALUES (?1, ?2)').bind(hari, buat()).run();
      const baris = await db.prepare('SELECT nilai FROM garam WHERE hari = ?1').bind(hari).first<{ nilai: string }>();
      return baris?.nilai ?? buat();
    },
    async catatSuara(hari, hashIp) {
      await db.prepare('DELETE FROM batas WHERE hari < ?1').bind(hari).run();
      await db.prepare('INSERT INTO batas (hari, hash, jumlah) VALUES (?1, ?2, 1) ON CONFLICT (hari, hash) DO UPDATE SET jumlah = jumlah + 1').bind(hari, hashIp).run();
      const baris = await db.prepare('SELECT jumlah FROM batas WHERE hari = ?1 AND hash = ?2').bind(hari, hashIp).first<{ jumlah: number }>();
      return baris?.jumlah ?? 1;
    },
    async tambahTotal(hari) {
      await db.batch([
        db.prepare('UPDATE total SET jumlah = jumlah + 1 WHERE id = 1'),
        db.prepare('INSERT INTO harian (hari, jumlah) VALUES (?1, 1) ON CONFLICT (hari) DO UPDATE SET jumlah = jumlah + 1').bind(hari),
      ]);
    },
  };
}

export async function onRequest({ request, env }: Konteks): Promise<Response> {
  const url = new URL(request.url);
  const hasil = await terimaSuara(
    {
      metode: request.method,
      asal: request.headers.get('Origin'),
      asalSitus: url.origin,
      ip: request.headers.get('CF-Connecting-IP'),
      aktif: env.MINAT_IOS_AKTIF === '1' && Boolean(env.MINAT),
      hari: new Date().toISOString().slice(0, 10),
    },
    gudangD1(env.MINAT),
  );
  // No body either way: the answer says only "noted", "too many today" or "no", never a number.
  return new Response(null, { status: hasil.status, headers: { 'Cache-Control': 'no-store' } });
}
