#!/usr/bin/env node
// Builds the notification icons (PNG, 128 px) from the static mascots.
// Notifications do not support SVG. Needs rsvg-convert (librsvg); see
// CONTRIBUTING.md. Rebuild only when the mascot changes, then commit the PNGs.
//
// Usage: node scripts/build-notify-icons.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = join(ROOT, 'assets/brand/mascot/static');
const OUT = join(ROOT, 'public/notify');
const SIZE = '128';

/** Notification icon name -> static mascot. */
const ICONS = { idle: 'mascot-idle', urgent: 'mascot-wide', sleepy: 'mascot-sleepy' };

try {
  execFileSync('rsvg-convert', ['--version'], { stdio: 'ignore' });
} catch {
  console.error('build-notify-icons: rsvg-convert tidak ditemukan. Pasang librsvg dulu (lihat CONTRIBUTING.md).');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
for (const [name, source] of Object.entries(ICONS)) {
  execFileSync('rsvg-convert', ['--width', SIZE, '--height', SIZE, '--keep-aspect-ratio', '--output', join(OUT, `${name}.png`), join(STATIC, `${source}.svg`)]);
}
console.log(`Ditulis ${Object.keys(ICONS).length} ikon notifikasi ke ${OUT}`);
