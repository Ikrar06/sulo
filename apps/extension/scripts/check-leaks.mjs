#!/usr/bin/env node
// Scans the repository for personal or session data that must never be committed.
// Usage: node scripts/check-leaks.mjs [path ...] [--zip file.zip ...]
// Exits with code 1 when a suspicious pattern is found.
// Build output (a path given on the command line) and zips are also checked
// for the builder's machine: "/Users/", "/home/", "C:\\Users\\" and the local
// user name (os.userInfo()). In a zip path, {version} becomes the version in
// apps/extension/package.json.
// No dependencies, so it works before the project is scaffolded.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { userInfo } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { inflateRawSync } from 'node:zlib';
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

// ---- Arguments ----
const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const argv = process.argv.slice(2);
const zips = [];
const targets = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--zip') zips.push(resolve(ROOT, argv[++i].replaceAll('{version}', VERSION)));
  else targets.push(argv[i]);
}
const files = targets.length || zips.length
  ? targets.flatMap((t) => (statSync(resolve(ROOT, t)).isDirectory() ? walk(resolve(ROOT, t), []) : [resolve(ROOT, t)]))
  : walk(ROOT, []);

// ---- The builder's machine, in build output and zips only ----
const USER = userInfo().username;
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LOCAL_RULES = [
  { name: 'Path lokal macOS (/Users/)', re: /\/Users\//g },
  { name: 'Path lokal Linux (/home/)', re: /\/home\//g },
  { name: 'Path lokal Windows (C:\\Users\\)', re: /C:(\\\\|\\)Users(\\\\|\\)/gi },
  // The user name as a whole word; a public link that happens to contain it
  // (https://..., e.g. the maintainer's profile on the About page) is fine.
  ...(USER.length >= 3
    ? [{ name: 'Nama pengguna komputer ini', re: new RegExp(`(?<![A-Za-z0-9_.-])${escapeRe(USER)}(?![A-Za-z0-9_])`, 'g'), allowIn: (line, index) => /https?:\/\/[^\s"'`<>]*$/.test(line.slice(0, index)) }]
    : []),
];

// ---- Zip reading (no dependencies): central directory, stored or deflated ----
function zipEntries(path) {
  const buf = readFileSync(path);
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error(`${path}: bukan zip`);
  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    const method = buf.readUInt16LE(at + 10);
    const size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen);
    at += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    const dataAt = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(dataAt, dataAt + size);
    out.push({ name, read: () => (method === 8 ? inflateRawSync(raw) : raw).toString('utf8') });
  }
  return out;
}

// ---- Scan ----
let findings = 0;
function scan(label, rel, text, checkLocal) {
  text.split('\n').forEach((line, i) => {
    for (const rule of RULES) {
      if (!ruleApplies(rule, rel)) continue;
      rule.re.lastIndex = 0;
      for (const match of line.matchAll(rule.re)) {
        if (rule.allow && rule.allow(match[0])) continue;
        findings++;
        // Print the location and rule only, never the matched value.
        console.error(`${label}:${i + 1}  ${rule.name}`);
      }
    }
    if (!checkLocal) return;
    for (const rule of LOCAL_RULES) {
      rule.re.lastIndex = 0;
      let hits = 0;
      for (const match of line.matchAll(rule.re)) if (!(rule.allowIn && rule.allowIn(line, match.index))) hits++;
      if (hits === 0) continue;
      findings += hits;
      // Minified bundles are one long line: one report per line and rule.
      console.error(`${label}:${i + 1}  ${rule.name}${hits > 1 ? ` (${hits}x)` : ''}`);
    }
  });
}

const fromBuild = targets.length > 0;
for (const file of files) {
  if (statSync(file).size > MAX_BYTES) continue;
  const rel = relative(ROOT, file).split(sep).join('/');
  scan(relative(ROOT, file), rel, readFileSync(file, 'utf8'), fromBuild);
}
let zipped = 0;
for (const zip of zips) {
  for (const entry of zipEntries(zip)) {
    if (!TEXT_EXT.test(entry.name)) continue;
    const text = entry.read();
    if (text.length > MAX_BYTES) continue;
    zipped++;
    scan(`${relative(ROOT, zip)}!${entry.name}`, entry.name, text, true);
  }
}

if (findings > 0) {
  console.error(`\n${findings} temuan. Sanitasi dulu (lihat fixtures/README.md) sebelum commit.`);
  process.exit(1);
}
console.log(`Bersih: ${files.length + zipped} berkas diperiksa${zips.length ? ` (${zipped} di ${zips.length} zip)` : ''}.`);
