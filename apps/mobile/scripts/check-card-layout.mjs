#!/usr/bin/env node
// The Android app shows content in cards (M8c.1): no list that runs from
// edge to edge with dividers, and no dropdown. Fails on, in src/ and
// packages/ui/src/mobile:
// - `divide-y` or `border-y` anywhere (rows inside a card use a hairline on
//   every row but the last: [&:not(:last-child)]:border-b);
// - a negative side margin (-mx-*) together with a row border in one class
//   list: a list pulled to the screen's edges;
// - the Select component or a native <select> (choices open a bottom sheet).
// Usage: node scripts/check-card-layout.mjs [file...] (files for its own test).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = new URL('../src', import.meta.url).pathname;
const SHARED = new URL('../../../packages/ui/src/mobile', import.meta.url).pathname;
const RULES = [
  [/(?<![\w-])(divide-y|border-y)(?![\w-])/, 'daftar bergaris pemisah selebar layar'],
  [/(?<![\w:-])-mx-\d+\b[^"'`]*(?<![\w-])border-b(?![\w-])|(?<![\w-])border-b(?![\w-])[^"'`]*(?<![\w:-])-mx-\d+\b/, 'baris berbatas yang ditarik ke tepi layar'],
  [/from\s+['"][^'"]*\/ui\/select['"]|<Select[\s>]|<select[\s>]/, 'dropdown (pakai bottom sheet)'],
];

const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : /\.tsx?$/.test(n) ? [join(dir, n)] : []));
const files = process.argv.length > 2 ? process.argv.slice(2) : [...walk(SRC), ...walk(SHARED)];
const problems = [];
for (const file of files) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (line.includes('lint-ui-allow')) return;
    for (const [re, what] of RULES) if (re.test(line)) problems.push(`${relative(SRC, file).replace(/^(\.\.\/)+/, '')}:${i + 1}  ${what}: ${line.trim().slice(0, 120)}`);
  });
}
if (problems.length > 0) {
  console.error(`check-card-layout: ${problems.length} temuan`);
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log('check-card-layout: bersih.');
