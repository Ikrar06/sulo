#!/usr/bin/env node
// A release must raise versionCode (M8e E2): Android refuses to install an
// update whose code is not higher than the installed one. Compares
// apps/mobile/package.json's version with the highest "vX.Y.Z" tag that is
// not the release itself: --tag, and every tag on the commit being built
// (HEAD), are left out, so a run started by a tag never compares the build
// with its own tag. With --apk, also checks the built APK carries exactly the
// expected code and name. Run by android-release.yml (twice: before the
// build, and on the signed APK).
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
const lines = (args) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);
const tags = lines(['tag', '--list', 'v*']);
// The release's own tags: the one named, and any tag on the commit being built.
const own = [...(tag ? [tag] : []), ...lines(['tag', '--points-at', 'HEAD'])];
const previous = highestReleased(tags, own);
if (previous && code <= previous.code) fail(`versionCode ${code} (${version}) tidak lebih besar dari ${previous.code} (${previous.tag}).`);

const apk = arg('apk');
if (apk) {
  const aapt = arg('aapt') ?? 'aapt';
  const badging = execFileSync(aapt, ['dump', 'badging', apk], { encoding: 'utf8' });
  const got = /versionCode='(\d+)' versionName='([^']+)'/.exec(badging);
  if (!got || Number(got[1]) !== code || got[2] !== version) fail(`APK membawa versionCode ${got?.[1]} versionName ${got?.[2]}, seharusnya ${code} ${version}.`);
}
console.log(`check-version-code: ${version} = ${code}${previous ? `, naik dari ${previous.code} (${previous.tag})` : ', rilis pertama'}${apk ? ', APK cocok' : ''}.`);
