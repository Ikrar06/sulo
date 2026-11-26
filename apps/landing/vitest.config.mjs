// The landing page's own tests: the build checks' rules (text, CSP, motion tiers).
// Kept apart from Astro's config so the page's Vite plugins never run here.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
