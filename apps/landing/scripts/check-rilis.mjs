#!/usr/bin/env node
// CI check of src/data/rilis.json (brief 9.2). A file that is out is described
// exactly: its address a versioned GitHub Release download of this repository,
// its version the same as the tag in that address, its SHA-256 64 hex
// characters, its size above zero, the APK's certificate fingerprint 32
// bytes. A file not out yet is described as nothing (the button then says
// "Segera tersedia" and is no link at all). Stores: belum, menunggu or terbit,
// with a store address once out. The iPhone's .ipa (1.1.0) is described the same
// way, plus the oldest iOS it runs on.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const AWALAN = 'https://github.com/Ikrar06/sulo/releases/download/';

export function periksaRilis(r) {
  const masalah = [];
  const salah = (pesan) => masalah.push(pesan);
  for (const jenis of ['android', 'ekstensi', 'iphone']) {
    const b = r?.[jenis];
    if (!b || typeof b.tersedia !== 'boolean') {
      salah(`${jenis}.tersedia harus true atau false`);
      continue;
    }
    if (!b.tersedia) {
      if (b.url || b.sha256 || b.ukuranByte) salah(`${jenis}: belum tersedia, jadi url, sha256 dan ukuranByte harus kosong`);
      continue;
    }
    if (!/^\d+\.\d+\.\d+$/.test(b.versi ?? '')) salah(`${jenis}.versi harus seperti 1.0.0`);
    if (typeof b.url !== 'string' || !b.url.startsWith(AWALAN)) salah(`${jenis}.url harus diawali ${AWALAN}`);
    else {
      const tag = b.url.slice(AWALAN.length).split('/')[0];
      if (tag !== `v${b.versi}`) salah(`${jenis}: tag di alamat (${tag}) tidak sama dengan versi v${b.versi}`);
    }
    if (!/^[0-9a-f]{64}$/.test(b.sha256 ?? '')) salah(`${jenis}.sha256 harus 64 karakter heksa kecil`);
    if (!(Number.isInteger(b.ukuranByte) && b.ukuranByte > 0)) salah(`${jenis}.ukuranByte harus bilangan bulat di atas 0`);
    if (jenis === 'android' && !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(b.sidikSertifikat ?? '')) salah('android.sidikSertifikat harus sidik jari SHA-256 (32 byte, AA:BB:...)');
    if (jenis === 'iphone' && !String(b.url).endsWith('.ipa')) salah('iphone.url harus berkas .ipa');
  }
  for (const toko of ['chrome', 'edge']) {
    const t = r?.toko?.[toko];
    if (!t || !['belum', 'menunggu', 'terbit'].includes(t.status)) salah(`toko.${toko}.status harus belum, menunggu, atau terbit`);
    else if (t.status === 'terbit' && !/^https:\/\/\S+$/.test(t.url ?? '')) salah(`toko.${toko}.url harus alamat https saat status terbit`);
  }
  if (!/^\d+\.\d+$/.test(r?.iphone?.iosMin ?? '')) salah('iphone.iosMin harus seperti 16.4');
  if (r?.minatIos !== undefined) salah('minatIos sudah dihapus (keputusan B8): hapus dari rilis.json');
  return masalah;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = resolve(new URL('../src/data/rilis.json', import.meta.url).pathname);
  const masalah = periksaRilis(JSON.parse(readFileSync(path, 'utf8')));
  if (masalah.length) {
    console.error(`check:rilis: ${masalah.length} masalah di ${path}\n- ${masalah.join('\n- ')}`);
    process.exit(1);
  }
  console.log('check:rilis: rilis.json sesuai aturan.');
}
