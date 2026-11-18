// Haptics for the onboarding (M8c.2): View.performHapticFeedback through
// the app's own Kotlin plugin, so there is no new permission and no new
// dependency, and Android's own touch-feedback setting is respected. Light
// for a choice, firm for a finish. Nothing in the browser.

import { SuloSession } from '../session';

export function haptic(kind: 'light' | 'firm'): void {
  if (__SULO_WEB_FAKE__ && import.meta.env.MODE === 'web') return;
  void SuloSession.haptic({ kind }).catch(() => undefined);
}
