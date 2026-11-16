// Manual theme (dashboard settings): "system" removes data-theme so the CSS
// follows prefers-color-scheme; "light" and "dark" set it on <html>
// (assets/tailwind.css). Tiny on purpose: every page imports it.

import type { Theme } from '../prefs';

export function applyTheme(root: { setAttribute(n: string, v: string): void; removeAttribute(n: string): void }, theme: Theme): void {
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}
