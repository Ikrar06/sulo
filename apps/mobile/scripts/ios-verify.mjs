#!/usr/bin/env node
// Checks an unsigned Sulo .ipa before it goes anywhere (pnpm ios:ipa, and the release workflow
// from Fase 5). Fails when:
// - the version or the app id is not apps/mobile/package.json's (CFBundleVersion follows the
//   Android versionCode rule), or the minimum iOS is not 16.4;
// - it carries a signature, a provisioning profile or entitlements (the release is unsigned:
//   Sideloadly signs it with the user's own Apple ID; a local profile would also carry a name);
// - the web view would load from a development server: server.url or cleartext in
//   capacitor.config.json, or a dev-server address or Vite's client anywhere in the bundle
//   (live reload exists only through pnpm ios:live, owner's rule 26 Nov 2026);
// - a host outside Sulo's list appears in the web files (scripts/check-hosts.mjs).
// Prints the size and the SHA-256 for the release page.
// Usage: node scripts/ios-verify.mjs <file.ipa> [--sintetis]
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MIN_IOS } from './ios-project.mjs';
import { versionCode } from './version-code.mjs';

const MOBILE = new URL('..', import.meta.url).pathname;
const VERSION = JSON.parse(readFileSync(join(MOBILE, 'package.json'), 'utf8')).version;
const file = process.argv[2];
const synthetic = process.argv.includes('--sintetis');
const problems = [];
const check = (ok, msg) => ok || problems.push(msg);

if (!file || !existsSync(file)) {
  console.error('Pakai: node scripts/ios-verify.mjs <berkas.ipa>');
  process.exit(1);
}

/** Every file under dir, relative. */
function walk(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p, base) : [p.slice(base.length + 1)];
  });
}

// Addresses that only exist on a development machine, and Vite's dev client.
export const DEV_SERVER = [/\blocalhost:\d+/, /\b127\.0\.0\.1:\d+/, /\b0\.0\.0\.0:\d+/, /https?:\/\/192\.168\.\d+\.\d+/, /https?:\/\/10\.\d+\.\d+\.\d+/, /https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/, /\/@vite\/client/, /@react-refresh/, /\.local:\d+/];

const work = mkdtempSync(join(tmpdir(), 'sulo-verify-'));
try {
  execFileSync('unzip', ['-q', file, '-d', work]);
  const app = join(work, 'Payload', 'App.app');
  check(existsSync(app), 'Payload/App.app tidak ada');
  const info = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', join(app, 'Info.plist')], { encoding: 'utf8' }));
  check(info.CFBundleIdentifier === 'dev.ikrar.sulo', `CFBundleIdentifier ${info.CFBundleIdentifier}`);
  check(info.CFBundleShortVersionString === VERSION, `CFBundleShortVersionString ${info.CFBundleShortVersionString}, harus ${VERSION}`);
  check(info.CFBundleVersion === String(versionCode(VERSION)), `CFBundleVersion ${info.CFBundleVersion}, harus ${versionCode(VERSION)}`);
  check(info.MinimumOSVersion === MIN_IOS, `MinimumOSVersion ${info.MinimumOSVersion}, harus ${MIN_IOS}`);
  check(!existsSync(join(app, 'embedded.mobileprovision')), 'ada embedded.mobileprovision (profil penanda tangan, bisa memuat nama)');
  check(!existsSync(join(app, '_CodeSignature')), 'ada _CodeSignature (rilis harus tanpa tanda tangan)');
  check(!existsSync(join(app, 'archived-expanded-entitlements.xcent')), 'ada berkas entitlements');

  const config = JSON.parse(readFileSync(join(app, 'capacitor.config.json'), 'utf8'));
  check(!config.server?.url, `capacitor.config.json memuat server.url (${config.server?.url})`);
  check(!config.server?.cleartext, 'capacitor.config.json memuat server.cleartext');
  check(config.loggingBehavior === 'none', 'loggingBehavior harus none');

  const files = walk(app);
  for (const rel of files) {
    if (!/\.(html|js|mjs|css|json|map|plist|txt)$/.test(rel)) continue;
    const text = readFileSync(join(app, rel), 'utf8');
    for (const re of DEV_SERVER) if (re.test(text)) problems.push(`${rel}: alamat server pengembangan (${re})`);
  }
  check(!files.some((f) => f.endsWith('.map')), 'ada source map di bundel');
  try {
    execFileSync('node', ['scripts/check-hosts.mjs', join(app, 'public'), ...(synthetic ? ['--sintetis'] : [])], { cwd: MOBILE, stdio: 'pipe' });
  } catch (e) {
    problems.push(`check-hosts: ${String(e.stdout ?? e.message).trim().split('\n').slice(-3).join(' ')}`);
  }
  // The release (sulo-<version>-ios.ipa, no suffix): the Fase 1 probe is compiled out (SULO_PROBE off), so the app's
  // binary holds none of its marks. Test builds (-sintetis, -debug) keep it for the owner's 7-day test.
  if (/-ios\.ipa$/.test(file)) {
    const binary = readFileSync(join(app, 'App'));
    for (const mark of ['dev.ikrar.sulo.probe', 'sulo.probe.', 'SuloProbePlugin']) check(!binary.includes(Buffer.from(mark)), `uji Fase 1 (${mark}) masih ada di build rilis`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

const bytes = readFileSync(file);
const sha = createHash('sha256').update(bytes).digest('hex');
if (problems.length > 0) {
  console.error(`ios-verify: ${file} GAGAL\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`ios-verify: lolos ${synthetic ? '(data sintetis) ' : ''}${file}`);
console.log(`ukuran ${(statSync(file).size / 1_048_576).toFixed(1)} MB, SHA-256 ${sha}`);
