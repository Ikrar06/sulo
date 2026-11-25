// The apps' own screens render on the landing page from their code, with sample
// data. Only the modules that reach for a device are swapped: each app's data
// layer (it reads chrome.storage or the phone's storage), NEOSIA's provider
// (encrypted native storage) and wxt/browser (the extension APIs). Every
// component stays the apps' own.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APPS = resolve(HERE, '../../../..');

/** Original module (absolute path) -> its stand-in here. */
export const SWAPS = {
  [resolve(APPS, 'mobile/src/shell/data.tsx')]: resolve(HERE, 'mobile-data.tsx'),
  [resolve(APPS, 'mobile/src/neosia/NeosiaProvider.tsx')]: resolve(HERE, 'neosia-provider.tsx'),
  [resolve(APPS, 'extension/components/dashboard/data.tsx')]: resolve(HERE, 'ext-data.tsx'),
};
const STAND_INS = new Set(Object.values(SWAPS));

export function gantiData() {
  return {
    name: 'sulo-landing-ganti-data',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source === 'wxt/browser') return resolve(HERE, 'wxt-browser.ts');
      // The apps import images as plain URLs (their bundlers' default); Astro would hand them an object.
      if (importer && importer.startsWith(APPS) && !importer.startsWith(resolve(APPS, 'landing')) && /\.(svg|png|webp|jpe?g)$/.test(source)) {
        const found = await this.resolve(source, importer, { ...options, skipSelf: true });
        return found ? `${found.id}?url` : null;
      }
      // The stand-ins import the real types from their own places.
      if (importer && STAND_INS.has(importer)) return null;
      const found = await this.resolve(source, importer, { ...options, skipSelf: true });
      return found && SWAPS[found.id] ? SWAPS[found.id] : null;
    },
  };
}

/** The extension's '@/...' imports point at its root (wxt does the same). */
export const extensionAlias = { find: /^@\//, replacement: `${resolve(APPS, 'extension')}/` };
