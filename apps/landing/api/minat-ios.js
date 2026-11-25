// @ts-check
// POST /api/minat-ios on Vercel (brief 6.14): the counter of the Cloudflare
// function (functions/api/minat-ios.ts) with the same rules
// (functions/lib/minat.js) over another store. Off unless the host sets
// MINAT_IOS_AKTIF=1, a Redis database is connected, and the page shows the
// button (src/data/rilis.json minatIos.aktif).
//
// The store is an Upstash Redis database from Vercel's Marketplace, spoken to
// over its REST API with fetch (no package). Redis adds to a number
// atomically (INCR), so no vote is lost when many come at once.
//
// The keys: minat:garam:<day> (the day's salt), minat:batas:<day>:<hash>
// (votes per salted IP hash), and the counts that last, minat:total and the
// hash minat:harian. The salt and the per-address counts expire at the end of
// their UTC day: Redis deletes them itself, so none outlives its day even
// when no request comes after it.
//
// Plain JavaScript (types in JSDoc, checked by the page's typecheck): Vercel
// deploys the file as it is, with no compile step that could fail the build.
import { terimaSuara } from '../functions/lib/minat.js';

/**
 * What the function reads from the host. The database's two names differ by how it was connected.
 * @typedef {object} Lingkungan
 * @property {string} [MINAT_IOS_AKTIF]
 * @property {string} [UPSTASH_REDIS_REST_URL]
 * @property {string} [UPSTASH_REDIS_REST_TOKEN]
 * @property {string} [KV_REST_API_URL]
 * @property {string} [KV_REST_API_TOKEN]
 */

/** @typedef {import('../functions/lib/minat.js').Gudang} Gudang */
/** @typedef {(string | number)[]} Perintah */
/** @typedef {{ result?: unknown, error?: string }} Jawaban */

/**
 * The first second of the next UTC day (unix seconds): when that day's salt and hashes expire.
 * @param {string} hari YYYY-MM-DD
 * @returns {number}
 */
export function akhirHari(hari) {
  const [tahun = 0, bulan = 1, tanggal = 1] = hari.split('-').map(Number);
  return Date.UTC(tahun, bulan - 1, tanggal + 1) / 1000;
}

/**
 * @param {string} alamat
 * @param {string} token
 * @param {typeof fetch} [ambil]
 * @returns {Gudang}
 */
export function gudangRedis(alamat, token, ambil = fetch) {
  /**
   * A failure never carries the command or its keys: a key holds a hash, and this message reaches the log.
   * @param {'/pipeline' | '/multi-exec'} jalur
   * @param {Perintah[]} perintah
   * @returns {Promise<unknown[]>}
   */
  const kirim = async (jalur, perintah) => {
    const jawab = await ambil(`${alamat.replace(/\/+$/, '')}${jalur}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(perintah),
    });
    if (!jawab.ok) throw new Error(`basis data menjawab ${jawab.status}`);
    const isi = /** @type {Jawaban[]} */ (await jawab.json());
    if (!Array.isArray(isi) || isi.length !== perintah.length || isi.some((j) => j.error !== undefined)) throw new Error('basis data menolak perintah');
    return isi.map((j) => j.result);
  };
  return {
    async garamHariIni(hari, buat) {
      const kunci = `minat:garam:${hari}`;
      const baru = buat();
      // NX: the first request of the day makes the salt, every later one reads that same salt.
      const [, tersimpan] = await kirim('/pipeline', [['SET', kunci, baru, 'NX', 'EXAT', akhirHari(hari)], ['GET', kunci]]);
      // No salt to read only when the day ended between the two commands: this one request keeps its own.
      return typeof tersimpan === 'string' ? tersimpan : baru;
    },
    async catatSuara(hari, hashIp) {
      const kunci = `minat:batas:${hari}:${hashIp}`;
      const [jumlah] = await kirim('/pipeline', [['INCR', kunci], ['EXPIREAT', kunci, akhirHari(hari)]]);
      if (typeof jumlah !== 'number') throw new Error('basis data tidak mengembalikan hitungan');
      return jumlah;
    },
    async tambahTotal(hari) {
      await kirim('/multi-exec', [['INCR', 'minat:total'], ['HINCRBY', 'minat:harian', hari, 1]]);
    },
  };
}

/**
 * While the counter is off, nothing may reach a store.
 * @type {Gudang}
 */
const GUDANG_MATI = {
  garamHariIni: () => Promise.reject(new Error('penghitung mati')),
  catatSuara: () => Promise.reject(new Error('penghitung mati')),
  tambahTotal: () => Promise.reject(new Error('penghitung mati')),
};

/**
 * The site's own origin as the visitor's browser sees it (Vercel sets these headers itself).
 * @param {Request} request
 * @returns {string}
 */
function asalSitus(request) {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  const protokol = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  return `${protokol}://${host}`;
}

/**
 * @param {Request} request
 * @param {Lingkungan} lingkungan
 * @param {typeof fetch} [ambil]
 * @param {Date} [kini]
 * @returns {Promise<Response>}
 */
export async function tangani(request, lingkungan, ambil = fetch, kini = new Date()) {
  const alamat = lingkungan.UPSTASH_REDIS_REST_URL ?? lingkungan.KV_REST_API_URL;
  const token = lingkungan.UPSTASH_REDIS_REST_TOKEN ?? lingkungan.KV_REST_API_TOKEN;
  const aktif = lingkungan.MINAT_IOS_AKTIF === '1' && Boolean(alamat) && Boolean(token);
  // No body either way: the answer says only "noted", "too many today" or "no", never a number.
  const jawab = (/** @type {number} */ status) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
  try {
    const hasil = await terimaSuara(
      {
        metode: request.method,
        asal: request.headers.get('origin'),
        asalSitus: asalSitus(request),
        // Vercel writes the visitor's address here itself and overwrites what a client sends.
        ip: request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        aktif,
        hari: kini.toISOString().slice(0, 10),
      },
      aktif && alamat && token ? gudangRedis(alamat, token, ambil) : GUDANG_MATI,
    );
    return jawab(hasil.status);
  } catch (galat) {
    // A store that fails is not a vote: the page shows its "could not be noted" line. The log gets the reason only.
    console.error(`minat-ios: ${galat instanceof Error ? galat.message : 'basis data tidak menjawab'}`);
    return jawab(503);
  }
}

export default {
  /**
   * @param {Request} request
   * @returns {Promise<Response>}
   */
  fetch(request) {
    // Node's process, reached this way because the page's typecheck loads no Node types.
    const { process } = /** @type {{ process: { env: Lingkungan } }} */ (/** @type {unknown} */ (globalThis));
    return tangani(request, process.env);
  },
};
