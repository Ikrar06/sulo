// The browser stand-in for SuloSipakamase (pnpm mobile:web, tests): the
// extension's synthetic demo data in memory for this page load, seeded when
// ?neosia= is set (the screenshots' connected state). Nothing leaves the
// browser: "signing in" succeeds at once and a fragment read answers with
// the hand-written synthetic fixtures.
import { demoSipakamase } from '../../../extension/scripts/lib/demo-sipakamase.mjs';
import kegiatan from '../../../extension/fixtures/synthetic/sipakamase/kegiatan.html?raw';
import riwayat from '../../../extension/fixtures/synthetic/sipakamase/riwayat.html?raw';
import matakuliah from '../../../extension/fixtures/synthetic/sipakamase/matakuliah.html?raw';
import klaim from '../../../extension/fixtures/synthetic/sipakamase/klaim.html?raw';
import rekappoin from '../../../extension/fixtures/synthetic/sipakamase/rekappoin.html?raw';
import type { SuloSipakamasePlugin } from '../sipakamase-native';

const PAGES: Record<string, string> = {
  '/caktifitasmahasiswa/content': kegiatan,
  '/caktifitas/content': riwayat,
  '/ckonversimhs/matakuliah': matakuliah,
  '/cklaim/content': klaim,
  '/ckonversimhs/rekappoin': rekappoin,
};

const seeded = () => typeof location !== 'undefined' && new URLSearchParams(location.search).has('neosia');

export function fakeSipakamase(): SuloSipakamasePlugin {
  const stores = new Map<number, Map<string, string>>();
  let session = seeded();
  const store = (user: number) => {
    let s = stores.get(user);
    if (!s) {
      const demo = seeded() ? (demoSipakamase(Math.floor(Date.now() / 1000)) as Record<string, unknown>) : {};
      s = new Map(Object.entries(demo).filter(([k]) => k.startsWith('sipakamase:')).map(([k, v]) => [k, JSON.stringify(v)]));
      stores.set(user, s);
    }
    return s;
  };
  return {
    signIn: async () => ((session = true), { result: 'signed_in' }),
    get: async ({ path }) => (session ? { status: 200, toLogin: false, html: PAGES[path] ?? '' } : { noSession: true }),
    status: async () => ({ hasSession: session }),
    workerState: async () => ({ lastAt: 0, date: '', count: 0, loginAt: 0 }),
    forget: async () => {
      session = false;
      stores.clear();
    },
    storeGet: async ({ user, key }) => ({ value: store(user).get(key) ?? null }),
    storeSet: async ({ user, key, value }) => void store(user).set(key, value),
    storeRemove: async ({ user, keys }) => void keys.forEach((k) => store(user).delete(k)),
    storeKeys: async ({ user, prefix }) => ({ keys: [...store(user).keys()].filter((k) => k.startsWith(prefix)) }),
  };
}
