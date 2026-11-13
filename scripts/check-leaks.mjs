#!/usr/bin/env node
// Scans the repository for personal or session data that must never be committed.
// Usage: node scripts/check-leaks.mjs [path ...]
// Exits with code 1 when a suspicious pattern is found.
// No dependencies, so it works before the project is scaffolded.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();

// docs/ holds example patterns on purpose. fixtures/raw/ is git-ignored local data.
const SKIP_DIRS = new Set(['node_modules', '.git', '.output', '.wxt', 'dist', 'docs']);
const SKIP_PATHS = ['fixtures/raw', 'scripts/check-leaks.mjs', 'pnpm-lock.yaml'];
const TEXT_EXT = /\.(json|html?|ts|tsx|js|mjs|cjs|md|txt|css|ya?ml|csv|svg)$/i;
const MAX_BYTES = 2 * 1024 * 1024;

const RULES = [
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
    allow: (m) => /"SESSKEY"/.test(m),
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

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full).split(sep).join('/');
    if (SKIP_PATHS.some((p) => rel === p || rel.startsWith(p + '/'))) continue;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out);
    } else if (TEXT_EXT.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const targets = process.argv.slice(2);
const files = targets.length
  ? targets.flatMap((t) => (statSync(t).isDirectory() ? walk(join(ROOT, t), []) : [join(ROOT, t)]))
  : walk(ROOT, []);

let findings = 0;
for (const file of files) {
  if (statSync(file).size > MAX_BYTES) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      for (const match of line.matchAll(rule.re)) {
        if (rule.allow && rule.allow(match[0])) continue;
        findings++;
        // Print the location and rule only, never the matched value.
        console.error(`${relative(ROOT, file)}:${i + 1}  ${rule.name}`);
      }
    }
  });
}

if (findings > 0) {
  console.error(`\n${findings} temuan. Sanitasi dulu (lihat docs/TESTING.md) sebelum commit.`);
  process.exit(1);
}
console.log(`Bersih: ${files.length} berkas diperiksa.`);
