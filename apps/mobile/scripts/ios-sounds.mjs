#!/usr/bin/env node
// The notification sounds for iOS, from the ones the Android app ships (already trimmed and evened out by
// scripts/build-sounds.mjs): iOS plays only aiff, wav or caf for a notification, never MP3 or Ogg
// (UNNotificationSound). Each becomes ios/App/App/Sounds/sulo_notif_<n>.caf (IMA4, mono), through macOS's
// own afconvert: nothing to install. Run after build-sounds.mjs changes a sound; the files are committed.
//   node scripts/ios-sounds.mjs [--check]
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MOBILE = new URL('..', import.meta.url).pathname;
const RAW = join(MOBILE, 'android/app/src/main/res/raw');
const OUT = join(MOBILE, 'ios/App/App/Sounds');
/** UNNotificationSound plays the default sound instead of anything 30 seconds or longer. */
const MAX_SECONDS = 30;
const check = process.argv.includes('--check');

if (process.platform !== 'darwin') {
  console.error('ios-sounds: afconvert ada di macOS saja.');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const sources = readdirSync(RAW).filter((f) => /^sulo_notif_\d+\.(mp3|ogg|wav)$/.test(f)).sort();
let failed = false;
for (const src of sources) {
  const name = src.replace(/\.[a-z0-9]+$/, '.caf');
  const target = join(OUT, name);
  if (!check) {
    const r = spawnSync('afconvert', ['-f', 'caff', '-d', 'ima4', '-c', '1', join(RAW, src), target], { encoding: 'utf8' });
    if (r.status !== 0) {
      console.error(`ios-sounds: ${src} gagal: ${r.stderr.trim()}`);
      failed = true;
      continue;
    }
  }
  if (!existsSync(target)) {
    console.error(`ios-sounds: ${name} belum ada`);
    failed = true;
    continue;
  }
  const info = spawnSync('afinfo', [target], { encoding: 'utf8' }).stdout;
  const seconds = Number(/estimated duration: ([\d.]+)/.exec(info)?.[1] ?? 'NaN');
  const ok = Number.isFinite(seconds) && seconds < MAX_SECONDS && /ima4/i.test(info);
  if (!ok) failed = true;
  console.log(`${name}: ${seconds.toFixed(2)} s, ${(statSync(target).size / 1024).toFixed(1)} KB${ok ? '' : ' (TIDAK SESUAI)'}`);
}
process.exit(failed || sources.length === 0 ? 1 : 0);
