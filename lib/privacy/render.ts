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

/** Public copies of the extension's privacy page: https://ikrar06.github.io/sulo-data/{privacy,privasi}.html. */
export const PUBLIC_PRIVACY_URL: Record<Lang, string> = {
  id: 'https://ikrar06.github.io/sulo-data/privasi.html',
  en: 'https://ikrar06.github.io/sulo-data/privacy.html',
};

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Bare https addresses in the text become plain links (no script, no tracking). */
const linkify = (s: string) => escapeHtml(s).replace(/https:\/\/[^\s<]+[^\s<.,)]/g, (url) => `<a href="${url}">${url}</a>`);

function blockToHtml(block: Block, lang: Lang): string {
  if (block.kind === 'p') return `<p>${linkify(block.text[lang])}</p>`;
  const tag = block.kind === 'ol' ? 'ol' : 'ul';
  return `<${tag}>${block.items.map((i) => `<li>${linkify(i[lang])}</li>`).join('')}</${tag}>`;
}

/**
 * A static page: no script, system fonts, dark theme by prefers-color-scheme.
 * Same content as the in-extension page (lib/privacy/content.ts).
 */
export function renderPrivacyHtml(lang: Lang): string {
  const other: Lang = lang === 'id' ? 'en' : 'id';
  const otherLabel = lang === 'id' ? 'English' : 'Bahasa Indonesia';
  const sections = PRIVACY_SECTIONS.map((s) => `<h2>${escapeHtml(s.heading[lang])}</h2>\n${s.blocks.map((b) => blockToHtml(b, lang)).join('\n')}`).join('\n');
  return `<!doctype html>
<!-- Generated from lib/privacy/content.ts by scripts/build-public-privacy.ts. Do not edit by hand. -->
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sulo: ${escapeHtml(PRIVACY_TITLE[lang])}</title>
<style>
:root { color-scheme: light dark; --bg: #fafafb; --text: #111114; --muted: #5f5f6b; --link: #111114; }
@media (prefers-color-scheme: dark) { :root { --bg: #0b0b0e; --text: #f2f2f5; --muted: #8a8a96; --link: #f2f2f5; } }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 68ch; margin: 0 auto; padding: 32px 16px 64px; }
h1 { font-size: 24px; line-height: 1.3; margin: 0 0 4px; }
h2 { font-size: 18px; margin: 32px 0 8px; }
p.meta, nav { color: var(--muted); font-size: 14px; }
a { color: var(--link); text-underline-offset: 2px; }
ul, ol { padding-left: 24px; }
</style>
</head>
<body>
<main>
<nav><a href="${PUBLIC_PRIVACY_URL[other].split('/').pop()}" hreflang="${other}">${otherLabel}</a></nav>
<h1>Sulo: ${escapeHtml(PRIVACY_TITLE[lang])}</h1>
<p class="meta">${LAST_UPDATED[lang]}: ${escapeHtml(PRIVACY_UPDATED[lang])}</p>
${PRIVACY_INTRO.map((b) => blockToHtml(b, lang)).join('\n')}
${sections}
</main>
</body>
</html>
`;
}
