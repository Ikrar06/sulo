// Writes the public privacy pages into the sulo-data repository next to this
// one (../sulo-data/privacy.html in English, privasi.html in Indonesian),
// from the same source as the in-extension page. Static HTML only.
// Usage: node scripts/build-public-privacy.ts [path to sulo-data]
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderPrivacyHtml } from '../../../packages/core/src/privacy/render.ts';

// pnpm runs this from apps/extension; paths given on the command line are
// read from where the command was typed (INIT_CWD).
const target = process.argv[2] ? resolve(process.env.INIT_CWD ?? process.cwd(), process.argv[2]) : new URL('../../../../sulo-data', import.meta.url).pathname;
if (!existsSync(target)) throw new Error(`sulo-data not found at ${target}`);
writeFileSync(join(target, 'privacy.html'), renderPrivacyHtml('en'));
writeFileSync(join(target, 'privasi.html'), renderPrivacyHtml('id'));
console.log(`Ditulis: ${join(target, 'privacy.html')} dan privasi.html`);
