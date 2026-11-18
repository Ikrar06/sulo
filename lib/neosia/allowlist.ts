// The one source of truth for the NEOSIA module (docs/NEOSIA.md, project
// rules 12 to 15): hosts, endpoint paths, the fields kept and the fields
// dropped. Plain data with no imports, because the page-world capture
// script (entrypoints/neosia-main.ts) bundles it and must stay
// dependency-free. Tested in tests/neosia-allowlist.test.ts.

/** The NEOSIA app's pages: where the two content scripts run. */
export const NEOSIA_APP_ORIGIN = 'https://neosia.unhas.ac.id';
export const NEOSIA_APP_MATCH = 'https://neosia.unhas.ac.id/*';
/** The only host whose responses are ever looked at. */
export const NEOSIA_API_HOST = 'api.neosia.unhas.ac.id';

/** optional_host_permissions in the manifest; asked for together with "scripting". */
export const NEOSIA_HOST_PERMISSIONS = [NEOSIA_APP_MATCH, `https://${NEOSIA_API_HOST}/*`] as const;
