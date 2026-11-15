// Regenerates PRIVACY.md (English) from lib/privacy/content.ts, the single
// source shared with the in-extension privacy page.
// Usage: node scripts/build-privacy.ts
import { writeFileSync } from 'node:fs';
import { renderPrivacyMarkdown } from '../lib/privacy/render.ts';

writeFileSync(new URL('../PRIVACY.md', import.meta.url), renderPrivacyMarkdown('en'));
console.log('Ditulis: PRIVACY.md');
