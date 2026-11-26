#!/usr/bin/env node
// Keeps ios/App/App.xcodeproj in step with the repository, so nobody has to open Xcode
// to add a file or change a version (the owner works in VS Code and the terminal):
// - every Swift file in ios/App/App/Sulo/ is in the App target;
// - the version is apps/mobile/package.json's: CFBundleShortVersionString = version,
//   CFBundleVersion = the Android versionCode rule (major*10000 + minor*100 + patch);
// - iOS 16.4 at least (docs/ios/PENILAIAN-IOS.md part 4), iPhone only (an iPad runs it in iPhone mode).
// Never writes DEVELOPMENT_TEAM: the signing team stays in ios/App/Local.xcconfig, ignored by git.
// Idempotent: the IDs come from the file names, so running it twice changes nothing.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { versionCode } from './version-code.mjs';

const MOBILE = new URL('..', import.meta.url).pathname;
export const IOS_APP = join(MOBILE, 'ios', 'App');
export const PBXPROJ = join(IOS_APP, 'App.xcodeproj', 'project.pbxproj');
export const MIN_IOS = '16.4';
const SOURCES = join(IOS_APP, 'App', 'Sulo');
const SOUNDS = join(IOS_APP, 'App', 'Sounds');

const id = (kind, name) => createHash('md5').update(`sulo:${kind}:${name}`).digest('hex').slice(0, 24).toUpperCase();

/** Inserts `line` on the line after `anchor` (which may span several lines). */
function insertAfter(text, anchor, line) {
  const at = text.indexOf(anchor);
  if (at < 0) throw new Error(`ios-project: "${anchor}" not found in project.pbxproj`);
  const end = text.indexOf('\n', at + anchor.length) + 1;
  return text.slice(0, end) + line + text.slice(end);
}

export function syncProject({ version = JSON.parse(readFileSync(join(MOBILE, 'package.json'), 'utf8')).version } = {}) {
  let text = readFileSync(PBXPROJ, 'utf8');
  const before = text;
  const files = readdirSync(SOURCES).filter((f) => f.endsWith('.swift')).sort();
  for (const file of files) {
    const ref = id('ref', file);
    const build = id('build', file);
    if (text.includes(ref)) continue;
    text = insertAfter(text, '/* Begin PBXBuildFile section */', `\t\t${build} /* ${file} in Sources */ = {isa = PBXBuildFile; fileRef = ${ref} /* ${file} */; };\n`);
    text = insertAfter(text, '/* Begin PBXFileReference section */', `\t\t${ref} /* ${file} */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Sulo/${file}; sourceTree = "<group>"; };\n`);
    // The App group's children, then the Sources phase's files.
    text = insertAfter(text, '504EC3061FED79650016851F /* App */ = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (', `\t\t\t\t${ref} /* ${file} */,\n`);
    text = insertAfter(text, '504EC3001FED79650016851F /* Sources */ = {\n\t\t\tisa = PBXSourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (', `\t\t\t\t${build} /* ${file} in Sources */,\n`);
  }
  // The notification sounds (scripts/ios-sounds.mjs): resources at the bundle's root, where UNNotificationSound looks.
  const sounds = existsSync(SOUNDS) ? readdirSync(SOUNDS).filter((f) => f.endsWith('.caf')).sort() : [];
  for (const file of sounds) {
    const ref = id('ref', `Sounds/${file}`);
    const build = id('build', `Sounds/${file}`);
    if (text.includes(ref)) continue;
    text = insertAfter(text, '/* Begin PBXBuildFile section */', `\t\t${build} /* ${file} in Resources */ = {isa = PBXBuildFile; fileRef = ${ref} /* ${file} */; };\n`);
    text = insertAfter(text, '/* Begin PBXFileReference section */', `\t\t${ref} /* ${file} */ = {isa = PBXFileReference; lastKnownFileType = file; path = Sounds/${file}; sourceTree = "<group>"; };\n`);
    text = insertAfter(text, '504EC3061FED79650016851F /* App */ = {\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (', `\t\t\t\t${ref} /* ${file} */,\n`);
    text = insertAfter(text, '504EC3021FED79650016851F /* Resources */ = {\n\t\t\tisa = PBXResourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (', `\t\t\t\t${build} /* ${file} in Resources */,\n`);
  }
  text = text
    .replace(/IPHONEOS_DEPLOYMENT_TARGET = [\d.]+;/g, `IPHONEOS_DEPLOYMENT_TARGET = ${MIN_IOS};`)
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
    .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${versionCode(version)};`)
    .replace(/TARGETED_DEVICE_FAMILY = "[^"]+";/g, 'TARGETED_DEVICE_FAMILY = 1;')
    .replace(/TARGETED_DEVICE_FAMILY = [\d,]+;/g, 'TARGETED_DEVICE_FAMILY = 1;');
  if (/DEVELOPMENT_TEAM = /.test(text)) throw new Error('ios-project: DEVELOPMENT_TEAM is in project.pbxproj; it belongs in ios/App/Local.xcconfig only');
  if (text !== before) writeFileSync(PBXPROJ, text);
  return { changed: text !== before, files };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { changed, files } = syncProject();
  console.log(`ios-project: ${files.length} berkas Swift Sulo, ${changed ? 'proyek diperbarui' : 'tidak ada yang berubah'}.`);
}
