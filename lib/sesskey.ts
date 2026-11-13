// Pure sesskey extraction. The content script gathers raw candidates from
// the page DOM; this module decides which one, if any, is valid.

/** Moodle sesskeys are short alphanumeric strings (10 chars by default). */
const SESSKEY_PATTERN = /^[A-Za-z0-9]{8,32}$/;

export function isValidSesskey(value: unknown): value is string {
  return typeof value === 'string' && SESSKEY_PATTERN.test(value);
}

export interface SesskeyCandidates {
  /** Values of input[name="sesskey"] elements. */
  inputValues: readonly string[];
  /** href values of links containing "sesskey=" (e.g. the logout link). */
  hrefs: readonly string[];
}

export function pickSesskey(candidates: SesskeyCandidates, baseUrl: string): string | null {
  const fromInput = candidates.inputValues.find(isValidSesskey);
  if (fromInput) return fromInput;

  for (const href of candidates.hrefs) {
    const value = sesskeyFromHref(href, baseUrl);
    if (value) return value;
  }
  return null;
}

function sesskeyFromHref(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    if (url.origin !== new URL(baseUrl).origin) return null;
    const value = url.searchParams.get('sesskey');
    return isValidSesskey(value) ? value : null;
  } catch {
    return null;
  }
}
