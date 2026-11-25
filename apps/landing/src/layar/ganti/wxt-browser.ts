// Stand-in for wxt/browser: a web page has no extension APIs. The version is
// the one the landing page shows (1.0.0).
const noop = () => undefined;
const events = { addListener: noop, removeListener: noop, hasListener: () => false };
export const browser = {
  runtime: { id: 'sulo-landing', getManifest: () => ({ version: '1.0.0', name: 'Sulo' }), getURL: (path: string) => path, sendMessage: async () => undefined, onMessage: events },
  i18n: { getUILanguage: () => 'id' },
  storage: { local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined, onChanged: events }, session: { get: async () => ({}), set: async () => undefined }, onChanged: events },
  tabs: { create: async () => undefined },
} as never;
