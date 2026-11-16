import React from 'react';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { DashboardApp } from '@/components/dashboard/App';
import { createBrowserStore } from '@/lib/browser-store';
import { readPrefs } from '@/lib/prefs';
import { installInputModality } from '@/lib/ui/input-modality';
import { applyTheme } from '@/lib/ui/theme';
import '@/assets/tailwind.css';

// Dashboard in a full tab (dashboard.html#kalender, #tugas, ...). Opening it
// sends no request; it reads chrome.storage only.

// Focus rings for keyboard users only (see assets/tailwind.css).
installInputModality(document, document.documentElement);

const root = document.getElementById('root');
if (!root) throw new Error('Dashboard root element not found');
// Theme before the first paint, so a dark page never flashes white.
void readPrefs(createBrowserStore(browser.storage.local)).then((prefs) => {
  applyTheme(document.documentElement, prefs.theme);
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <DashboardApp />
    </React.StrictMode>,
  );
});
