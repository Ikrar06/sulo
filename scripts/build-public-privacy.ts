// Writes the public privacy pages into the sulo-data repository next to this
// one (../sulo-data/privacy.html in English, privasi.html in Indonesian),
// from the same source as the in-extension page. Static HTML only.
// Usage: node scripts/build-public-privacy.ts [path to sulo-data]
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderPrivacyHtml } from '../lib/privacy/render.ts';

const target = process.argv[2] ?? new URL('../../sulo-data', import.meta.url).pathname;
if (!existsSync(target)) throw new Error(`sulo-data not found at ${target}`);
writeFileSync(join(target, 'privacy.html'), renderPrivacyHtml('en'));
writeFileSync(join(target, 'privasi.html'), renderPrivacyHtml('id'));
console.log(`Ditulis: ${join(target, 'privacy.html')} dan privasi.html`);
