import { describe, expect, it } from 'vitest';
import { parseIosRelease, parseRelease, releaseNotice } from '@sulo/core/remote/release';

const SHA = 'a'.repeat(64);
const good = { versionCode: 10100, versionName: '1.1.0', url: 'https://github.com/Ikrar06/sulo/releases/download/v1.1.0/sulo-1.1.0-ios.ipa', sha256: SHA, size: 1_200_000 };

describe('the iPhone release (mobile.ios.release)', () => {
  it('reads a whole, valid section; "Lihat data terakhir" allowed unless turned off', () => {
    expect(parseIosRelease({ ios: { release: good } })).toMatchObject({ versionCode: 10100, url: good.url, size: 1_200_000, readOnlyAllowed: true, minVersionCode: 0 });
    expect(parseIosRelease({ ios: { release: { ...good, readOnlyAllowed: false, minVersionCode: 10100 } } })).toMatchObject({ readOnlyAllowed: false, minVersionCode: 10100 });
  });

  it('refuses anything not the owner\'s .ipa, a missing size, or broken fields', () => {
    for (const bad of [
      { ...good, url: 'https://github.com/Ikrar06/sulo/releases/download/v1.1.0/sulo.apk' },
      { ...good, url: 'https://github.com/someone/sulo/releases/download/v1.1.0/sulo.ipa' },
      { ...good, url: 'https://example.com/sulo.ipa' },
      { ...good, url: 'https://github.com/Ikrar06/sulo/releases/download/../x.ipa' },
      { ...good, size: undefined },
      { ...good, size: -1 },
      { ...good, sha256: 'xyz' },
      { ...good, versionName: '1.1' },
      { ...good, readOnlyAllowed: 'no' },
      { ...good, minVersionCode: 99999 },
    ]) expect(parseIosRelease({ ios: { release: bad } }), JSON.stringify(bad)).toBeNull();
    expect(parseIosRelease({ release: good })).toBeNull();
    expect(parseIosRelease(null)).toBeNull();
  });

  it('stays apart from Android: each platform reads only its own section', () => {
    const mobile = { ios: { release: good } };
    expect(parseRelease(mobile)).toBeNull();
    const release = parseIosRelease(mobile)!;
    expect(releaseNotice(release, 10000, null, 0).kind).toBe('available');
    expect(releaseNotice({ ...release, minVersionCode: 10100 }, 10000, null, 0).kind).toBe('required');
  });
});
