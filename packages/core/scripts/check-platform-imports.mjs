#!/usr/bin/env node
// packages/core must run in the extension and in the Android app alike, so
// it never touches a platform directly (docs/ARCHITECTURE.md, "core tanpa
// chrome.*"). Fails when a file in src/:
// - imports wxt, @wxt-dev/*, webextension-polyfill, react, react-dom or radix-ui
// - imports a file outside packages/core (apps/extension, scripts, ...)
// - uses chrome.* or browser.* (comments and strings are ignored)
// The DOM is ruled out by tsconfig.json (no DOM library): document, window,
// localStorage and HTMLElement do not even type-check there.
// No dependencies.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const FORBIDDEN_PACKAGES = /^(wxt|@wxt-dev\/|webextension-polyfill|react(-dom)?|radix-ui|@radix-ui\/)(\/|$)/;
const SPEC = /(?:import|export)\s[^'"`;]*?from\s*(['"])([^'"]+)\1|import\s*\(\s*(['"])([^'"]+)\3\s*\)|import\s+(['"])([^'"]+)\5/g;
const PLATFORM_CALL = /\b(chrome|browser)\s*\.\s*[A-Za-z_]/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mts|mjs|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Blanks comments and string contents, keeping line breaks for line numbers. */
function codeOnly(text) {
  return text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|(['"`])(?:\\[\s\S]|(?!\1)[^\\])*\1/g, (m, quote) =>
    quote ? quote + m.slice(1, -1).replace(/[^\n]/g, ' ') + quote : m.replace(/[^\n]/g, ' '),
  );
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const problems = [];
for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file).split(sep).join('/');
  for (const m of text.matchAll(SPEC)) {
    const spec = m[2] ?? m[4] ?? m[6];
    if (FORBIDDEN_PACKAGES.test(spec)) problems.push(`${rel}:${lineOf(text, m.index)}  impor platform: ${spec}`);
    if (spec.startsWith('.') && !resolve(dirname(file), spec).startsWith(ROOT + sep)) problems.push(`${rel}:${lineOf(text, m.index)}  impor dari luar packages/core: ${spec}`);
    if (spec.startsWith('@/')) problems.push(`${rel}:${lineOf(text, m.index)}  alias ekstensi: ${spec}`);
  }
  const code = codeOnly(text);
  for (const m of code.matchAll(PLATFORM_CALL)) problems.push(`${rel}:${lineOf(code, m.index)}  memakai ${m[1]}.*`);
}

if (problems.length > 0) {
  console.error(`check-platform-imports: ${problems.length} masalah. packages/core tidak boleh menyentuh platform; pakai adaptor di src/platform.`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`check-platform-imports: bersih (${walk(SRC).length} berkas di packages/core/src).`);
