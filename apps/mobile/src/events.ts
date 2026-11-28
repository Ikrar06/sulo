// Events between parts of the app that do not import each other.

/** Seven taps on the version in Tentang: the Diagnostik screen (debug builds: the dev screen, which shows it too). */
export const DEV_EVENT = 'sulo:dev';

/** After Perbarui: detail.fresh is true when new data came in (Ringkasan's mascot cheers for 1.5 s). */
export const REFRESHED_EVENT = 'sulo:refreshed';

/** Debug builds: the dev screen asks the app to show the onboarding again from the first screen. */
export const REPLAY_ONBOARDING_EVENT = 'sulo:replay-onboarding';
