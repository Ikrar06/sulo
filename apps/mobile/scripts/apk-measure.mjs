#!/usr/bin/env node
// The measuring APK, built locally: the web build with its synthetic
// fixtures and stand-in session packed into a debug APK (the same recipe as
// CI's Perf Android job). It never reaches SIKOLA or NEOSIA and shows the
// demo account only, so it is the build for looking at the app on an
// emulator without signing in. Never a release: it carries the web fakes,
// which scripts/check-no-dev-code.mjs refuses in a release bundle.
// The APK lands in .output/ at the repository root, next to the debug APK.
// Usage: node scripts/apk-measure.mjs [--out=<file.apk>]
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ANDROID, MOBILE, ROOT, VERSION, androidEnv, java21, sdkRoot } from './env.mjs';

if (!java21() || !sdkRoot()) {
  console.error('JDK 21 atau Android SDK belum ada. Jalankan pnpm mobile:doctor.');
  process.exit(1);
}
const outArg = process.argv.find((a) => a.startsWith('--out='))?.slice(6);
const out = outArg ? resolve(process.env.INIT_CWD ?? process.cwd(), outArg) : join(ROOT, '.output', `sulo-${VERSION}-android-pengukur.apk`);
const env = androidEnv();
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, env, stdio: 'inherit' });
run('pnpm', ['exec', 'vite', 'build', '--mode', 'web'], MOBILE);
run('pnpm', ['exec', 'cap', 'sync', 'android'], MOBILE);
run(join(ANDROID, 'gradlew'), ['--no-daemon', 'assembleDebug'], ANDROID);
mkdirSync(dirname(out), { recursive: true });
copyFileSync(join(ANDROID, 'app/build/outputs/apk/debug/app-debug.apk'), out);
console.log(`APK pengukur (data sintetis, bukan untuk dirilis): ${out}`);
