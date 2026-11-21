#!/usr/bin/env node
// pnpm mobile:doctor: what is ready for building the Android app without
// Android Studio, and what is missing (CONTRIBUTING.md, "Setting up", has the steps).
import { execFileSync } from 'node:child_process';
import { adbPath, installed, java21, NEEDED, sdkRoot, tool } from './env.mjs';

const rows = [];
const check = (name, ok, hint) => rows.push({ name, ok, hint });

const java = java21();
check(`JDK ${NEEDED.java}`, java !== null, 'brew install openjdk@21');
const sdk = sdkRoot();
check('Android SDK (ANDROID_HOME)', sdk !== null, 'brew install --cask android-commandlinetools, lalu set ANDROID_HOME');
check('sdkmanager', sdk !== null && (tool(sdk, 'cmdline-tools', 'latest', 'bin', 'sdkmanager') ?? tool(sdk, 'bin', 'sdkmanager')) !== null, 'brew install --cask android-commandlinetools');
check(NEEDED.platform, installed(sdk, 'platforms').includes(NEEDED.platform.split(';')[1]), `sdkmanager "${NEEDED.platform}"`);
check(NEEDED.buildTools, installed(sdk, 'build-tools').includes(NEEDED.buildTools.split(';')[1]), `sdkmanager "${NEEDED.buildTools}"`);
let adb = false;
let devices = [];
try {
  const out = execFileSync(adbPath(), ['devices'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  adb = true;
  devices = out.split('\n').slice(1).filter((l) => /\tdevice$/.test(l));
} catch {
  /* no adb */
}
check('adb (platform-tools)', adb, 'brew install --cask android-platform-tools');
check('HP terhubung (USB debugging)', devices.length > 0, 'Aktifkan USB debugging di HP, sambungkan kabel, izinkan komputer ini');

for (const r of rows) console.log(`${r.ok ? 'ada  ' : 'KURANG'}  ${r.name}${r.ok ? '' : `\n         ${r.hint}`}`);
const missing = rows.filter((r) => !r.ok && !r.name.startsWith('HP'));
console.log(missing.length === 0 ? '\nSiap membangun APK.' : `\n${missing.length} hal kurang untuk membangun APK. Lihat CONTRIBUTING.md (bagian Setting up).`);
process.exitCode = missing.length === 0 ? 0 : 1;
