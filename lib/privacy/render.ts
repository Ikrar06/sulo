// Renders the privacy policy from lib/privacy/content.ts. Uses explicit .ts
// imports so `node scripts/build-privacy.ts` runs without a build step.
import { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_TITLE, PRIVACY_UPDATED, type Block, type Lang } from './content.ts';

const LAST_UPDATED: Record<Lang, string> = { id: 'Terakhir diperbarui', en: 'Last updated' };

function blockToMarkdown(block: Block, lang: Lang): string {
  if (block.kind === 'p') return block.text[lang];
  return block.items.map((item, i) => (block.kind === 'ol' ? `${i + 1}. ${item[lang]}` : `- ${item[lang]}`)).join('\n');
}

export function renderPrivacyMarkdown(lang: Lang): string {
  const parts = [
    `# ${PRIVACY_TITLE[lang]}`,
    `${LAST_UPDATED[lang]}: ${PRIVACY_UPDATED[lang]}`,
    ...PRIVACY_INTRO.map((b) => blockToMarkdown(b, lang)),
    ...PRIVACY_SECTIONS.flatMap((s) => [`## ${s.heading[lang]}`, ...s.blocks.map((b) => blockToMarkdown(b, lang))]),
  ];
  return `<!-- Generated from lib/privacy/content.ts by scripts/build-privacy.ts. Do not edit by hand. -->\n\n${parts.join('\n\n')}\n`;
}

export { LAST_UPDATED };
