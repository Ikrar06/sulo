// FLAG_SECURE only while grades are really on screen (M8e E2, narrowed on
// 21 Nov 2026): the Nilai screen holds it for as long as it is open; the
// Studi card on Ringkasan holds it only while its GPA is rendered and inside
// the viewport. A masked card ("•••", grades hidden or privacy mode), a card
// scrolled away, or another tab leaves Ringkasan capturable. Holds are
// counted, so one closing never unprotects the other; the native side
// re-applies the last state when the app comes back from the background.

import { useEffect, useState } from 'react';

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

export interface StudiGpaState {
  /** The NEOSIA module is on. */
  enabled: boolean;
  gradesShown: boolean;
  privacyMode: boolean;
  /** The GPA read for the card; null when absent or not read (yet). */
  gpa: number | null;
}

/** Whether the Studi card renders its GPA as a number (else "•••"). The card's text and its flag both follow this. */
export function studiShowsGpa(s: StudiGpaState): boolean {
  return s.enabled && s.gradesShown && !s.privacyMode && s.gpa !== null;
}

/** Whether the Studi card holds FLAG_SECURE: the GPA rendered and inside the viewport. */
export function studiSecure(s: StudiGpaState & { inView: boolean }): boolean {
  return studiShowsGpa(s) && s.inView;
}

type ObserverLike = { observe(el: Element): void; disconnect(): void };
type ObserverFactory = (callback: (entries: { isIntersecting: boolean }[]) => void) => ObserverLike;

const browserObserver: ObserverFactory | null =
  typeof IntersectionObserver === 'undefined' ? null : (callback) => new IntersectionObserver(callback, { threshold: 0 });

/**
 * Reports whether `el` has any pixel inside the viewport. Without an
 * observer it reports visible: the safe side keeps the flag on.
 */
export function watchInView(el: Element, onChange: (inView: boolean) => void, factory: ObserverFactory | null = browserObserver): () => void {
  if (factory === null) {
    onChange(true);
    return () => undefined;
  }
  const observer = factory((entries) => {
    const last = entries[entries.length - 1];
    if (last) onChange(last.isIntersecting);
  });
  observer.observe(el);
  return () => observer.disconnect();
}

/** A callback ref and whether its element is in the viewport (false while unmounted). */
export function useInView<T extends Element>(): [(el: T | null) => void, boolean] {
  const [el, setEl] = useState<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (el === null) {
      setInView(false);
      return;
    }
    return watchInView(el, setInView);
  }, [el]);
  return [setEl, inView];
}

let shared: ReturnType<typeof secureHolder> | null = null;

/** Holds FLAG_SECURE while `active` and the calling screen is mounted; released when either ends. */
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
