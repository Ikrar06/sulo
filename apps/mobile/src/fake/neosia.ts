// The browser stand-in for SuloNeosia (pnpm mobile:web, tests): the
// extension's synthetic NEOSIA snapshots (made-up names, the demo courses'
// codes), kept in memory for this page load. Nothing leaves the browser and
// no NEOSIA page opens: "opening" a page stores that page's synthetic data.
//
// ?neosia=<stage> (screenshots; without it NEOSIA stays off, as on a new phone):
//   invite       off, the invite shows
//   new          on, nothing yet: "Masuk NEOSIA" comes first
//   signed       on and signed in, nothing captured yet
//   beranda      Beranda done, KHS next
//   all          everything (the default for any other value)
//   expired      Beranda done; opening a page finds NEOSIA's login
//   unsupported  this WebView cannot capture

import { demoNeosia } from '../../../extension/scripts/lib/demo-neosia.mjs';
import { sourceById, type SourceId } from '@sulo/core/neosia/sources';
import type { NeosiaPage, NeosiaTrialStats, SuloNeosiaPlugin } from '../neosia-native';

const param = (name: string) => (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get(name));

export type FakeNeosiaStage = 'invite' | 'new' | 'signed' | 'beranda' | 'all' | 'expired' | 'unsupported';
export function fakeNeosiaStage(): FakeNeosiaStage | null {
  const v = param('neosia');
  if (v === null) return null;
  return (['invite', 'new', 'signed', 'beranda', 'expired', 'unsupported'] as const).find((s) => s === v) ?? 'all';
}

const SNAP = 'neosia:snap:';
const PAGE_SOURCE: Partial<Record<NeosiaPage, SourceId>> = { home: 'beranda', khs: 'khs', krs: 'krs', transkrip: 'transkrip', matakuliah: 'matakuliah' };

/** The synthetic snapshots as stored values (JSON strings), keyed "neosia:snap:<endpoint>". */
function synthetic(now: number): Map<string, string> {
  const all = demoNeosia(now) as Record<string, unknown>;
  return new Map(Object.entries(all).filter(([k]) => k.startsWith(SNAP)).map(([k, v]) => [k, JSON.stringify(v)]));
}

/** The stored keys a page's own requests would bring. */
const keysOf = (source: SourceId) => sourceById(source).endpoints.map((e) => `${SNAP}${e}`);

export function fakeNeosia(): SuloNeosiaPlugin {
  const stage = fakeNeosiaStage();
  const now = Math.floor(Date.now() / 1000);
  const source = synthetic(now);
  const stores = new Map<number, Map<string, string>>();
  let signedIn = stage !== 'new' && stage !== 'invite' && stage !== null;

  const seeded = (user: number): Map<string, string> => {
    let s = stores.get(user);
    if (s) return s;
    const start = stage === 'beranda' || stage === 'expired' ? keysOf('beranda') : stage === 'all' ? [...source.keys()] : [];
    s = new Map(start.flatMap((k) => (source.has(k) ? [[k, source.get(k)!] as const] : [])));
    stores.set(user, s);
    return s;
  };

  const stats: NeosiaTrialStats = { captures: {}, rejected: {}, requests: {}, pages: [], largestBytes: 0, scriptOnLogin: 0, spaToLogin: 0, spaFromLogin: 0, webView: 'web', docStartSupported: true, listenerSupported: true };

  return {
    open: async ({ page }) => {
      if (stage === 'expired') return { result: 'needs_login' };
      if (page === 'login') {
        signedIn = true;
        return { result: 'signed_in' };
      }
      if (!signedIn) return { result: 'needs_login' };
      const id = PAGE_SOURCE[page];
      if (id) for (const [user] of stores) for (const k of keysOf(id)) if (source.has(k)) seeded(user).set(k, source.get(k)!);
      return { result: 'signed_in' };
    },
    support: async () => (stage === 'unsupported' ? { docStart: false, listener: false, webViewPackage: 'com.google.android.webview' } : { docStart: true, listener: true, webViewPackage: 'com.google.android.webview' }),
    takeCaptures: async () => ({ messages: [] }),
    storeGet: async ({ user, key }) => ({ value: seeded(user).get(key) ?? null }),
    storeSet: async ({ user, key, value }) => void seeded(user).set(key, value),
    storeRemove: async ({ user, keys }) => void keys.forEach((k) => seeded(user).delete(k)),
    storeKeys: async ({ user, prefix }) => ({ keys: [...seeded(user).keys()].filter((k) => k.startsWith(prefix)) }),
    wipe: async ({ user }) => {
      if (user === undefined) stores.clear();
      else stores.set(user, new Map());
      signedIn = false;
    },
    trialStats: async () => stats,
    resetTrial: async () => undefined,
  };
}
