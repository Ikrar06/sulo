// The Android version rule (M8e E2): 0.9.x always below 1.0.0, digits and dots only.
import { describe, expect, it } from 'vitest';
import { highestReleased, versionCode } from '../scripts/version-code.mjs';

describe('versionCode', () => {
  it('follows major * 10000 + minor * 100 + patch', () => {
    expect(versionCode('0.9.0')).toBe(900);
    expect(versionCode('0.9.12')).toBe(912);
    expect(versionCode('1.0.0')).toBe(10000);
    expect(versionCode('1.0.3')).toBe(10003);
  });
  it('every 0.9.x stays below 1.0.0', () => {
    for (let p = 0; p <= 99; p++) expect(versionCode(`0.9.${p}`)).toBeLessThan(versionCode('1.0.0'));
  });
  it('refuses suffixes and parts of 100 or more', () => {
    for (const v of ['1.0.0-beta', '1.0', 'v1.0.0', '1.100.0', '1.0.100', '']) expect(() => versionCode(v)).toThrow();
  });
  it('finds the highest release tag, leaving out the one being released', () => {
    expect(highestReleased(['v0.9.0', 'v0.9.2', 'v0.9.1', 'pantau', 'v1.0.0-rc'], 'v0.9.2')).toEqual({ tag: 'v0.9.1', code: 901 });
    expect(highestReleased([])).toBeNull();
  });
  it('leaves out every tag on the commit being built, so a release never compares with itself', () => {
    // The v0.9.0 run: the APK check had no --tag, and the only tags were v0.1.0 and v0.9.0 itself.
    expect(highestReleased(['v0.1.0', 'v0.9.0'], ['v0.9.0'])).toEqual({ tag: 'v0.1.0', code: 100 });
    expect(highestReleased(['v0.9.0', 'v0.9.1'], ['v0.9.1', 'v0.9.1'])).toEqual({ tag: 'v0.9.0', code: 900 });
    // Only the commit's own tags are left out: an older release still counts.
    expect(highestReleased(['v0.9.0', 'v0.9.1', 'v0.9.2'], ['v0.9.1'])).toEqual({ tag: 'v0.9.2', code: 902 });
    expect(highestReleased(['v0.9.0'], ['v0.9.0'])).toBeNull();
  });
});
