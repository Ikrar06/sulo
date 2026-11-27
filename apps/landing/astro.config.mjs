// Sulo's landing page: static pages, built from the apps' own code. Deployed
// on Vercel (vercel.json: the install and build commands, the headers).
// Cloudflare Pages stays possible: scripts/keamanan.mjs --headers writes its
// dist/_headers. SITE_URL sets the address; nothing is written in for it.
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import { extensionAlias, gantiData } from './src/layar/ganti/plugin.mjs';

/** The apps' own version (the phone app's package.json, the same as the extension's): screens never show an old one. */
const VERSI = JSON.parse(readFileSync(new URL('../mobile/package.json', import.meta.url), 'utf8')).version;

export default defineConfig({
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  output: 'static',
  trailingSlash: 'always',
  // Lossless, HTML-aware whitespace removal (Astro 7's default 'jsx' would join words across inline elements).
  compressHTML: true,
  build: { format: 'directory', inlineStylesheets: 'never' },
  i18n: { defaultLocale: 'id', locales: ['id', 'en'], routing: { prefixDefaultLocale: false } },
  devToolbar: { enabled: false },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss(), gantiData()],
    resolve: { alias: [extensionAlias] },
    // The apps' build-time constants; the screens show the apps' own version.
    define: { __SULO_VERSION__: JSON.stringify(VERSI), __SULO_COMMIT__: JSON.stringify(''), __SULO_WEB_FAKE__: 'false', __SULO_DEV__: 'false' },
    ssr: { noExternal: [/^@sulo\//, /^@capacitor\//, /^wxt/, 'radix-ui'] },
  },
});
