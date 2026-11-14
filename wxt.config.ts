import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

const ICONS = {
  16: 'icon/icon-16.png',
  32: 'icon/icon-32.png',
  48: 'icon/icon-48.png',
  128: 'icon/icon-128.png',
};

// Entry points that exist only in development builds.
const DEV_ONLY_ENTRYPOINTS = new Set(['recorder']);

// Permissions are deliberately minimal. See docs/ARCHITECTURE.md section 10.
// Adding a permission requires explicit approval (CLAUDE.md, hard rule 8).
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  hooks: {
    'entrypoints:resolved': (wxt, entrypoints) => {
      if (wxt.config.mode !== 'production') return;
      for (const entrypoint of entrypoints) {
        if (DEV_ONLY_ENTRYPOINTS.has(entrypoint.name)) entrypoint.skipped = true;
      }
    },
  },
  manifest: {
    // Store title: product name and role only; the campus name stays in the description.
    name: 'Sulo: pendamping akademik mahasiswa (tidak resmi)',
    short_name: 'Sulo',
    description: 'Pendamping akademik untuk mahasiswa Unhas. Tidak resmi.',
    icons: ICONS,
    action: { default_icon: ICONS, default_title: 'Sulo' },
    permissions: ['storage', 'alarms', 'notifications', 'idle'],
    host_permissions: ['https://sikola-v2.unhas.ac.id/*'],
  },
});
