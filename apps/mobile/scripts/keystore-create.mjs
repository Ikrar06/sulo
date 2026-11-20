#!/usr/bin/env node
// pnpm mobile:keystore:buat — the owner runs this in their own terminal, once.
// Creates Sulo's release keystore with keytool, outside the repository, and
// shows only the certificate's SHA-256 fingerprint, which it also writes to
// apps/mobile/release-cert.json (a public constant the release workflow
// checks every signed APK against).
//
// The password is typed hidden, kept in this process's memory only and
// handed to keytool through an environment variable (keytool's
// -storepass:env), so it never appears in arguments, the shell history,
// a log or a file. Nothing here prints it. Steps: docs/rilis/keystore.md.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { java21 } from './env.mjs';

const REPO = resolve(new URL('../../..', import.meta.url).pathname);
const CERT_FILE = join(REPO, 'apps/mobile/release-cert.json');
const DEFAULT_PATH = join(homedir(), 'sulo-rilis', 'sulo-release.p12');
const ALIAS = 'sulo';
// 30 years: an Android app must keep one signing key for its whole life.
const VALIDITY_DAYS = 30 * 365;
const MIN_PASSWORD = 12;
// Only the product, no person: the certificate is public inside every APK.
const DNAME = 'CN=Sulo, O=Sulo, C=ID';

const fail = (msg) => {
  console.error(`\n${msg}`);
  process.exit(1);
};

if (!process.stdin.isTTY || !process.stdout.isTTY) fail('Jalankan skrip ini sendiri di terminal (butuh ketikan tersembunyi).');
const jdk = java21();
if (!jdk) fail('JDK 21 belum ada. Jalankan pnpm mobile:doctor.');
const keytool = join(jdk, 'bin', 'keytool');

/** A visible answer (the path). */
function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((done) => rl.question(question, (a) => (rl.close(), done(a.trim()))));
}

/** A hidden answer: raw mode, nothing echoed, only a dot per character. */
function askHidden(question) {
  return new Promise((done, reject) => {
    const stdin = process.stdin;
    let value = '';
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          return done(value);
        }
        if (ch === '\u0003') {
          stdin.setRawMode(false);
          process.stdout.write('\n');
          return reject(new Error('dibatalkan'));
        }
        if (ch === '\u007f' || ch === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        value += ch;
        process.stdout.write('•');
      }
    };
    stdin.on('data', onData);
  });
}

/** The path may not be inside the repository (or any git work tree under it). */
function insideRepo(path) {
  const real = existsSync(dirname(path)) ? realpathSync(dirname(path)) : resolve(dirname(path));
  return real === REPO || real.startsWith(REPO + sep);
}

console.log('Kunci rilis Sulo (sekali seumur aplikasi). Bacaan: docs/rilis/keystore.md\n');
const typed = await ask(`Simpan di mana? [${DEFAULT_PATH}] `);
const path = resolve(typed === '' ? DEFAULT_PATH : typed.replace(/^~(?=$|\/)/, homedir()));
if (insideRepo(path)) fail('Tolak: berkas kunci tidak boleh berada di dalam repo.');
if (existsSync(path)) fail(`Tolak: ${path} sudah ada. Skrip ini tidak pernah menimpa kunci.`);

let password;
try {
  password = await askHidden(`Kata sandi (minimal ${MIN_PASSWORD} karakter, tidak tampil): `);
  if (password.length < MIN_PASSWORD) fail(`Terlalu pendek: minimal ${MIN_PASSWORD} karakter.`);
  const again = await askHidden('Ulangi kata sandi: ');
  if (again !== password) fail('Kedua kata sandi tidak sama. Tidak ada yang dibuat.');
} catch {
  fail('Dibatalkan. Tidak ada yang dibuat.');
}

mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
// PKCS12: one password for the store and the key (Android's default type).
const env = { ...process.env, SULO_KS_PASS: password };
try {
  execFileSync(keytool, ['-genkeypair', '-v', '-storetype', 'PKCS12', '-keystore', path, '-alias', ALIAS, '-keyalg', 'RSA', '-keysize', '4096', '-validity', String(VALIDITY_DAYS), '-dname', DNAME, '-storepass:env', 'SULO_KS_PASS', '-keypass:env', 'SULO_KS_PASS'], { env, stdio: ['ignore', 'ignore', 'pipe'] });
} catch (e) {
  fail(`keytool gagal membuat kunci (${String(e.stderr ?? '').split('\n')[0] || 'tanpa keterangan'}).`);
}
chmodSync(path, 0o600);

// Only the SHA-256 line of the certificate listing is read; the rest is discarded.
const listing = execFileSync(keytool, ['-list', '-v', '-keystore', path, '-alias', ALIAS, '-storepass:env', 'SULO_KS_PASS'], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
password = '';
const sha256 = listing.match(/SHA256:\s*([0-9A-F:]{95})/)?.[1];
if (!sha256) fail('Kunci dibuat, tetapi sidik jarinya tidak terbaca. Jalankan docs/rilis/keystore.md langkah 4.');

writeFileSync(CERT_FILE, `${JSON.stringify({ alias: ALIAS, sha256, note: 'Public: the release certificate fingerprint. Every signed release APK must carry exactly this certificate (android-release.yml).' }, null, 2)}\n`);

console.log(`
Selesai.
  Berkas kunci : ${path} (hanya bisa dibaca akunmu)
  Alias        : ${ALIAS}
  SHA-256      : ${sha256}

Sidik jari ditulis ke apps/mobile/release-cert.json (publik, boleh di-commit).
Berikutnya, di docs/rilis/keystore.md: cadangkan berkas ini di dua tempat
terpisah, lalu masukkan rahasianya ke GitHub dengan gh secret set.`);
