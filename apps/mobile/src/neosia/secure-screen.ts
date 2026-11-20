// FLAG_SECURE while grades are on screen (M8e E2): Nilai and the Studi card
// (when it shows the GPA) each hold it; the window stays secure until the
// last one lets go, so one closing never unprotects the other.

import { useEffect } from 'react';

export interface SecureSwitch {
  secure(options: { on: boolean }): Promise<void>;
}

/** A counter around the native switch: on at the first hold, off after the last release (each release counts once). */
export function secureHolder(native: SecureSwitch) {
  let holds = 0;
  const apply = (on: boolean) => void native.secure({ on }).catch(() => undefined);
  return {
    hold(): () => void {
      holds += 1;
      if (holds === 1) apply(true);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        holds -= 1;
        if (holds === 0) apply(false);
      };
    },
    get holds() {
      return holds;
    },
  };
}

let shared: ReturnType<typeof secureHolder> | null = null;

/** Holds FLAG_SECURE while `active` (grades shown) and the calling screen is mounted. */
export function useSecureScreen(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let release: (() => void) | null = null;
    let cancelled = false;
    // Loaded lazily, so the plain test of secureHolder needs no Capacitor.
    void import('../session').then(({ SuloSession }) => {
      shared ??= secureHolder(SuloSession);
      if (!cancelled) release = shared.hold();
    });
    return () => {
      cancelled = true;
      release?.();
    };
  }, [active]);
}
