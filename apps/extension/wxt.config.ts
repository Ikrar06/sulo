import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { stripLocalPaths } from './vite/strip-local-paths';
import { NEOSIA_HOST_PERMISSIONS } from '../../packages/core/src/neosia/allowlist';

const ICONS = {
  16: 'icon/icon-16.png',
  32: 'icon/icon-32.png',
  48: 'icon/icon-48.png',
  128: 'icon/icon-128.png',
};

// Entry points that exist only in development builds.
const DEV_ONLY_ENTRYPOINTS = new Set(['recorder', 'preview']);

// Permissions are deliberately minimal. Adding one needs an issue and the
// maintainer's explicit approval first.
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // Workspace (M8a): shared logic comes from packages/core as source. Build
  // output stays in .output/ at the repository root, zips keep their names.
  alias: { '@sulo/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)) },
  outDir: '../../.output',
  zip: { name: 'sulo' },
  vite: () => ({
    plugins: [tailwindcss(), stripLocalPaths()],
  }),
  hooks: {
    // Dev-only pages exist only in development builds. The "tester" build
    // (pnpm zip:tester) keeps the dev info panel in the popup (request counts
    // per source) but, like production, leaves the recorder and preview out.
    'entrypoints:resolved': (wxt, entrypoints) => {
      if (wxt.config.mode === 'development') return;
      for (const entrypoint of entrypoints) {
        if (DEV_ONLY_ENTRYPOINTS.has(entrypoint.name)) entrypoint.skipped = true;
      }
    },
  },
  manifest: {
    // Name and description come from public/_locales (en and id); Chrome picks
    // the browser's language and falls back to English. Store title: product
    // name and role only; the campus name stays in the description.
    default_locale: 'en',
    name: '__MSG_extName__',
    short_name: 'Sulo',
    description: '__MSG_extDescription__',
    icons: ICONS,
    action: { default_icon: ICONS, default_title: 'Sulo' },
    permissions: ['storage', 'alarms', 'notifications', 'idle'],
    host_permissions: ['https://sikola-v2.unhas.ac.id/*'],
    // NEOSIA module (M7): asked for together in the consent dialog, removed
    // when the module is turned off (lib/neosia/module.ts). Never at install.
    optional_permissions: ['scripting'],
    optional_host_permissions: [...NEOSIA_HOST_PERMISSIONS],
  },
});
