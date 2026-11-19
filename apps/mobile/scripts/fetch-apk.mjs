#!/usr/bin/env node
// pnpm mobile:fetch-apk [commit]: downloads the debug APK that CI built for
// HEAD (or the commit given) into .output/, replacing the one there. Only a
// finished, green CI run counts. The APK is checked before it replaces the
// old one: the commit written inside it must be the one asked for. Prints
// its SHA-256; --sha256=<hex> also requires that hash.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEBUG_APK } from './env.mjs';
import { apkInfo, git, sha256 } from './apk-info.mjs';

const args = process.argv.slice(2);
const want = args.find((a) => a.startsWith('--sha256='))?.slice(9).toLowerCase();
const ref = args.find((a) => !a.startsWith('--')) ?? 'HEAD';
const commit = git('rev-parse', ref);
if (!commit) {
  console.error(`fetch-apk: commit ${ref} tidak ditemukan.`);
  process.exit(1);
}
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8' }).trim();
const runs = JSON.parse(gh('run', 'list', '--commit', commit, '--workflow', 'CI', '--json', 'databaseId,status,conclusion', '--limit', '10'));
const green = runs.find((r) => r.status === 'completed' && r.conclusion === 'success');
if (!green) {
  const state = runs.length ? runs.map((r) => `${r.status}/${r.conclusion || '-'}`).join(', ') : 'belum ada';
  console.error(`fetch-apk: belum ada run CI hijau untuk ${commit.slice(0, 7)} (${state}).`);
  process.exit(1);
}
const dir = mkdtempSync(join(tmpdir(), 'sulo-apk-'));
try {
  gh('run', 'download', String(green.databaseId), '-n', 'sulo-android-debug', '-D', dir);
  const apk = readdirSync(dir).find((f) => f.endsWith('-android-debug.apk'));
  if (!apk) throw new Error('artefak tanpa APK debug');
  const file = join(dir, apk);
  const info = apkInfo(file);
  const hash = sha256(file);
  if (info && info.commit !== commit) throw new Error(`APK berisi commit ${info.commit.slice(0, 7)}, bukan ${commit.slice(0, 7)}`);
  if (want && hash !== want) throw new Error(`SHA-256 ${hash} tidak sama dengan ${want}`);
  copyFileSync(file, DEBUG_APK);
  console.log(`APK debug dari run CI ${green.databaseId} (commit ${commit.slice(0, 7)}${info ? '' : ', tanpa info build di dalam APK'}):`);
  console.log(`  ${DEBUG_APK}`);
  console.log(`  SHA-256 ${hash}`);
} catch (e) {
  console.error(`fetch-apk: ${e.message}. APK lama tidak diganti.`);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
