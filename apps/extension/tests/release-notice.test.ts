// A new Android version from config.json's mobile.release (M8e E3): read
// whole or not at all, only the owner's GitHub release assets, the card
// back after 3 days, a required update below minVersionCode.
import { describe, expect, it } from 'vitest';
import { parseRelease, readDismissal, releaseNotice, RELEASE_RESHOW_SEC, versionCodeOf } from '@sulo/core/remote/release';
import { versionCode as scriptVersionCode } from '../../mobile/scripts/version-code.mjs';

const REL = { versionCode: 906, versionName: '0.9.6', url: 'https://github.com/Ikrar06/sulo/releases/download/v0.9.6/sulo-0.9.6-android.apk', sha256: 'A'.repeat(64), minVersionCode: 0, notes: { id: ' Perbaikan pengingat. ', en: 'Reminder fixes.' } };
const NOW = 1_800_000_000;

describe('parseRelease', () => {
  it('reads a valid section (sha256 lowercased, notes trimmed)', () => {
    expect(parseRelease({ release: REL })).toEqual({ ...REL, sha256: 'a'.repeat(64), requiredFrom: null, notes: { id: 'Perbaikan pengingat.', en: 'Reminder fixes.' } });
    expect(parseRelease({ release: { ...REL, minVersionCode: undefined, notes: undefined } })).toMatchObject({ minVersionCode: 0, notes: null });
  });
  it('a required update shows as the card until its date, then as the required screen (1.1.0)', () => {
    const release = parseRelease({ release: { ...REL, minVersionCode: 906, requiredFrom: NOW + 3 * 86_400 } })!;
    expect(release.requiredFrom).toBe(NOW + 3 * 86_400);
    expect(releaseNotice(release, 905, null, NOW)).toEqual({ kind: 'available', release, requiredFrom: NOW + 3 * 86_400 });
    // A closed card comes back: it is a required update.
    expect(releaseNotice(release, 905, { versionCode: 906, at: NOW }, NOW + 60).kind).toBe('available');
    expect(releaseNotice(release, 905, null, NOW + 3 * 86_400).kind).toBe('required');
    expect(parseRelease({ release: { ...REL, requiredFrom: 'soon' } })).toBeNull();
  });
  it('ignores the whole section for any bad field', () => {
    const bad: Record<string, unknown>[] = [
      { url: 'https://github.com/Ikrar06/sulo/releases/tag/v0.9.6' },
      { url: 'https://github.com/other/sulo/releases/download/v0.9.6/x.apk' },
      { url: 'http://github.com/Ikrar06/sulo/releases/download/v0.9.6/x.apk' },
      { url: 'https://github.com.evil.io/Ikrar06/sulo/releases/download/v0.9.6/x.apk' },
      { url: 'https://github.com/Ikrar06/sulo/releases/download/v0.9.6/../x.apk?y=1' },
      { url: 'https://github.com/Ikrar06/../releases/download/v0.9.6/x.apk' },
      { url: 'https://github.com/Ikrar06/sulo/releases/download/../x.apk' },
      { versionName: '0.9.6-beta' },
      { versionCode: 0 },
      { versionCode: '906' },
      { sha256: 'xyz' },
      { minVersionCode: 907 },
      { minVersionCode: null },
      { notes: { id: '', en: 'x' } },
      { notes: { id: 'x'.repeat(301), en: 'x' } },
    ];
    for (const b of bad) expect([b, parseRelease({ release: { ...REL, ...b } })]).toEqual([b, null]);
    for (const m of [undefined, null, 'x', { release: 'x' }, {}]) expect(parseRelease(m)).toBeNull();
  });
});

describe('releaseNotice', () => {
  const rel = parseRelease({ release: { ...REL, minVersionCode: 903 } })!;
  it('nothing without a release or when up to date', () => {
    expect(releaseNotice(null, 900, null, NOW)).toEqual({ kind: 'none' });
    expect(releaseNotice(rel, 906, null, NOW)).toEqual({ kind: 'none' });
    expect(releaseNotice(rel, 910, null, NOW)).toEqual({ kind: 'none' });
  });
  it('available for a newer version, closed for 3 days, then back', () => {
    expect(releaseNotice(rel, 904, null, NOW).kind).toBe('available');
    const closed = { versionCode: 906, at: NOW };
    expect(releaseNotice(rel, 904, closed, NOW + RELEASE_RESHOW_SEC - 1).kind).toBe('none');
    expect(releaseNotice(rel, 904, closed, NOW + RELEASE_RESHOW_SEC).kind).toBe('available');
    // Closing an older version's card does not hide a newer one.
    expect(releaseNotice(rel, 904, { versionCode: 905, at: NOW }, NOW + 1).kind).toBe('available');
  });
  it('required below minVersionCode, whatever was closed', () => {
    expect(releaseNotice(rel, 902, { versionCode: 906, at: NOW }, NOW + 1)).toEqual({ kind: 'required', release: rel });
    expect(releaseNotice(rel, 903, null, NOW).kind).toBe('available');
  });
  it('reads a stored dismissal or nothing', () => {
    expect(readDismissal({ versionCode: 906, at: NOW })).toEqual({ versionCode: 906, at: NOW });
    for (const raw of [undefined, null, {}, { versionCode: '906', at: NOW }, { versionCode: 906 }]) expect(readDismissal(raw)).toBeNull();
  });
});

describe('versionCodeOf', () => {
  it('matches app/build.gradle and the release script, 0.9.x below 1.0.0', () => {
    for (const v of ['0.2.0', '0.9.0', '0.9.37', '1.0.0', '1.2.3', '2.0.99']) expect(versionCodeOf(v)).toBe(scriptVersionCode(v));
    expect(versionCodeOf('0.9.99')!).toBeLessThan(versionCodeOf('1.0.0')!);
    for (const v of ['1.0', '1.0.0-rc', '1.100.0']) expect(versionCodeOf(v)).toBeNull();
  });
});
