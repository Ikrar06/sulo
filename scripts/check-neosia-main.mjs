#!/usr/bin/env node
// Checks the built NEOSIA page-world script (M7, project rules 12 to 15):
// it may hold the capture and the projection and nothing else. Fails on:
// - a size over 16 KB
// - extension or storage APIs (chrome., browser., localStorage,
//   sessionStorage, indexedDB, document.cookie)
// - a request of its own (a fetch( call, new XMLHttpRequest, sendBeacon, WebSocket)
// - code loading (eval, new Function, importScripts, import(), require)
// - HTML writing (innerHTML, outerHTML, document.write)
// - reading the survey link field, or a host other than the NEOSIA API
// - the dev observation listing, unless --dev
// Usage: node scripts/check-neosia-main.mjs .output/chrome-mv3 [--dev]

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const root = args.find((a) => !a.startsWith('--'));
const dev = args.includes('--dev');
if (!root) {
  console.error('check-neosia-main: beri folder hasil build, misalnya .output/chrome-mv3');
  process.exit(2);
}

const MAX_BYTES = 16 * 1024;
const file = join(root, 'neosia-main.js');
const text = readFileSync(file, 'utf8');
const size = statSync(file).size;

const FORBIDDEN = [
  ['chrome.', /\bchrome\./],
  ['browser.', /\bbrowser\./],
  ['localStorage', /localStorage/],
  ['sessionStorage', /sessionStorage/],
  ['indexedDB', /indexedDB/],
  ['document.cookie', /document\.cookie/],
  ['fetch( call', /(?<![.\w])fetch\(/],
  ['new XMLHttpRequest', /new\s+XMLHttpRequest/],
  ['sendBeacon', /sendBeacon/],
  ['WebSocket', /WebSocket/],
  ['eval', /\beval\(/],
  ['new Function', /new\s+Function\(/],
  ['importScripts', /importScripts/],
  ['import()', /\bimport\(/],
  ['require', /\brequire\(/],
  ['innerHTML', /innerHTML|outerHTML|document\.write/],
];

const problems = FORBIDDEN.filter(([, re]) => re.test(text)).map(([name]) => name);
// survey_url is named once, in the dropped-fields list (lib/neosia/allowlist.ts); any other mention would be code touching it.
const surveyMentions = text.split('survey_url').length - 1;
if (surveyMentions > 1) problems.push(`survey_url disebut ${surveyMentions} kali (hanya boleh sekali, di daftar buang)`);
if (size > MAX_BYTES) problems.push(`ukuran ${size} byte di atas ${MAX_BYTES}`);
// Every URL, plus bare host names in the university's domain.
const hosts = [...new Set([...[...text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1]), ...[...text.matchAll(/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.unhas\.ac\.id/gi)].map((m) => m[0])])];
const strange = hosts.filter((h) => h !== 'api.neosia.unhas.ac.id');
if (strange.length) problems.push(`host lain: ${strange.join(', ')}`);
if (!dev && text.includes('sulo:observe:v1')) problems.push('daftar observasi dev ikut ke build ini');

if (problems.length) {
  console.error(`check-neosia-main: ${file}\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`check-neosia-main: bersih (${size} byte, ${(size / 1024).toFixed(1)} KB) di ${file}.`);
