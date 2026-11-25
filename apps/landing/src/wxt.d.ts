// The extension's pages call browser.runtime.getURL, which WXT types from the
// paths it generates when the extension builds (.wxt/). The landing page only
// renders those pages with a stand-in (layar/ganti/wxt-browser.ts), so it
// says the plain shape here instead of depending on a generated folder.
// (tsconfig.json points "wxt/browser" at the extension's copy, so this
// reaches the same module the pages import.)
export {};

declare module 'wxt/browser' {
  interface WxtRuntime {
    getURL(path: string): string;
  }
}
