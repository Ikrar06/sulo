#!/usr/bin/env node
// The Android app uses only its type tokens (src/tokens.css): text-m26, text-m22,
// text-m18, text-m15, text-m15r, text-m13, text-m12, text-m11. Fails on
// any other text size in src/: pixel or rem sizes, Tailwind's named sizes,
// size variables, or font-size in an inline style. Shared parts from
// packages/ui are mapped to the same tokens by tokens.css. No dependencies.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = new URL('../src', import.meta.url).pathname;
/** The app's own card patterns in packages/ui follow the same tokens. */
const SHARED = new URL('../../../packages/ui/src/mobile', import.meta.url).pathname;
const ALLOWED = new Set(['m26', 'm22', 'm18', 'm15', 'm15r', 'm13', 'm12', 'm11']);
const NAMED = /(?<![\w-])text-(xs|sm|base|lg|[2-9]?xl)(?![\w-])/g;
const ARBITRARY = /(?<![\w-])text-\[(?:length:)?[\d.]+(?:px|rem|em)\]/g;
const VARIABLE = /(?<![\w-])text-\((?:length:)?--[\w-]+\)/g;
const TOKEN = /(?<![\w-])text-(m\d+r?)(?![\w-])/g;
const INLINE = /fontSize\s*:/g;

const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : /\.(tsx?|css)$/.test(n) ? [join(dir, n)] : []));
const problems = [];
for (const file of [...walk(SRC), ...walk(SHARED)]) {
  if (file.endsWith('tokens.css')) continue;
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const at = `${relative(SRC, file).replace(/^(\.\.\/)+/, '')}:${i + 1}`;
    for (const re of [NAMED, ARBITRARY, VARIABLE, INLINE]) for (const m of line.matchAll(re)) problems.push(`${at}  ukuran teks di luar token: ${m[0]}`);
    for (const m of line.matchAll(TOKEN)) if (!ALLOWED.has(m[1])) problems.push(`${at}  token tidak dikenal: ${m[0]}`);
  });
}
if (problems.length > 0) {
  console.error(`check-type-tokens: ${problems.length} temuan (pakai text-m26/22/18/15/15r/13/12/11)`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log('check-type-tokens: bersih.');
