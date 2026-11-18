// The domains Sulo may talk to, and the fixed rules for each. Every request
// goes through lib/net/scheduler.ts, which applies these. Pure data.
//
// - sikola: the Moodle client (lib/moodle/client.ts) adds the daily budget,
//   sesskey, allowlist and session gates on top.
// - sulo-data: the public data repository (remote config, academic
//   calendar). No cookies, no extra headers; at most once a day per file
//   (lib/remote/fetch-public.ts).
// - neosia: refuses everything. Sulo never sends a request to NEOSIA
//   (project rule 12); its data only comes from passive capture.

import { BACKOFF_KEY } from '../moodle/backoff';
import { REQUEST_TIMEOUT_MS, SIKOLA_ORIGIN } from '../moodle/limits';

export type DomainId = 'sikola' | 'sulo-data' | 'neosia';

export interface DomainPolicy {
  id: DomainId;
  /** Exact origins this domain covers. A URL elsewhere is refused. */
  origins: readonly string[];
  /** False: every request is refused before fetch. */
  allowRequests: boolean;
  /** Storage key of this domain's backoff state. */
  backoffKey: string;
  /** Fixed fetch options; callers cannot override them. */
  init: Pick<RequestInit, 'credentials' | 'redirect' | 'cache'>;
  timeoutMs: number;
}

export const SULO_DATA_ORIGIN = 'https://ikrar06.github.io';

export const DOMAINS: Readonly<Record<DomainId, DomainPolicy>> = {
  sikola: {
    id: 'sikola',
    origins: [SIKOLA_ORIGIN],
    allowRequests: true,
    backoffKey: BACKOFF_KEY,
    // A redirect means the session is gone (login page). Following it to
    // another host would surface as a CORS/network error instead.
    init: { credentials: 'include', redirect: 'manual' },
    timeoutMs: REQUEST_TIMEOUT_MS,
  },
  'sulo-data': {
    id: 'sulo-data',
    origins: [SULO_DATA_ORIGIN],
    allowRequests: true,
    backoffKey: 'global:backoff:sulo-data',
    // no-cache: the browser revalidates its own copy (it adds the conditional
    // headers itself); Sulo adds no header of its own.
    init: { credentials: 'omit', cache: 'no-cache' },
    timeoutMs: REQUEST_TIMEOUT_MS,
  },
  neosia: {
    id: 'neosia',
    origins: ['https://neosia.unhas.ac.id', 'https://api.neosia.unhas.ac.id'],
    allowRequests: false,
    backoffKey: 'global:backoff:neosia',
    init: { credentials: 'omit' },
    timeoutMs: REQUEST_TIMEOUT_MS,
  },
};

/** The domain a URL belongs to, or null when Sulo may not contact it at all. */
export function domainOf(url: string): DomainId | null {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return null;
  }
  const found = Object.values(DOMAINS).find((d) => d.origins.includes(origin));
  return found ? found.id : null;
}
