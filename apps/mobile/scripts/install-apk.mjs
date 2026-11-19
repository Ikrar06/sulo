#!/usr/bin/env node
// pnpm mobile:install: installs the debug APK on the phone connected over USB.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { DEBUG_APK, adbPath } from './env.mjs';

if (!existsSync(DEBUG_APK)) {
  console.error(`Belum ada ${DEBUG_APK}. Jalankan pnpm mobile:apk:debug dulu (atau unduh dari CI).`);
  process.exit(1);
}
execFileSync(adbPath(), ['install', '-r', DEBUG_APK], { stdio: 'inherit' });
