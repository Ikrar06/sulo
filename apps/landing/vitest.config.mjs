// The landing page's own tests: the iPhone interest counter (its rules, the Vercel function in api/, the
// Cloudflare one in functions/) and the build checks' rules.
// Kept apart from Astro's config so the page's Vite plugins never run here.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
