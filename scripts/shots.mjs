#!/usr/bin/env node
// pnpm shots:audit --out <dir> [--sheets <dir>]: every screen and state of
// the extension and the Android app as screenshots, for before and after
// comparisons, and (with --sheets) contact sheets of them. Synthetic demo
// data, production builds, no network (see the two scripts it runs:
// apps/extension/scripts/audit-shots.mjs, apps/mobile/scripts/audit-shots.mjs).
// The screenshots are never committed; run it into a folder git ignores.
//
//   <out>/<aplikasi>/<tema>/<bahasa>/<nn-layar>--<keadaan>.png
//   aplikasi: ekstensi-popup, ekstensi-dashboard, ekstensi-dashboard-1920,
//             ekstensi-onboarding, mobile (360x800), mobile-412 (412x915)
//   tema: terang, gelap      bahasa: id, en
//
// Other flags go to both scripts: --no-build, --themes=light,dark, --langs=id,en.
// --app=ekstensi|mobile runs one half. --sheets-only makes sheets of what is there.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const argv = process.argv.slice(2);
/** "--out dir" and "--out=dir" both. */
function take(name) {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return null;
  const [a] = argv.splice(i, 1);
  return a.includes('=') ? a.split('=').slice(1).join('=') : argv.splice(i, 1)[0] ?? null;
}
const base = process.env.INIT_CWD ?? process.cwd();
const outArg = take('out');
if (!outArg) {
  console.error('Pakai: pnpm shots:audit --out <folder> [--sheets <folder>] [--no-build] [--app=ekstensi|mobile]');
  process.exit(2);
}
const out = resolve(base, outArg);
const sheetsArg = take('sheets');
const sheets = sheetsArg ? resolve(base, sheetsArg) : null;
const app = take('app');
const sheetsOnly = argv.includes('--sheets-only');
const pass = argv.filter((a) => a !== '--sheets-only');
const run = (cwd, args) => spawnSync('node', args, { cwd: join(root, cwd), stdio: 'inherit', env: { ...process.env, INIT_CWD: root } }).status ?? 1;

let status = 0;
if (!sheetsOnly) {
  if (app !== 'mobile') status |= run('apps/extension', ['scripts/audit-shots.mjs', `--out=${out}`, ...pass]);
  if (app !== 'ekstensi') status |= run('apps/mobile', ['scripts/audit-shots.mjs', `--out=${out}`, ...pass]);
}

// Contact sheets: [folder, sheet settings]. A phone piece is one screen high; the dashboard gets
// a close set (two screen-high pieces a sheet, readable) and an overview (first screen only).
const SHEETS = [
  ['mobile', '', ['--tile=270', `--ratio=${800 / 360}`, '--cols=5', '--rows=1']],
  ['mobile-412', '', ['--tile=270', `--ratio=${915 / 412}`, '--cols=5', '--rows=1', '--first']],
  ['ekstensi-popup', '', ['--tile=270', `--ratio=${600 / 380}`, '--cols=5', '--rows=2']],
  ['ekstensi-dashboard', '', ['--tile=1040', `--ratio=${800 / 1280}`, '--cols=1', '--rows=2']],
  ['ekstensi-dashboard', 'ikhtisar-', ['--tile=460', `--ratio=${800 / 1280}`, '--cols=3', '--rows=3', '--first']],
  ['ekstensi-dashboard-1920', 'ikhtisar-', ['--tile=700', `--ratio=${1080 / 1920}`, '--cols=2', '--rows=3', '--first']],
  ['ekstensi-onboarding', '', ['--tile=700', `--ratio=${800 / 1280}`, '--cols=2', '--rows=2']],
];
if (sheets) {
  for (const [dir, prefix, settings] of SHEETS) {
    if (!existsSync(join(out, dir))) continue;
    for (const theme of readdirSync(join(out, dir)))
      for (const lang of existsSync(join(out, dir, theme)) ? readdirSync(join(out, dir, theme)) : []) {
        const input = join(out, dir, theme, lang);
        if (!readdirSync(input).some((f) => f.endsWith('.png'))) continue;
        status |= run('apps/extension', ['scripts/contact-sheets.mjs', `--in=${input}`, `--out=${join(sheets, dir)}`, `--name=${prefix}${theme}-${lang}`, ...settings]);
      }
  }
}
process.exit(status);
