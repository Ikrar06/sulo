// Shared by the mobile scripts: where the Android tools are, without Android Studio.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export const MOBILE = new URL('..', import.meta.url).pathname;
export const ROOT = new URL('../../..', import.meta.url).pathname;
export const ANDROID = join(MOBILE, 'android');
export const VERSION = JSON.parse(readFileSync(join(MOBILE, 'package.json'), 'utf8')).version;
export const DEBUG_APK = join(ROOT, '.output', `sulo-${VERSION}-android-debug.apk`);
export const NEEDED = { platform: 'platforms;android-36', buildTools: 'build-tools;36.0.0', java: 21 };

/** ANDROID_HOME, else ANDROID_SDK_ROOT, else Homebrew's location, when it exists. */
export function sdkRoot() {
  const candidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, '/opt/homebrew/share/android-commandlinetools', join(homedir(), 'Library/Android/sdk')];
  return candidates.find((p) => p && existsSync(p)) ?? null;
}

/** A JDK 21 home: JAVA_HOME when it is 21, else macOS's java_home -v 21, else Homebrew's openjdk@21. */
export function java21() {
  const versionOf = (home) => {
    if (!home || !existsSync(join(home, 'bin/java'))) return null;
    // java -version writes to stderr.
    const m = /version "(\d+)/.exec(spawnSync(join(home, 'bin/java'), ['-version'], { encoding: 'utf8' }).stderr ?? '');
    return m ? Number(m[1]) : null;
  };
  const fromMac = spawnSync('/usr/libexec/java_home', ['-v', String(NEEDED.java)], { encoding: 'utf8' });
  const tries = [process.env.JAVA_HOME, fromMac.status === 0 ? fromMac.stdout.trim() : null, '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home'];
  return tries.find((h) => versionOf(h) === NEEDED.java) ?? null;
}

export function tool(sdk, ...parts) {
  const p = join(sdk, ...parts);
  return existsSync(p) ? p : null;
}

export function installed(sdk, dir) {
  return sdk !== null && existsSync(join(sdk, dir)) ? readdirSync(join(sdk, dir)) : [];
}

/** Environment for Gradle and adb. */
export function androidEnv() {
  const sdk = sdkRoot();
  const java = java21();
  return { ...process.env, ...(sdk ? { ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk } : {}), ...(java ? { JAVA_HOME: java } : {}) };
}

export function adbPath() {
  const sdk = sdkRoot();
  return (sdk && tool(sdk, 'platform-tools', 'adb')) ?? 'adb';
}
