// A new Android version (M8e E3), told by config.json's mobile.release:
// the file the app (and the watch worker) already reads, so no new request.
// Sulo never downloads or installs anything itself: "Unduh" opens the
// GitHub release asset in the browser, so there is no
// REQUEST_INSTALL_PACKAGES. Pure.
//
// The section is read whole: any field missing, of the wrong type, or a
// URL that is not one of the owner's GitHub release assets makes it absent,
// so a broken file changes nothing. minVersionCode marks a required update
// (security fixes only): below it the app shows one "Sulo perlu diperbarui"
// screen, makes no SIKOLA request, and the worker holds; data stays.

import type { UnixSeconds } from '../types';

export interface ReleaseInfo {
  versionCode: number;
  versionName: string;
  /** https://github.com/Ikrar06/<repo>/releases/download/<tag>/<file>.apk */
  url: string;
  /** Lowercase hex, 64 characters. */
  sha256: string;
  /** 0 when absent; never above versionCode. */
  minVersionCode: number;
  notes: { id: string; en: string } | null;
}

/** Only an asset of one of the owner's GitHub releases (no segment starts with a dot, so no ".."). */
export const RELEASE_URL = /^https:\/\/github\.com\/Ikrar06\/[A-Za-z0-9_-][A-Za-z0-9._-]*\/releases\/download\/[A-Za-z0-9_-][A-Za-z0-9._-]*\/[A-Za-z0-9_-][A-Za-z0-9._-]*\.apk$/;
const VERSION_NAME = /^\d+\.\d+\.\d+$/;
const SHA256 = /^[0-9a-fA-F]{64}$/;
const NOTES_MAX = 300;
/** A closed card for a version stays closed this long, then shows again for that same version. */
export const RELEASE_RESHOW_SEC = 3 * 86_400;
export const RELEASE_DISMISS_KEY = 'mobile:releaseDismissed';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCode = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 2_100_000_000;

/** The Android versionCode for "x.y.z" (app/build.gradle's rule: major * 10000 + minor * 100 + patch); null otherwise. */
export function versionCodeOf(version: string): number | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) return null;
  const [major, minor, patch] = m.slice(1).map(Number) as [number, number, number];
  return minor > 99 || patch > 99 ? null : major * 10000 + minor * 100 + patch;
}

/** mobile.release from the raw `mobile` section; null when absent or not entirely valid. */
export function parseRelease(mobile: unknown): ReleaseInfo | null {
  if (!isObject(mobile) || !isObject(mobile.release)) return null;
  const r = mobile.release;
  if (!isCode(r.versionCode)) return null;
  if (typeof r.versionName !== 'string' || !VERSION_NAME.test(r.versionName)) return null;
  if (typeof r.url !== 'string' || !RELEASE_URL.test(r.url)) return null;
  if (typeof r.sha256 !== 'string' || !SHA256.test(r.sha256)) return null;
  const min = r.minVersionCode === undefined ? 0 : r.minVersionCode;
  if (!(min === 0 || isCode(min)) || (min as number) > r.versionCode) return null;
  let notes: ReleaseInfo['notes'] = null;
  if (r.notes !== undefined) {
    if (!isObject(r.notes) || typeof r.notes.id !== 'string' || typeof r.notes.en !== 'string') return null;
    const id = r.notes.id.trim();
    const en = r.notes.en.trim();
    if (id === '' || en === '' || id.length > NOTES_MAX || en.length > NOTES_MAX) return null;
    notes = { id, en };
  }
  return { versionCode: r.versionCode, versionName: r.versionName, url: r.url, sha256: r.sha256.toLowerCase(), minVersionCode: min as number, notes };
}

export interface ReleaseDismissal {
  versionCode: number;
  at: UnixSeconds;
}

export type ReleaseNotice = { kind: 'none' } | { kind: 'available'; release: ReleaseInfo } | { kind: 'required'; release: ReleaseInfo };

/**
 * What to show for the installed versionCode: "required" below
 * minVersionCode (a full screen, no SIKOLA); "available" for a newer
 * version unless its card was closed less than 3 days ago; else nothing.
 */
export function releaseNotice(release: ReleaseInfo | null, installed: number, dismissed: ReleaseDismissal | null, now: UnixSeconds): ReleaseNotice {
  if (release === null || release.versionCode <= installed) return { kind: 'none' };
  if (installed < release.minVersionCode) return { kind: 'required', release };
  if (dismissed && dismissed.versionCode === release.versionCode && now - dismissed.at < RELEASE_RESHOW_SEC) return { kind: 'none' };
  return { kind: 'available', release };
}

/** The stored dismissal, or null when absent or unreadable. */
export function readDismissal(raw: unknown): ReleaseDismissal | null {
  return isObject(raw) && isCode(raw.versionCode) && typeof raw.at === 'number' ? { versionCode: raw.versionCode, at: raw.at } : null;
}
