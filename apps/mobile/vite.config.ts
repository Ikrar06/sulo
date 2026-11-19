import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
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

/**
 * The commit this build is made from: CI's GITHUB_SHA, else git's HEAD; a
 * local build from a changed tree is marked dirty. Shown on Tentang in debug
 * builds and written to dist/build-info.json (in the APK's assets), which
 * pnpm mobile:install and mobile:fetch-apk read to say which build it is.
 */
function buildCommit(): { commit: string; short: string; dirty: boolean } {
  const git = (...args: string[]) => {
    try {
      return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  };
  const commit = process.env.GITHUB_SHA || git('rev-parse', 'HEAD') || 'unknown';
  const dirty = !process.env.GITHUB_SHA && git('status', '--porcelain', '--', '.', '../../packages') !== '';
  return { commit, short: commit.slice(0, 7) + (dirty ? '+' : ''), dirty };
}

function buildInfo(mode: string, info: ReturnType<typeof buildCommit>): Plugin {
  return {
    name: 'sulo-build-info',
    apply: 'build',
    writeBundle(options) {
      const dir = options.dir ?? 'dist';
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/build-info.json`, `${JSON.stringify({ commit: info.commit, dirty: info.dirty, mode, version: pkg.version })}\n`);
    },
  };
}

const commit = buildCommit();

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'web' ? [] : [neosiaPageScript(), buildInfo(mode, commit)])],
  resolve: { alias },
  // __SULO_DEV__: the hidden session-age screen, in mobile:web and the debug APK (mode "debug") only.
  define: { __SULO_VERSION__: JSON.stringify(pkg.version), __SULO_COMMIT__: JSON.stringify(commit.short), __SULO_WEB_FAKE__: JSON.stringify(mode === 'web'), __SULO_DEV__: JSON.stringify(mode === 'web' || mode === 'debug') },
  server: { port: 5174, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
}));
