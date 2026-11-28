// The phone's text size as the layout sees it. Android's font size setting reaches the WebView as its text zoom
// (MainActivity.textZoom), which enlarges every text but no length: a column wide enough for a word at 100% is
// too narrow at 200%. CSS cannot read the zoom, so it is measured once here (a 100 px text reports its zoomed
// size) and handed to the layout as --m-zoom, the factor its thresholds grow by (src/tokens.css). In a browser
// there is no zoom: --m-zoom stays var(--m-tz), the web preview's own stand-in for the setting.

/** The text zoom of this page: computed size of a 100 px text, over 100. Pure apart from the probe. */
export function measureTextZoom(doc: Document = document): number {
  const probe = doc.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;font-size:100px;line-height:normal';
  probe.textContent = 'x';
  doc.body.appendChild(probe);
  const zoom = parseFloat(getComputedStyle(probe).fontSize) / 100;
  probe.remove();
  return Number.isFinite(zoom) && zoom > 0 ? Math.round(zoom * 100) / 100 : 1;
}

/** Sets --m-zoom on <html> when the WebView zooms text; leaves the stylesheet's default otherwise. */
export function applyTextZoom(doc: Document = document): number {
  const zoom = measureTextZoom(doc);
  if (zoom !== 1) doc.documentElement.style.setProperty('--m-zoom', String(zoom));
  return zoom;
}

/**
 * iPhone: WKWebView does not scale text with the phone's text size, so the native side reads it
 * (SuloSession.textScale, clamped like Android's textZoom) and the page applies it as the web preview does:
 * --m-tz scales every text-m* size, --m-zoom the layout's thresholds (src/tokens.css). Again on each return.
 */
export async function applyIosTextScale(read: () => Promise<{ scale: number }>, doc: Document = document): Promise<number> {
  const { scale } = await read().catch(() => ({ scale: 1 }));
  const value = Number.isFinite(scale) && scale > 0 ? scale : 1;
  doc.documentElement.style.setProperty('--m-tz', String(value));
  doc.documentElement.style.setProperty('--m-zoom', String(value));
  return value;
}
