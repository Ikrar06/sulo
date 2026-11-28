// SuloNeosia, the native NEOSIA screen (apps/mobile/android, Kotlin; M8d).
// It opens one of NEOSIA's pages from a tap and reads
// the trial's counters (labels and numbers only; no captured data).
import { registerPlugin } from '@capacitor/core';

export type NeosiaPage = 'login' | 'home' | 'khs' | 'krs' | 'transkrip' | 'matakuliah';

export interface NeosiaTrialStats {
  captures: Record<string, number>;
  rejected: Record<string, number>;
  requests: Record<string, number>;
  pages: string[];
  largestBytes: number;
  scriptOnLogin: number;
  spaToLogin: number;
  spaFromLogin: number;
  webView: string;
  docStartSupported: boolean;
  listenerSupported: boolean;
}

export interface SuloNeosiaPlugin {
  /** Resolves when the NEOSIA screen closes: signed_in (it left the login page), needs_login (a page with the script reached the login page; the screen closed itself), or closed. */
  /** closeOnData (1.1.0, "Perbarui dari NEOSIA"): the screen closes itself once data came in, answering `data`. */
  open(options: { page: NeosiaPage; close: string; script?: boolean; autoCloseMs?: number; closeOnData?: boolean }): Promise<{ result: 'signed_in' | 'needs_login' | 'closed' | 'data' }>;
  /** "Perbarui NEOSIA otomatis" (1.1.0): Beranda in a hidden WebView, at most 30 s. */
  visit(): Promise<{ result: 'data' | 'needs_login' | 'timeout' | 'unsupported' }>;
  /** Whether this WebView can capture at all (both features). */
  support(): Promise<{ docStart: boolean; listener: boolean; webViewPackage: string | null }>;
  /** The projected captures waiting since the NEOSIA screen was open; the queue is empty after. */
  takeCaptures(): Promise<{ messages: string[] }>;
  /** core's NEOSIA store for one SIKOLA account: encrypted values (native NeosiaStore). */
  storeGet(o: { user: number; key: string }): Promise<{ value: string | null }>;
  storeSet(o: { user: number; key: string; value: string }): Promise<void>;
  storeRemove(o: { user: number; keys: string[] }): Promise<void>;
  storeKeys(o: { user: number; prefix: string }): Promise<{ keys: string[] }>;
  /** One account's NEOSIA data, or every account's (no user); web: NEOSIA's own cookies and web storage too ("Putuskan NEOSIA"). */
  wipe(o: { user?: number; web?: boolean }): Promise<void>;
  trialStats(): Promise<NeosiaTrialStats>;
  resetTrial(): Promise<void>;
}

export const SuloNeosia = registerPlugin<SuloNeosiaPlugin>('SuloNeosia', {
  // pnpm mobile:web and Vitest: synthetic snapshots in memory, no NEOSIA page (src/fake/neosia.ts).
  ...(__SULO_WEB_FAKE__ ? { web: () => import('./fake/neosia').then((m) => m.fakeNeosia()) } : {}),
  // The synthetic iPhone build (Fase 1, docs/ios): the same stand-in until the native plugin exists.
  ...(__SULO_WEB_FAKE__ ? { ios: () => import('./fake/neosia').then((m) => m.fakeNeosia()) } : {}),
});
