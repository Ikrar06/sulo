#!/usr/bin/env node
// pnpm mobile:install: installs the debug APK on the phone connected over USB.
// First it says which build it is (the commit inside the APK and its SHA-256)
// and warns when that build is older than HEAD of the current branch, or
// from another branch, or from a changed tree.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { DEBUG_APK, adbPath } from './env.mjs';
import { against, apkInfo, git, sha256 } from './apk-info.mjs';

if (!existsSync(DEBUG_APK)) {
  console.error(`Belum ada ${DEBUG_APK}. Jalankan pnpm mobile:fetch-apk (dari CI) atau pnpm mobile:apk:debug dulu.`);
  process.exit(1);
}
const info = apkInfo(DEBUG_APK);
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
console.log(`APK     : ${DEBUG_APK}`);
console.log(`SHA-256 : ${sha256(DEBUG_APK)}`);
console.log(`Commit  : ${info ? `${info.commit.slice(0, 7)}${info.dirty ? ' (dari tree yang berubah)' : ''}, mode ${info.mode}` : 'tidak tercatat (APK dibuat sebelum info build ada)'}`);
const pos = against(info?.commit);
const head = pos.head.slice(0, 7);
if (!info) console.warn(`PERINGATAN: commit APK tidak diketahui; HEAD ${branch} adalah ${head}. Jalankan pnpm mobile:fetch-apk untuk APK HEAD.`);
else if (pos.relation === 'older') console.warn(`PERINGATAN: APK ini ${pos.behind} commit lebih tua dari HEAD ${branch} (${head}). Jalankan pnpm mobile:fetch-apk untuk APK HEAD.`);
else if (pos.relation === 'elsewhere') console.warn(`PERINGATAN: commit APK tidak ada di branch ${branch} (HEAD ${head}).`);
else if (pos.relation === 'unknown') console.warn(`PERINGATAN: commit APK tidak ditemukan di repo ini (HEAD ${head}).`);
else if (info.dirty) console.warn('PERINGATAN: APK dibuat dari tree yang berubah, bukan dari commit yang bersih.');
else console.log(`Sama dengan HEAD ${branch} (${head}).`);
// adb waits while the phone asks (Play Protect, or Samsung's install over USB): say where to look.
console.log('Memasang. Kalau berhenti di "Performing Streamed Install", lihat layar HP: jawab dialog Play Protect atau konfirmasi pemasangan lewat USB.');
try {
  const out = execFileSync(adbPath(), ['install', '-r', DEBUG_APK], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.write(out);
} catch (e) {
  const text = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  process.stderr.write(text);
  if (/INSTALL_FAILED_UPDATE_INCOMPATIBLE/.test(text)) {
    console.error('\nSulo di HP ditandatangani dengan kunci debug lain (build lama atau dari laptop lain).');
    console.error('Hapus dulu, lalu pasang lagi. Data Sulo di HP ikut terhapus (sesi SIKOLA, pengaturan):');
    console.error(`  ${adbPath()} uninstall dev.ikrar.sulo && pnpm mobile:install`);
  }
  process.exit(1);
}
