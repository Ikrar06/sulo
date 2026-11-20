#!/usr/bin/env node
// pnpm mobile:emu        starts the AVD "sulo" (cold boot, nothing snapshotted)
// pnpm mobile:emu:stop   shuts it down cleanly so it stops using memory
// One AVD, one image (Android 14, Google APIs, arm64). Setup: docs/MOBILE-SETUP.md.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { adbPath, sdkRoot } from './env.mjs';

const AVD = 'sulo';
const adb = (...args) => execFileSync(adbPath(), args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const emulators = () => adb('devices').split('\n').filter((l) => /^emulator-\d+\s+device/.test(l)).map((l) => l.split(/\s+/)[0]);

if (process.argv.includes('--stop')) {
  const running = emulators();
  if (running.length === 0) {
    console.log('Emulator tidak berjalan.');
    process.exit(0);
  }
  for (const s of running) adb('-s', s, 'emu', 'kill');
  console.log(`Emulator dimatikan (${running.join(', ')}).`);
  process.exit(0);
}

const sdk = sdkRoot();
const bin = sdk && join(sdk, 'emulator', 'emulator');
if (!bin || !existsSync(bin)) {
  console.error('Emulator belum terpasang. Lihat docs/MOBILE-SETUP.md (bagian Emulator).');
  process.exit(1);
}
if (emulators().length > 0) {
  console.log(`Emulator sudah berjalan (${emulators().join(', ')}).`);
  process.exit(0);
}
// -no-snapshot: always a cold boot, no snapshot file that grows on disk. Its log goes to the scratch of the OS, not the repo.
const log = openSync(join(process.env.TMPDIR ?? '/tmp', 'sulo-emulator.log'), 'a');
spawn(bin, ['-avd', AVD, '-partition-size', '2048', '-no-snapshot', '-no-boot-anim', '-netdelay', 'none', '-netspeed', 'full'], { detached: true, stdio: ['ignore', log, log], env: { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk } }).unref();
console.log('Menyalakan emulator "sulo" (boot dingin, sekitar 1 menit)...');
const until = Date.now() + 240_000;
while (Date.now() < until) {
  const s = emulators()[0];
  if (s) {
    try {
      if (adb('-s', s, 'shell', 'getprop', 'sys.boot_completed').trim() === '1') {
        const wv = adb('-s', s, 'shell', 'dumpsys', 'webviewupdate').match(/Current WebView package \(name, version\): \(([^,]+), ([^)]+)\)/);
        console.log(`Siap: ${s}. WebView ${wv ? `${wv[1]} ${wv[2]}` : 'tidak terbaca'}. Matikan dengan pnpm mobile:emu:stop.`);
        process.exit(0);
      }
    } catch {
      // Still booting.
    }
  }
  execFileSync('sleep', ['3']);
}
console.error('Emulator belum siap setelah 4 menit. Lihat log di $TMPDIR/sulo-emulator.log.');
process.exit(1);
