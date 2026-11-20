#!/usr/bin/env node
// A release build of the Android app carries no debug-only code: not the
// debug screen, not its notification tests, not the web build's measuring
// hooks. Scans the built web bundle (dist/) for their marks and fails when
// one is there. Run after `vite build` in the release workflow.
// Usage: node scripts/check-no-dev-code.mjs [dist]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? new URL('../dist', import.meta.url).pathname;
const MARKS = ['[uji]', 'Uji notifikasi', 'watchSimulate', 'watchRunNow', 'Simulasikan', '__suloFitGreeting', '__suloGreetPhrases', '__suloCourseNames', '__suloEventTitles', 'Jalankan cek latar belakang', 'Config uji aktif', 'Kembali ke config resmi', 'mobile:dev:testConfig', 'Muat config uji', 'Tempo adegan', 'Putar ulang onboarding', '__suloMascot', '__suloEnterDemo', 'mobile:dev:sceneTempo', 'sulo:replay-onboarding', 'mobile:dev:perfTier', 'Paksa lite', 'Ikuti pilihan', 'sulo-perf', 'sulo:ringkasan', '__suloDevSync', '__suloDevCheck', 'sulo:dev:holdResume'];
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : /\.(js|html|css)$/.test(n) ? [join(d, n)] : []));
const found = [];
for (const file of walk(dir)) {
  const text = readFileSync(file, 'utf8');
  for (const mark of MARKS) if (text.includes(mark)) found.push(`${file.slice(dir.length + 1)}: "${mark}"`);
}
if (found.length > 0) {
  console.error(`check-no-dev-code: kode debug ikut build rilis (${found.length})`);
  for (const f of found) console.error(`  ${f}`);
  process.exit(1);
}
console.log('check-no-dev-code: bersih.');
