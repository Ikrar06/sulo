#!/usr/bin/env node
// Project UI and safety rules that a type checker cannot see (docs/UI.md,
// CLAUDE.md). No dependencies, so it runs anywhere. Exit 1 on any finding.
//
// Everywhere in components/ and entrypoints/:
// - focus rings for keyboard only: no plain `focus:` utilities
// - never the browser's native <select>
// - no background gradients (only the mascot and logo flame may use one)
// - no colored accent border on the left edge of cards or banners
// - no third-party script, image, font, stylesheet, iframe or embed
// - every target="_blank" link carries rel="noopener noreferrer"
// In the dashboard (components/dashboard/):
// - text sizes only 12, 14, 16, 20, 24 px (never below 12)
// - spacing only 0, 4, 8, 12, 16, 24, 32 px (20 px only as card padding)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const findings = [];

function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(path);
  }
  return out;
}

const report = (file, line, rule, text) => findings.push(`${relative(root, file)}:${line}  ${rule}: ${text.trim().slice(0, 120)}`);

function eachLine(file, fn) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((text, i) => fn(text, i + 1));
}

const GRADIENT_OK = /mascot|brand|logo|icons\/|tokens\.css/;
const sources = [...walk(join(root, 'components'), ['.tsx', '.ts', '.css']), ...walk(join(root, 'entrypoints'), ['.tsx', '.ts', '.html', '.css']), ...walk(join(root, 'assets'), ['.css'])];

for (const file of sources) {
  const rel = relative(root, file);
  const content = readFileSync(file, 'utf8');
  eachLine(file, (text, line) => {
    if (text.includes('lint-ui-allow')) return;
    if (/(?<![-\w])focus:(?!visible)/.test(text) && !/focus:outline-none/.test(text)) report(file, line, 'focus: dipakai (pakai focus-ring:)', text);
    if (/<select[\s>]/.test(text)) report(file, line, '<select> bawaan browser', text);
    if (!GRADIENT_OK.test(rel) && /(bg-gradient|bg-linear-|bg-radial|linear-gradient\(|radial-gradient\()/.test(text)) report(file, line, 'gradasi latar', text);
    if (/\bborder-l-(?:[2-9]|\[)/.test(text)) report(file, line, 'garis aksen tepi kiri', text);
    if (/<(script|img|iframe|embed|link)\b[^>]*\b(?:src|href)=["']https?:\/\//.test(text)) report(file, line, 'aset pihak ketiga', text);
    if (/@import\s+(?:url\()?["']?https?:/.test(text) || /url\(["']?https?:/.test(text)) report(file, line, 'aset pihak ketiga di CSS', text);
  });
  // target="_blank" needs rel="noopener noreferrer" on the same element or in the spread object.
  for (const m of content.matchAll(/target(?:=|:\s*)["']_blank["']/g)) {
    const around = content.slice(Math.max(0, m.index - 300), m.index + 300);
    if (!/rel(?:=|:\s*)["']noopener noreferrer["']/.test(around)) {
      const line = content.slice(0, m.index).split('\n').length;
      report(file, line, 'target="_blank" tanpa rel="noopener noreferrer"', m[0]);
    }
  }
}

// Dashboard type and spacing scale.
const TEXT_OK = new Set(['12', '14', '16', '20', '24']);
const NAMED_TEXT_BAD = /\btext-(?:2xs|lg|3xl|4xl)\b/;
const SPACING = /(?<![\w-])(?:-)?(p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-y|space-x)-(\[[^\]]+\]|[0-9.]+)(?![\w.])/g;
const STEP_OK = new Set(['0', '1', '2', '3', '4', '6', '8']);
for (const file of walk(join(root, 'components', 'dashboard'), ['.tsx'])) {
  eachLine(file, (text, line) => {
    // A deliberate exception, explained on the same line.
    if (text.includes('lint-ui-allow')) return;
    for (const m of text.matchAll(/\btext-\[(\d+(?:\.\d+)?)px\]/g)) if (!TEXT_OK.has(m[1])) report(file, line, `ukuran teks ${m[1]}px di luar skala`, m[0]);
    if (NAMED_TEXT_BAD.test(text)) report(file, line, 'ukuran teks di luar skala', text.match(NAMED_TEXT_BAD)[0]);
    for (const m of text.matchAll(SPACING)) {
      const [whole, prop, step] = m;
      if (step.startsWith('[')) {
        const px = /^\[(\d+)px\]$/.exec(step)?.[1];
        if (!px || !['4', '8', '12', '16', '24', '32'].includes(px)) report(file, line, `jarak ${whole} di luar skala`, whole);
      } else if (!STEP_OK.has(step) && !(step === '5' && prop.startsWith('p'))) report(file, line, `jarak ${whole} di luar skala`, whole);
    }
  });
}

if (findings.length) {
  console.error(`lint-ui: ${findings.length} temuan\n${findings.join('\n')}`);
  process.exit(1);
}
console.log(`lint-ui: bersih (${sources.length} berkas).`);
