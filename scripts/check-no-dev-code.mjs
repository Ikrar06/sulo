#!/usr/bin/env node
// Fails when a build that is not a development build contains dev-only code:
// the fixture recorder, the reminder simulator or the session probe
// (lib/dev/). Runs after `pnpm build` and `pnpm zip:tester`. With
// --production it also fails on the request log, which only dev and tester
// builds keep (lib/net/request-log.ts).
//
// Usage: node scripts/check-no-dev-code.mjs .output/chrome-mv3 [--production]

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MARKERS = ['connection/test', 'runConnectionTest', 'dev/record', 'dev/notify/simulate', 'dev/notify/reset', 'dev/radar/inject', 'dev/session/probe', 'recordFixtures', 'installDevTools', 'sulo-dev-diagnostics', 'Diagnostics (dev build only)'];
const PRODUCTION_MARKERS = ['global:requestLog', 'createRequestLogger'];
const args = process.argv.slice(2);
const production = args.includes('--production');
const root = args.find((a) => !a.startsWith('--'));
const markers = production ? [...MARKERS, ...PRODUCTION_MARKERS] : MARKERS;
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
  return markers.filter((m) => text.includes(m)).map((m) => `${file}: ${m}`);
});
if (hits.length > 0) {
  console.error(`check-no-dev-code: kode khusus dev ikut ke build ini:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`Bersih dari kode dev${production ? ' dan log request' : ''}: ${files.length} berkas diperiksa di ${root}.`);
