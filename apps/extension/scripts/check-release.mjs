#!/usr/bin/env node
// Release checklist on built folders (M6, part 5.4). Fails on:
// - console.log / console.debug calls
// - localhost or 127.0.0.1
// - source maps
// - a content_security_policy with unsafe-eval
// - any URL host outside the allowed list (the data domains, the plain
//   outside links users click, and strings that ship inside libraries)
// Usage: node scripts/check-release.mjs .output/chrome-mv3 [.output/edge-mv3 ...]

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED_HOSTS = new Set([
  // Data: the only hosts Sulo requests.
  'sikola-v2.unhas.ac.id',
  'ikrar06.github.io',
  // Sipakamase (1.1.0, hard rule 17): five read paths, GET only, once the student connects it (optional host).
  'sipakamase.unhas.ac.id',
  // Plain links opened by a click (docs/UI.md, "Tautan ke luar").
  'www.unhas.ac.id',
  'teer.id',
  'forms.gle',
  'calendar.google.com',
  'outlook.office.com',
  'www.instagram.com',
  'www.linkedin.com',
  'github.com',
  'ikrar.dev',
  // Denied before fetch by the scheduler (project rule 12): named, never requested.
  'neosia.unhas.ac.id',
  'api.neosia.unhas.ac.id',
  // Strings inside bundled libraries (namespaces, error-message links), never requested.
  'www.w3.org',
  'json-schema.org',
  'react.dev',
  'tailwindcss.com',
]);

const roots = process.argv.slice(2);
if (roots.length === 0) {
  console.error('check-release: beri folder hasil build, misalnya .output/chrome-mv3');
  process.exit(1);
}

const problems = [];
let count = 0;
for (const root of roots) {
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else check(root, path, name);
    }
  };
  walk(root);
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  if (JSON.stringify(manifest.content_security_policy ?? {}).includes('unsafe-eval')) problems.push(`${root}: CSP memuat unsafe-eval`);
}

function check(root, path, name) {
  count += 1;
  if (name.endsWith('.map')) problems.push(`${path}: source map`);
  if (!/\.(js|html|json|css)$/.test(name)) return;
  const text = readFileSync(path, 'utf8');
  if (/console\.(log|debug)\(/.test(text)) problems.push(`${path}: console.log/debug`);
  if (/localhost|127\.0\.0\.1/.test(text)) problems.push(`${path}: localhost`);
  for (const m of text.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)) {
    if (!ALLOWED_HOSTS.has(m[1])) problems.push(`${path}: host di luar daftar ${m[1]}`);
  }
}

if (problems.length) {
  console.error(`check-release: ${problems.length} masalah\n${[...new Set(problems)].join('\n')}`);
  process.exit(1);
}
console.log(`check-release: bersih (${count} berkas di ${roots.join(', ')}).`);
