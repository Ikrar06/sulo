// Leak patterns shared by scripts/check-leaks.mjs (repo scan) and
// lib/sanitize/leaks.ts (in-extension scan before a fixture is saved).
// Plain JS with no dependencies so the pre-commit hook works before install.

/** @type {{ name: string, re: RegExp, allow?: (match: string) => boolean }[]} */
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
];

/**
 * Returns the names of rules that match `text`. Never returns the matched
 * value itself, so callers cannot accidentally print it.
 * @param {string} text
 * @returns {string[]}
 */
export function findLeaks(text) {
  const found = [];
  for (const rule of LEAK_RULES) {
    rule.re.lastIndex = 0;
    for (const match of text.matchAll(rule.re)) {
      if (rule.allow && rule.allow(match[0])) continue;
      found.push(rule.name);
    }
  }
  return found;
}
