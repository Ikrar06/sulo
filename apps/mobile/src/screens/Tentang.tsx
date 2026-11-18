// Tentang: the dashboard's About, with the APK's version under it.
import { mobileDash } from '@sulo/core/i18n/mobile';
import { mobileWords } from '@sulo/core/i18n/mobile';
import { TentangContent } from '@sulo/ui/dashboard/TentangContent';
import { useRef } from 'react';
import { useI18n } from '@sulo/ui/i18n';
import { DEV_EVENT } from '../events';

export function TentangScreen() {
  const { locale } = useI18n();
  const w = mobileWords(locale);
  const taps = useRef(0);
  // Debug builds: seven taps open the session-age screen.
  const tap = () => {
    taps.current += 1;
    if (taps.current >= 7 && __SULO_DEV__) {
      taps.current = 0;
      window.dispatchEvent(new Event(DEV_EVENT));
    }
  };
  return (
    <TentangContent
      d={mobileDash(locale)}
      version={__SULO_VERSION__}
      onOpenPrivacy={() => {
        window.location.hash = '#privasi';
      }}
      versionExtra={
        <button type="button" className="mt-1 block min-h-11 text-left text-m12 font-normal text-muted-foreground tabular-nums" onClick={tap}>
          {w.about.apkVersion(__SULO_VERSION__)}
        </button>
      }
    />
  );
}
