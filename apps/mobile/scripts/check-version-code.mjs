#!/usr/bin/env node
// A release must raise versionCode (M8e E2): Android refuses to install an
// update whose code is not higher than the installed one. Compares
// apps/mobile/package.json's version with the highest "vX.Y.Z" tag (the tag
// being released excluded) and, with --apk, checks the built APK carries
// exactly the expected code and name. Run by android-release.yml.
// Usage: node scripts/check-version-code.mjs [--tag=v0.9.1] [--apk=path] [--aapt=path]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { highestReleased, versionCode } from './version-code.mjs';

const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? null;
const fail = (m) => {
  console.error(`check-version-code: ${m}`);
  process.exit(1);
};

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
let code;
try {
  code = versionCode(version);
} catch (e) {
  fail(e.message);
}
const tag = arg('tag');
if (tag !== null && tag !== `v${version}`) fail(`tag ${tag} tidak sama dengan versi package.json (v${version}).`);
const tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const previous = highestReleased(tags, tag);
if (previous && code <= previous.code) fail(`versionCode ${code} (${version}) tidak lebih besar dari ${previous.code} (${previous.tag}).`);

const apk = arg('apk');
if (apk) {
  const aapt = arg('aapt') ?? 'aapt';
  const badging = execFileSync(aapt, ['dump', 'badging', apk], { encoding: 'utf8' });
  const got = /versionCode='(\d+)' versionName='([^']+)'/.exec(badging);
  if (!got || Number(got[1]) !== code || got[2] !== version) fail(`APK membawa versionCode ${got?.[1]} versionName ${got?.[2]}, seharusnya ${code} ${version}.`);
}
console.log(`check-version-code: ${version} = ${code}${previous ? `, naik dari ${previous.code} (${previous.tag})` : ', rilis pertama'}${apk ? ', APK cocok' : ''}.`);
