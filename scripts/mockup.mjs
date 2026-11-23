#!/usr/bin/env node
// pnpm shots:mockup [--out <dir>]: the screens that go into device mockups
// and the README, as plain PNGs (no device frame, no status bar), from synthetic
// data with livelier task titles (scripts/lib/mockup-data.mjs). Light and
// dark, Indonesian and English. Built on the audit screenshots' ground:
// production builds, fixed clock, no network. The images are never
// committed; the default folder is docs/mockup, which git ignores.
//
//   <out>/iphone/<tema>/<bahasa>/<layar>.png        402x874 at scale 3 (1206x2622), laid out with the
//                                                   phone's safe areas (62 pt top, 34 pt bottom)
//   <out>/mobile-bebas/<tema>/<bahasa>/<layar>.png  the same screens without safe areas
//   <out>/macbook-14/<tema>/<bahasa>/...            1512x982 at scale 2 (3024x1964): halaman-<layar>.png (the
//   <out>/macbook-16/<tema>/<bahasa>/...            page alone) and jendela-<layar>.png (in a drawn browser
//                                                   window); 16 inch is 1728x1117 (3456x2234)
//   <out>/popup/<tema>/<bahasa>/popup.png           380x600 at scale 2 (760x1200)
//
// Other flags go to both halves: --no-build, --themes=light,dark, --langs=id,en.
// --app=ekstensi|mobile runs one half.
import { spawnSync } from 'node:child_process';
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
const out = resolve(process.env.INIT_CWD ?? process.cwd(), take('out') ?? join(root, 'docs/mockup'));
const app = take('app');
const run = (cwd, script) => spawnSync('node', [script, `--out=${out}`, ...argv], { cwd: join(root, cwd), stdio: 'inherit', env: { ...process.env, INIT_CWD: root } }).status ?? 1;

let status = 0;
if (app !== 'mobile') status |= run('apps/extension', 'scripts/mockup-shots.mjs');
if (app !== 'ekstensi') status |= run('apps/mobile', 'scripts/mockup-shots.mjs');
process.exit(status);
