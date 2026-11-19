// Debug build only (the debug screen): a test config from Sulo's public
// data repository, to try the remote switches without publishing to main.
// Only raw.githubusercontent.com/Ikrar06/sulo-data/ URLs are taken; the
// file is validated like the official config (remoteConfigSchema, Zod), and
// a broken one changes nothing. Kept in the app's Preferences, which an
// uninstall removes (Android backup is off). "Kembali ke config resmi"
// forgets it and reads the official file again.
// scripts/check-no-dev-code.mjs fails a release build that carries this.

import type { Platform } from '@sulo/core/platform';
import { REMOTE_CONFIG_FILE_KEY, REMOTE_CONFIG_KEY, remoteConfigSchema } from '@sulo/core/remote/remote-config';

export const TEST_CONFIG_PREFIX = 'https://raw.githubusercontent.com/Ikrar06/sulo-data/';
export const TEST_CONFIG_KEY = 'mobile:dev:testConfig';

export type TestConfigResult = { ok: true } | { ok: false; reason: 'prefix' | 'fetch' | 'json' | 'schema' };

/** Only Sulo's own data repository, over https, nothing else. */
export function testConfigUrlOk(url: string): boolean {
  if (!url.startsWith(TEST_CONFIG_PREFIX)) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.host === 'raw.githubusercontent.com' && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** Validates like the official config; a broken file is null (the official config stays). */
export function parseTestConfig(raw: unknown) {
  const parsed = remoteConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function applyTestConfig(platform: Platform, url: string, fetcher: typeof fetch = fetch): Promise<TestConfigResult> {
  if (!testConfigUrlOk(url)) return { ok: false, reason: 'prefix' };
  let json: unknown;
  try {
    const response = await fetcher(url, { credentials: 'omit', cache: 'no-store' });
    if (!response.ok) return { ok: false, reason: 'fetch' };
    json = await response.json();
  } catch (e) {
    return { ok: false, reason: e instanceof SyntaxError ? 'json' : 'fetch' };
  }
  const config = parseTestConfig(json);
  if (!config) return { ok: false, reason: 'schema' };
  await platform.store.set(REMOTE_CONFIG_KEY, { ...config, fetchedAt: platform.clock.now() });
  await platform.store.set(TEST_CONFIG_KEY, { url, at: platform.clock.now() });
  return { ok: true };
}

export async function readTestConfig(platform: Platform): Promise<{ url: string; at: number } | null> {
  return (await platform.store.get<{ url: string; at: number }>(TEST_CONFIG_KEY)) ?? null;
}

/** Back to the official config: the test is forgotten and the official file is due at once. */
export async function clearTestConfig(platform: Platform): Promise<void> {
  await platform.store.remove([TEST_CONFIG_KEY, REMOTE_CONFIG_KEY, REMOTE_CONFIG_FILE_KEY]);
}
