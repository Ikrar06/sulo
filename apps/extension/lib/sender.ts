// Pure checks on who sent a runtime message. The service worker trusts
// messages only from its own extension pages (popup, recorder, dashboard)
// or, for the sesskey, from a content script on a SIKOLA page.

export interface SenderInfo {
  id?: string;
  url?: string;
  /** Present for content scripts and for extension pages opened in a tab. */
  tab?: unknown;
}

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * True for pages of this extension, whether shown as the popup (no tab) or
 * opened in a tab (the recorder, later the dashboard). Decided by the page
 * origin, never by the presence of a tab.
 */
export function isExtensionPageSender(sender: SenderInfo, extensionId: string, extensionOrigin: string): boolean {
  // Compared as a prefix: URL.origin is "null" for chrome-extension:// outside browsers.
  const base = extensionOrigin.replace(/\/+$/, '');
  return sender.id === extensionId && typeof sender.url === 'string' && sender.url.startsWith(`${base}/`);
}

/** True for this extension's content script running on a page of `siteOrigin`. */
export function isContentScriptOn(sender: SenderInfo, extensionId: string, siteOrigin: string): boolean {
  return sender.id === extensionId && sender.tab !== undefined && originOf(sender.url) === siteOrigin;
}
