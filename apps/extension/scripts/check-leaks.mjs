#!/usr/bin/env node
// Scans the repository for personal or session data that must never be committed.
// Usage: node scripts/check-leaks.mjs [path ...]
// Exits with code 1 when a suspicious pattern is found.
// No dependencies, so it works before the project is scaffolded.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { LEAK_RULES, ruleApplies } from '../../../packages/core/src/sanitize/leak-rules.mjs';

const ROOT = process.cwd();

// docs/ (private, git-ignored) holds example patterns on purpose. fixtures/raw/ is git-ignored local data.
const SKIP_DIRS = new Set(['node_modules', '.git', '.output', '.wxt', 'dist', 'docs']);
// Matched anywhere in the path (the workspace nests them under apps/ and packages/).
const SKIP_PATHS = ['fixtures/raw', 'scripts/check-leaks.mjs', 'sanitize/leak-rules.mjs', 'pnpm-lock.yaml'];
const TEXT_EXT = /\.(json|html?|ts|tsx|mts|js|jsx|mjs|cjs|md|txt|css|ya?ml|csv|svg|ics)$/i;
const MAX_BYTES = 2 * 1024 * 1024;

// Patterns live in packages/core/src/sanitize/leak-rules.mjs, shared with the in-extension scan.
const RULES = LEAK_RULES;

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full).split(sep).join('/');
    if (SKIP_PATHS.some((p) => rel === p || rel.startsWith(p + '/') || rel.endsWith('/' + p) || rel.includes('/' + p + '/'))) continue;
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
  const rel = relative(ROOT, file).split(sep).join('/');
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (!ruleApplies(rule, rel)) continue;
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
  console.error(`\n${findings} temuan. Sanitasi dulu (lihat fixtures/README.md) sebelum commit.`);
  process.exit(1);
}
console.log(`Bersih: ${files.length} berkas diperiksa.`);
