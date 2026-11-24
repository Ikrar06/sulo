// @ts-check
// The iPhone interest counter (brief 6.14), as pure logic over a small store,
// so it is tested without a host and shared by both of them: the Vercel
// function (api/minat-ios.js) and the Cloudflare one (functions/api/minat-ios.ts).
// A rough signal ("worth building or not"), not a perfect vote: one vote per
// browser is the page's job (localStorage); here, a loose limit per IP address
// so a campus WiFi or a carrier that shares one address is still fine.
//
// Nothing about the visitor is kept: the IP address only as a hash with a
// random salt that changes every day, and both the salt and the hashes are
// gone after that day (24 hours at most). What lasts is one total and one
// count per day. The answer never says the total: the owner reads it in the
// host's dashboard.
//
// Plain JavaScript with its types in JSDoc: Vercel deploys it as it is, with
// no compile step that could fail the site's build.

/** At most this many votes from one address in one day (brief: USULAN 5). */
export const BATAS_HARIAN = 5;

/**
 * @typedef {{ status: 204 } | { status: 403 | 404 | 405 | 429, alasan: string }} Hasil
 */

/**
 * What the counter needs from its storage (Redis on Vercel, D1 on Cloudflare, memory in tests).
 * @typedef {object} Gudang
 * @property {(hari: string, buat: () => string) => Promise<string>} garamHariIni Today's salt, made once per day; yesterday's and older are gone.
 * @property {(hari: string, hashIp: string) => Promise<number>} catatSuara Adds one vote from this hash today and returns how many it now has; older days' hashes are gone.
 * @property {(hari: string) => Promise<void>} tambahTotal One more to the total and to today's count, atomically.
 */

/**
 * @typedef {object} Permintaan
 * @property {string} metode
 * @property {string | null} asal The Origin header, or null.
 * @property {string} asalSitus The site's own origin (https://...).
 * @property {string | null} ip
 * @property {boolean} aktif
 * @property {string} hari The day in UTC (YYYY-MM-DD): the salt and the limit turn over with it.
 */

/**
 * @param {string} teks
 * @returns {Promise<string>}
 */
export async function sha256Hex(teks) {
  const data = new TextEncoder().encode(teks);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** @returns {string} */
export function garamAcak() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {Permintaan} p
 * @param {Gudang} gudang
 * @returns {Promise<Hasil>}
 */
export async function terimaSuara(p, gudang) {
  if (!p.aktif) return { status: 404, alasan: 'mati' };
  if (p.metode !== 'POST') return { status: 405, alasan: 'metode' };
  // Same origin only, no CORS: a request from another site is refused.
  if (p.asal === null || p.asal !== p.asalSitus) return { status: 403, alasan: 'asal' };
  const garam = await gudang.garamHariIni(p.hari, garamAcak);
  const hashIp = await sha256Hex(`${garam}:${p.ip ?? 'tanpa-ip'}`);
  const jumlah = await gudang.catatSuara(p.hari, hashIp);
  if (jumlah > BATAS_HARIAN) return { status: 429, alasan: 'batas' };
  await gudang.tambahTotal(p.hari);
  return { status: 204 };
}
