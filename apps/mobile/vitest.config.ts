import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@sulo/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)), '@sulo/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)) } },
  define: { __SULO_WEB_FAKE__: 'true', __SULO_DEV__: 'true', __SULO_VERSION__: '"0.2.0"', __SULO_COMMIT__: '"0000000"' },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
