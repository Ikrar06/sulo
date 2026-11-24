#!/usr/bin/env node
// Fills src/data/rilis.json for a release (brief 9.2), from the release files
// on this computer: size, SHA-256, the APK's signing certificate, and the
// versioned GitHub Release address each button downloads from. Run by the
// owner at release time; it only reads the files it is given and writes
// rilis.json. The store states and the iPhone counter's switch are kept.
//
//   pnpm landing:rilis v1.0.0 --apk <path to the APK> --zip <path to the extension zip> [--sertifikat <SHA-256 fingerprint>]
//
// The certificate comes from `keytool -printcert -jarfile` when keytool is
// installed (with Android Studio or a JDK); otherwise pass --sertifikat.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const RILIS = resolve(new URL('../src/data/rilis.json', import.meta.url).pathname);
const REPO = 'https://github.com/Ikrar06/sulo';
const args = process.argv.slice(2);
const tag = args.find((a) => !a.startsWith('--'));
const opsi = (nama) => {
  const i = args.indexOf(`--${nama}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function gagal(pesan) {
  console.error(`landing:rilis: ${pesan}`);
  process.exit(1);
}

if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) gagal('tulis tag rilisnya, misalnya: pnpm landing:rilis v1.0.0 --apk ... --zip ...');
const versi = tag.slice(1);
const apk = opsi('apk');
const zip = opsi('zip');
if (!apk || !zip) gagal('perlu --apk dan --zip (berkas yang akan diunggah ke GitHub Release).');

function berkas(path, saran) {
  const p = resolve(path);
  const nama = basename(p);
  if (nama !== saran) console.warn(`landing:rilis: nama berkas ${nama}, usulan ${saran} (docs/landing/PENILAIAN.md bagian 8). Alamat unduh memakai nama yang ada.`);
  return {
    tersedia: true,
    versi,
    url: `${REPO}/releases/download/${tag}/${encodeURIComponent(nama)}`,
    ukuranByte: statSync(p).size,
    sha256: createHash('sha256').update(readFileSync(p)).digest('hex'),
  };
}

function sertifikat(path) {
  const diberi = opsi('sertifikat');
  if (diberi) return diberi.toUpperCase();
  try {
    const keluaran = execFileSync('keytool', ['-printcert', '-jarfile', resolve(path)], { encoding: 'utf8' });
    const cocok = keluaran.match(/SHA256:\s*([0-9A-F:]{95})/i);
    if (cocok) return cocok[1].toUpperCase();
  } catch {
    // No keytool here: ask for it by hand below.
  }
  return gagal('sidik jari sertifikat tidak terbaca. Pasang JDK (keytool) atau beri --sertifikat AA:BB:...');
}

const lama = JSON.parse(readFileSync(RILIS, 'utf8'));
const baru = {
  ...lama,
  android: { ...berkas(apk, `sulo-${versi}-android.apk`), sidikSertifikat: sertifikat(apk), androidMin: lama.android?.androidMin ?? '8.0' },
  ekstensi: berkas(zip, `sulo-${versi}-ekstensi.zip`),
};
writeFileSync(RILIS, `${JSON.stringify(baru, null, 2)}\n`);
console.log(`landing:rilis: ${RILIS} diisi untuk ${tag}.`);
console.log(`  APK ${baru.android.ukuranByte} byte, SHA-256 ${baru.android.sha256}`);
console.log(`  zip ${baru.ekstensi.ukuranByte} byte, SHA-256 ${baru.ekstensi.sha256}`);
console.log('Jalankan pnpm --filter @sulo/landing check:rilis, lalu build.');
