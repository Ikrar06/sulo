// A new Android version (M8e E3), from the config the app already reads
// (config.json mobile.release, core remote/release.ts). No request of its
// own. The installed versionCode follows app/build.gradle's rule from the
// version this bundle was built with.

import { readRemoteConfig } from '@sulo/core/remote/remote-config';
import { parseRelease, readDismissal, releaseNotice, RELEASE_DISMISS_KEY, versionCodeOf, type ReleaseDismissal, type ReleaseInfo, type ReleaseNotice } from '@sulo/core/remote/release';
import type { KeyValueStore, UnixSeconds } from '@sulo/core/types';

/** This build's versionCode (the same number Gradle wrote into the APK). */
export const INSTALLED_CODE = versionCodeOf(__SULO_VERSION__) ?? 0;

/**
 * The SHA-256 line (owner, 20 Nov 2026): only for debug builds and the test
 * phase (installed below 1.0.0, the 0.9.x tester package); the public 1.0.0
 * and later show just "Unduh" and how to install.
 */
export const showChecksum = (installed = INSTALLED_CODE, debug = __SULO_DEV__): boolean => debug || installed < (versionCodeOf('1.0.0') as number);

export async function releaseState(store: KeyValueStore, now: UnixSeconds, installed = INSTALLED_CODE): Promise<ReleaseNotice> {
  const config = await readRemoteConfig(store);
  return releaseNotice(parseRelease(config.mobile), installed, readDismissal(await store.get(RELEASE_DISMISS_KEY)), now);
}

/** True while this version is below a required update: the SIKOLA client refuses every request. */
export async function updateRequired(store: KeyValueStore, now: UnixSeconds, installed = INSTALLED_CODE): Promise<boolean> {
  return (await releaseState(store, now, installed)).kind === 'required';
}

/** "Nanti": the card for this version stays closed for 3 days. */
export async function dismissRelease(store: KeyValueStore, versionCode: number, now: UnixSeconds): Promise<void> {
  await store.set<ReleaseDismissal>(RELEASE_DISMISS_KEY, { versionCode, at: now });
}

/** A newer version from the config, whatever was closed (Tentang's row); null when up to date or none. */
export async function newerRelease(store: KeyValueStore, installed = INSTALLED_CODE): Promise<ReleaseInfo | null> {
  const r = parseRelease((await readRemoteConfig(store)).mobile);
  return r !== null && r.versionCode > installed ? r : null;
}
