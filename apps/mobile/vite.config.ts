import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// "web" mode (pnpm mobile:web): the UI in a desktop browser with fake
// adaptors and fixtures, for checking layouts in DevTools' phone mode. It
// sends no request. Other modes build the app that goes into the APK.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@sulo/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: { __SULO_WEB_FAKE__: JSON.stringify(mode === 'web') },
  server: { port: 5174, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
}));
