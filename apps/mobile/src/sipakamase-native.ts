// SuloSipakamase, the native side of Sipakamase on Android (1.1.0, Kotlin
// apps/mobile/android/.../sipakamase). Its sign-in screen carries no script;
// `get` takes one of the five read-only paths only, adds the vault's cookie
// natively and never returns it; the data store is encrypted per account.
import { registerPlugin } from '@capacitor/core';
import type { NeosiaNative } from './platform/neosia-store';

export interface SuloSipakamasePlugin extends NeosiaNative {
  signIn(options: { close: string; offline: string; retry: string }): Promise<{ result: 'signed_in' | 'closed' | 'offline' }>;
  get(options: { path: string }): Promise<{ status?: number; toLogin?: boolean; html?: string; noSession?: boolean; networkError?: boolean; cookieExpires?: boolean; cookieMaxAge?: number | null }>;
  status(): Promise<{ hasSession: boolean }>;
  /** What the background keeper did: times and counts only. */
  workerState(): Promise<{ lastAt: number; date: string; count: number; loginAt: number; okAt?: number }>;
  /** Putuskan: the vault's cookie, the WebView's cookie, every account's data. */
  forget(): Promise<void>;
}

export const SuloSipakamase = registerPlugin<SuloSipakamasePlugin>('SuloSipakamase', {
  // pnpm mobile:web and Vitest: synthetic data in memory, no Sipakamase page (src/fake/sipakamase.ts).
  ...(__SULO_WEB_FAKE__ ? { web: () => import('./fake/sipakamase').then((m) => m.fakeSipakamase()) } : {}),
  // The synthetic iPhone build (Fase 1, docs/ios): the same stand-in until the native plugin exists.
  ...(__SULO_WEB_FAKE__ ? { ios: () => import('./fake/sipakamase').then((m) => m.fakeSipakamase()) } : {}),
});
