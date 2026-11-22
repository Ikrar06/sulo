#!/usr/bin/env node
// The app's own native code never logs: the SIKOLA cookie and the sesskey
// pass through it, and a log line is the easiest way for them to leak
// (one of Sulo's hard rules for the phone). Fails on Log.*, println, print, printStackTrace,
// System.out/err and Timber in apps/mobile/android/app/src/main.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../android/app/src/main/java', import.meta.url).pathname;
const BANNED = /\b(Log\.(v|d|i|w|e|wtf)\s*\(|println\s*\(|print\s*\(|printStackTrace\s*\(|System\.(out|err)\b|Timber\.)/;

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(kt|java)$/.test(e.name)) out.push(full);
  }
  return out;
}

const problems = [];
for (const file of walk(ROOT)) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    if (BANNED.test(code)) problems.push(`${relative(ROOT, file)}:${i + 1}`);
  });
}
if (problems.length) {
  console.error(`check-native-logs: ${problems.length} baris memakai log di kode native. Sesi dan sesskey tidak boleh masuk log.`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log('check-native-logs: bersih.');
