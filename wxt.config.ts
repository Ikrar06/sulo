import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// Permissions are deliberately minimal. See docs/ARCHITECTURE.md section 10.
// Adding a permission requires explicit approval (CLAUDE.md, hard rule 8).
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Sulo untuk SIKOLA (tidak resmi)',
    short_name: 'Sulo',
    description:
      'Ekstensi tidak resmi untuk SIKOLA Unhas: tugas lintas course, pengingat tenggat, dan radar perubahan.',
    permissions: ['storage', 'alarms', 'notifications', 'idle'],
    host_permissions: ['https://sikola-v2.unhas.ac.id/*'],
  },
});
