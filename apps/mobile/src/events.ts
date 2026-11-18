// Events between parts of the app that do not import each other.

/** The tester screen: seven taps on the APK version in Tentang (debug builds only). */
export const DEV_EVENT = 'sulo:dev';

/** After Perbarui: detail.fresh is true when new data came in (Ringkasan's mascot cheers for 1.5 s). */
export const REFRESHED_EVENT = 'sulo:refreshed';

/** Debug builds: the dev screen asks the app to show the onboarding again from the first screen. */
export const REPLAY_ONBOARDING_EVENT = 'sulo:replay-onboarding';
