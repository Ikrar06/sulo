// Which phone the words are for (the iPhone, owner's decision of 26 Nov 2026, B3): set once by the app at
// start (apps/mobile/src/main.tsx, from Capacitor's platform); Android otherwise. Core knows no platform API
// (its hard rule): the app tells it. The dictionaries, help and privacy pick their iPhone wording from here.

export type MobileOs = 'android' | 'ios';

let current: MobileOs = 'android';

export const mobileOs = (): MobileOs => current;

export function setMobileOs(os: MobileOs): void {
  current = os;
}
