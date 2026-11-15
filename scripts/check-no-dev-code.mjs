#!/usr/bin/env node
// Fails when a build that is not a development build contains dev-only code:
// the fixture recorder or the reminder simulator (lib/dev/). Runs after
// `pnpm build` and `pnpm zip:tester`.
//
// Usage: node scripts/check-no-dev-code.mjs .output/chrome-mv3

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MARKERS = ['dev/record', 'dev/notify/simulate', 'dev/notify/reset', 'recordFixtures', 'installDevTools'];
const root = process.argv[2];
if (!root) {
  console.error('check-no-dev-code: beri folder hasil build, misalnya .output/chrome-mv3');
  process.exit(2);
}

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(js|html|json)$/.test(name)) files.push(path);
  }
};
walk(root);

const hits = files.flatMap((file) => {
  const text = readFileSync(file, 'utf8');
  return MARKERS.filter((m) => text.includes(m)).map((m) => `${file}: ${m}`);
});
if (hits.length > 0) {
  console.error(`check-no-dev-code: kode khusus dev ikut ke build ini:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`Bersih dari kode dev: ${files.length} berkas diperiksa di ${root}.`);
