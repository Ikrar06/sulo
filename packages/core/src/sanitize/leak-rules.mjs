// Leak patterns shared by apps/extension/scripts/check-leaks.mjs (repo scan)
// and sanitize/leaks.ts (in-extension scan before a fixture is saved).
// Plain JS with no dependencies so the pre-commit hook works before install.

/**
 * A 16-digit NIK holds the region (2 digits each for province, regency,
 * district), the birth date (day + 40 for women) and month, then year and
 * a serial. Long runs in bundled lookup tables or MAX_SAFE_INTEGER do not
 * fit, so they are not reported.
 * @param {string} m
 */
export function plausibleNik(m) {
  const dd = Number(m.slice(6, 8));
  const day = dd > 40 ? dd - 40 : dd;
  const month = Number(m.slice(8, 10));
  return /^[1-9]\d[0-9]{4}/.test(m) && Number(m.slice(0, 2)) >= 11 && day >= 1 && day <= 31 && month >= 1 && month <= 12;
}

/**
 * An 18-digit NIP: birth date YYYYMMDD, appointment YYYYMM, sex (1 or 2)
 * and a 3-digit serial.
 * @param {string} m
 */
export function plausibleNip(m) {
  const year = Number(m.slice(0, 4));
  const month = Number(m.slice(4, 6));
  const day = Number(m.slice(6, 8));
  const since = Number(m.slice(8, 12));
  const sinceMonth = Number(m.slice(12, 14));
  return year >= 1940 && year <= 2015 && month >= 1 && month <= 12 && day >= 1 && day <= 31 && since >= 1960 && since <= 2100 && sinceMonth >= 1 && sinceMonth <= 12 && (m[14] === '1' || m[14] === '2');
}

/**
 * `onlyFixtures`: the rule applies only to files under fixtures/ (and to
 * recorder output, which becomes a fixture).
 * @type {{ name: string, re: RegExp, allow?: (match: string) => boolean, onlyFixtures?: boolean }[]}
 */
export const LEAK_RULES = [
  {
    // The editor link of a form gives anyone who has it the form's answers
    // view; only the public "viewform" link may ever be committed.
    name: 'Tautan edit Google Form',
    re: /docs\.google\.com\/forms\/[^\s'"`)<>]*\/edit/gi,
  },
  {
    name: 'Alamat email Unhas',
    re: /[A-Za-z0-9._%+-]+@(?:[a-z0-9-]+\.)*unhas\.ac\.id/gi,
  },
  {
    name: 'Pola mirip NIM',
    re: /\b[A-Z]\d{9}\b/g,
    // Sanitized placeholders look like D000000001.
    allow: (m) => /^[A-Z]0{6}\d{3}$/.test(m),
  },
  {
    name: 'Sesskey di URL',
    re: /sesskey=([A-Za-z0-9]{8,})/g,
    allow: (m) => /sesskey=SESSKEY/.test(m),
  },
  {
    name: 'Sesskey di JSON',
    re: /"sesskey"\s*:\s*"([A-Za-z0-9]{8,})"/g,
    allow: (m) => /"SESSKEY/.test(m),
  },
  {
    name: 'Cookie sesi Moodle',
    re: /MoodleSession[A-Za-z0-9_]*\s*=\s*[A-Za-z0-9%]{8,}/g,
  },
  {
    name: 'Token web service Moodle',
    re: /\b(?:wstoken|token)=[a-f0-9]{32}\b/gi,
  },
  {
    name: 'Pola mirip NIK (16 digit)',
    re: /(?<![\d.])\d{16}(?![\d.])/g,
    // Sanitized placeholders are mostly zeros, e.g. 0000000000000001; numbers that cannot be a NIK pass.
    allow: (m) => /^0{13}\d{3}$/.test(m) || !plausibleNik(m),
  },
  {
    name: 'Pola mirip NIP (18 digit)',
    re: /(?<![\d.])\d{18}(?![\d.])/g,
    allow: (m) => /^0{15}\d{3}$/.test(m) || !plausibleNip(m),
  },
  {
    name: 'Parameter mirip kunci di URL',
    re: /[?&](?:key|token|signature|sig)=([A-Za-z0-9_\-.%~]{16,})/gi,
    allow: (m) => /=SESSKEY/.test(m),
  },
  {
    name: 'Field sensitif NEOSIA di fixture',
    re: /"(?:nik|nisn|tanggal_lahir|alamat)"\s*:/gi,
    onlyFixtures: true,
  },
];

/**
 * @param {{ onlyFixtures?: boolean }} rule
 * @param {string} relPath repository-relative path with forward slashes
 */
export function ruleApplies(rule, relPath) {
  // fixtures/ at the root of the scan or of a workspace package (apps/extension/fixtures/).
  return !rule.onlyFixtures || relPath.startsWith('fixtures/') || relPath.includes('/fixtures/');
}

/**
 * Returns the names of rules that match `text`. Never returns the matched
 * value itself, so callers cannot accidentally print it.
 * @param {string} text
 * @param {string} [relPath] where the text will live; defaults to a fixture
 * @returns {string[]}
 */
export function findLeaks(text, relPath = 'fixtures/recorded.json') {
  const found = [];
  for (const rule of LEAK_RULES) {
    if (!ruleApplies(rule, relPath)) continue;
    rule.re.lastIndex = 0;
    for (const match of text.matchAll(rule.re)) {
      if (rule.allow && rule.allow(match[0])) continue;
      found.push(rule.name);
    }
  }
  return found;
}
