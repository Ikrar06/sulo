#!/usr/bin/env node
// pnpm mobile:apk:debug: web build, Capacitor sync, Gradle assembleDebug and
// the Kotlin unit tests. The APK lands in .output/ at the repository root.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ANDROID, DEBUG_APK, MOBILE, androidEnv, java21, sdkRoot } from './env.mjs';

if (!java21() || !sdkRoot()) {
  console.error('JDK 21 atau Android SDK belum ada. Jalankan pnpm mobile:doctor.');
  process.exit(1);
}
const env = androidEnv();
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, env, stdio: 'inherit' });
run('pnpm', ['exec', 'vite', 'build', '--mode', 'debug'], MOBILE);
run('pnpm', ['exec', 'cap', 'sync', 'android'], MOBILE);
run(join(ANDROID, 'gradlew'), ['--no-daemon', 'testDebugUnitTest', 'assembleDebug'], ANDROID);
mkdirSync(dirname(DEBUG_APK), { recursive: true });
copyFileSync(join(ANDROID, 'app/build/outputs/apk/debug/app-debug.apk'), DEBUG_APK);
console.log(`APK debug: ${DEBUG_APK}`);
