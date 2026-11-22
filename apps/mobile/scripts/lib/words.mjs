// The app's own words (packages/core/src/i18n), loaded through Vite, so the
// screenshot scripts click what the build under test says in each language
// and never a label copied into a script. Also the source of the text
// inventory (scripts/text-inventory.mjs).
import { createServer } from 'vite';

const CORE = new URL('../../../../packages/core/src/', import.meta.url).pathname;

/** Runs `use(load)` with a loader for modules under packages/core/src ("/i18n/index.ts"). */
export async function withCore(use) {
  const server = await createServer({ configFile: false, root: CORE, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
  try {
    return await use((path) => server.ssrLoadModule(path));
  } finally {
    await server.close();
  }
}

/** { id, en }, each { base, dash, mobile, neosia, onboarding, extOnboarding }. */
export function loadWords() {
  return withCore(async (load) => {
    const [base, dash, mobile, neosia, onboarding, ext] = await Promise.all(['/i18n/index.ts', '/i18n/dashboard/index.ts', '/i18n/mobile.ts', '/i18n/neosia.ts', '/i18n/mobile-onboarding.ts', '/i18n/ext-onboarding.ts'].map(load));
    const of = (locale) => ({
      base: base.messagesFor(locale),
      dash: dash.dashFor(locale),
      mobile: mobile.mobileWords(locale),
      neosia: neosia.neosiaWords(locale),
      onboarding: onboarding.onboardingWords(locale),
      extOnboarding: ext.extOnboardingWords(locale).ext,
    });
    return { id: of('id'), en: of('en') };
  });
}
