// Writes assets/brand/mascot/eyes-spiral.svg from the same spiralPath() the
// animated mascot uses, so the static dizzy mascot matches the live one.
// Usage: node scripts/build-spiral-eyes.ts (then node scripts/build-mascot.mjs)

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EYE_CENTERS, SPIRAL_STROKE, spiralPath } from '../components/mascot/geometry.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const paths = EYE_CENTERS.map(
  (c) => `<path d="${spiralPath(c.x, c.y)}" stroke="white" stroke-width="${SPIRAL_STROKE}" stroke-linecap="round" stroke-linejoin="round"/>`,
);
const svg = `<svg width="510" height="512" viewBox="0 0 510 512" fill="none" xmlns="http://www.w3.org/2000/svg">\n${paths.join('\n')}\n</svg>\n`;
writeFileSync(join(root, 'assets/brand/mascot/eyes-spiral.svg'), svg);
console.log('Ditulis assets/brand/mascot/eyes-spiral.svg');
