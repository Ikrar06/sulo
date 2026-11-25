// Sulo's landing page: static pages, built from the apps' own code. Deployed
// on Vercel (vercel.json: the install and build commands, the headers); the
// build also writes dist/_headers, so Cloudflare Pages stays possible.
// SITE_URL sets the address; nothing is written in for it.
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { extensionAlias, gantiData } from './src/layar/ganti/plugin.mjs';

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
    // The apps' build-time constants; the landing page shows version 1.0.0.
    define: { __SULO_VERSION__: JSON.stringify('1.0.0'), __SULO_COMMIT__: JSON.stringify(''), __SULO_WEB_FAKE__: 'false', __SULO_DEV__: 'false' },
    ssr: { noExternal: [/^@sulo\//, /^@capacitor\//, /^wxt/, 'radix-ui'] },
  },
});
