// Renders the privacy policy from lib/privacy/content.ts. Uses explicit .ts
// imports so `node scripts/build-privacy.ts` runs without a build step.
import { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_TITLE, PRIVACY_UPDATED, type Block, type Lang, type Section, type Text } from './content.ts';
import { MOBILE_PRIVACY_SECTIONS } from './mobile.ts';

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

// ---- The public page for both apps (M8e E4) ----

/** The public page's own date: set when it is published. */
export const PUBLIC_PRIVACY_UPDATED: Text = { id: '21 November 2026', en: '21 November 2026' };

const PUBLIC_INTRO: Block[] = [
  {
    kind: 'p',
    text: {
      id: 'Sulo adalah pendamping akademik tidak resmi untuk mahasiswa Universitas Hasanuddin, berupa ekstensi browser (Chrome dan Edge) dan aplikasi Android. Sulo bukan aplikasi resmi Unhas, tidak berafiliasi dengan, dan tidak didukung oleh Universitas Hasanuddin.',
      en: 'Sulo is an unofficial academic companion for Universitas Hasanuddin students, as a browser extension (Chrome and Edge) and an Android app. Sulo is not an official Unhas app, and is not affiliated with or endorsed by Universitas Hasanuddin.',
    },
  },
  {
    kind: 'p',
    text: {
      id: 'Singkatnya: datamu tetap di perangkatmu sendiri (browser atau HP), tidak ada server Sulo, tidak ada analitik, iklan, atau pelacakan, dan tidak ada yang dikirim ke pengembang atau pihak ketiga. Sulo hanya membaca SIKOLA, tidak pernah mengubah apa pun di sana, dan tidak pernah meminta password.',
      en: 'In short: your data stays on your own device (browser or phone), there is no Sulo server, no analytics, ads or tracking, and nothing is sent to the developer or to third parties. Sulo only reads SIKOLA, never changes anything there, and never asks for your password.',
    },
  },
];

const PART: Record<'extension' | 'android', Text> = {
  extension: { id: 'Ekstensi browser (Chrome dan Edge)', en: 'Browser extension (Chrome and Edge)' },
  android: { id: 'Aplikasi Android', en: 'Android app' },
};
/** Sections that apply to both apps: kept for the end of the page. */
const SHARED_HEADINGS = new Set(['Perubahan kebijakan', 'Kontak']);

function sectionsHtml(sections: readonly Section[], lang: Lang, level: 'h2' | 'h3'): string {
  return sections.map((s) => `<${level}>${escapeHtml(s.heading[lang])}</${level}>\n${s.blocks.map((b) => blockToHtml(b, lang)).join('\n')}`).join('\n');
}

/**
 * The public page (https://ikrar06.github.io/sulo-data/{privasi,privacy}.html)
 * for both apps: a shared introduction, the extension's sections, the
 * Android app's (the same text as its in-app notice, privacy/mobile.ts),
 * then the changes and contact sections. Static: no script, system fonts.
 */
export function renderPublicPrivacyHtml(lang: Lang): string {
  const other: Lang = lang === 'id' ? 'en' : 'id';
  const otherLabel = lang === 'id' ? 'English' : 'Bahasa Indonesia';
  const extension = PRIVACY_SECTIONS.filter((s) => !SHARED_HEADINGS.has(s.heading.id));
  const shared = PRIVACY_SECTIONS.filter((s) => SHARED_HEADINGS.has(s.heading.id));
  const contents = lang === 'id' ? 'Isi' : 'Contents';
  return `<!doctype html>
<!-- Generated from packages/core/src/privacy/content.ts and mobile.ts by apps/extension/scripts/build-public-privacy.ts. Do not edit by hand. -->
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
h2 { font-size: 20px; margin: 40px 0 8px; }
h3 { font-size: 17px; margin: 28px 0 8px; }
p.meta, nav { color: var(--muted); font-size: 14px; }
a { color: var(--link); text-underline-offset: 2px; }
ul, ol { padding-left: 24px; }
</style>
</head>
<body>
<main>
<nav><a href="${PUBLIC_PRIVACY_URL[other].split('/').pop()}" hreflang="${other}">${otherLabel}</a></nav>
<h1>Sulo: ${escapeHtml(PRIVACY_TITLE[lang])}</h1>
<p class="meta">${LAST_UPDATED[lang]}: ${escapeHtml(PUBLIC_PRIVACY_UPDATED[lang])}</p>
${PUBLIC_INTRO.map((b) => blockToHtml(b, lang)).join('\n')}
<nav aria-label="${contents}"><a href="#ekstensi">${escapeHtml(PART.extension[lang])}</a> · <a href="#android">${escapeHtml(PART.android[lang])}</a></nav>
<h2 id="ekstensi">${escapeHtml(PART.extension[lang])}</h2>
${sectionsHtml(extension, lang, 'h3')}
<h2 id="android">${escapeHtml(PART.android[lang])}</h2>
${sectionsHtml(MOBILE_PRIVACY_SECTIONS, lang, 'h3')}
${sectionsHtml(shared, lang, 'h2')}
</main>
</body>
</html>
`;
}
