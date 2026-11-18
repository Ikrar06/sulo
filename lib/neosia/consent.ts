// The NEOSIA consent text lives in lib/privacy/content.ts (that file may not
// import anything), so the consent dialog and the privacy page render the
// same object. Re-exported here for the dashboard.

export { NEOSIA_CONSENT, type ConsentText } from '../privacy/content';
