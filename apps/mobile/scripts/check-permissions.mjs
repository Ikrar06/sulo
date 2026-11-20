#!/usr/bin/env node
// The release APK asks for exactly the permissions Sulo explains (M8e E2,
// docs/rilis/justifikasi-izin.md "daftar izin final"): one more, or one
// missing, fails the release. Read from the built APK, not the manifest
// source, so permissions merged in from libraries count too.
// Usage: node scripts/check-permissions.mjs <apk> [--aapt=path]
import { execFileSync } from 'node:child_process';

export const PERMISSIONS = {
  'android.permission.INTERNET': 'reading SIKOLA and Sulo\'s public data repository',
  'android.permission.ACCESS_NETWORK_STATE': 'watching waits for a connection (WorkManager)',
  'android.permission.USE_BIOMETRIC': 'the optional app lock',
  'android.permission.POST_NOTIFICATIONS': 'reminders and new updates',
  'android.permission.RECEIVE_BOOT_COMPLETED': 'reminders and checks rescheduled after a restart (WorkManager, local-notifications)',
  'android.permission.WAKE_LOCK': "WorkManager's own, while one job runs",
  'dev.ikrar.sulo.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION': "AndroidX's internal permission for unexported receivers",
};

const apk = process.argv[2];
if (!apk) {
  console.error('Pakai: node scripts/check-permissions.mjs <apk> [--aapt=path]');
  process.exit(2);
}
const aapt = process.argv.find((a) => a.startsWith('--aapt='))?.slice(7) ?? 'aapt';
const got = [...execFileSync(aapt, ['dump', 'badging', apk], { encoding: 'utf8' }).matchAll(/uses-permission: name='([^']+)'/g)].map((m) => m[1]);
const extra = got.filter((p) => !(p in PERMISSIONS));
const missing = Object.keys(PERMISSIONS).filter((p) => !got.includes(p));
if (extra.length || missing.length) {
  if (extra.length) console.error(`check-permissions: izin yang tidak dijelaskan: ${extra.join(', ')}`);
  if (missing.length) console.error(`check-permissions: izin di daftar tetapi tidak ada di APK (perbarui daftar dan justifikasi): ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`check-permissions: cocok (${got.length} izin, semuanya dijelaskan).`);
