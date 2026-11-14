// Leak patterns shared by scripts/check-leaks.mjs (repo scan) and
// lib/sanitize/leaks.ts (in-extension scan before a fixture is saved).
// Plain JS with no dependencies so the pre-commit hook works before install.

/**
 * `onlyFixtures`: the rule applies only to files under fixtures/ (and to
 * recorder output, which becomes a fixture).
 * @type {{ name: string, re: RegExp, allow?: (match: string) => boolean, onlyFixtures?: boolean }[]}
 */
export const LEAK_RULES = [
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
    // Sanitized placeholders are mostly zeros, e.g. 0000000000000001.
    allow: (m) => /^0{13}\d{3}$/.test(m),
  },
  {
    name: 'Pola mirip NIP (18 digit)',
    re: /(?<![\d.])\d{18}(?![\d.])/g,
    allow: (m) => /^0{15}\d{3}$/.test(m),
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
  return !rule.onlyFixtures || relPath.startsWith('fixtures/');
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
