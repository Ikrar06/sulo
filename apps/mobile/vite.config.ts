import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { build, defineConfig, type Plugin } from 'vite';
import pkg from './package.json' with { type: 'json' };

// Modes: "web" (pnpm mobile:web), "debug" (pnpm mobile:apk:debug), production (release APK).
// "web" mode (pnpm mobile:web): the UI in a desktop browser with fake
// adaptors and fixtures, for checking layouts in DevTools' phone mode. It
// sends no request. Other modes build the app that goes into the APK.
const alias = {
  '@sulo/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
  '@sulo/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
  '@': fileURLToPath(new URL('./src', import.meta.url)),
};

/**
 * M8d: the NEOSIA page-world script (src/neosia/page-script.ts), bundled on
 * its own into dist/neosia-main.js (one IIFE, no imports), which Capacitor
 * copies into the APK's assets. Checked by apps/extension/scripts/check-neosia-main.mjs.
 */
function neosiaPageScript(): Plugin {
  return {
    name: 'sulo-neosia-page-script',
    apply: 'build',
    async closeBundle() {
      await build({
        configFile: false,
        logLevel: 'warn',
        resolve: { alias },
        build: {
          outDir: 'dist',
          emptyOutDir: false,
          target: 'es2022',
          minify: true,
          lib: { entry: fileURLToPath(new URL('./src/neosia/page-script.ts', import.meta.url)), formats: ['iife'], name: 'SuloNeosiaPage', fileName: () => 'neosia-main.js' },
        },
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'web' ? [] : [neosiaPageScript()])],
  resolve: { alias },
  // __SULO_DEV__: the hidden session-age screen, in mobile:web and the debug APK (mode "debug") only.
  define: { __SULO_VERSION__: JSON.stringify(pkg.version), __SULO_WEB_FAKE__: JSON.stringify(mode === 'web'), __SULO_DEV__: JSON.stringify(mode === 'web' || mode === 'debug') },
  server: { port: 5174, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
}));
