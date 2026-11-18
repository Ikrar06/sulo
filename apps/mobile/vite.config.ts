import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

// Modes: "web" (pnpm mobile:web), "debug" (pnpm mobile:apk:debug), production (release APK).
// "web" mode (pnpm mobile:web): the UI in a desktop browser with fake
// adaptors and fixtures, for checking layouts in DevTools' phone mode. It
// sends no request. Other modes build the app that goes into the APK.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@sulo/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
      '@sulo/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // __SULO_DEV__: the hidden session-age screen, in mobile:web and the debug APK (mode "debug") only.
  define: { __SULO_VERSION__: JSON.stringify(pkg.version), __SULO_WEB_FAKE__: JSON.stringify(mode === 'web'), __SULO_DEV__: JSON.stringify(mode === 'web' || mode === 'debug') },
  server: { port: 5174, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
}));
