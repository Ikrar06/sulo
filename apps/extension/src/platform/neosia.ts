// The browser side of @sulo/core neosia/module.ts: Chrome's permissions and
// scripting APIs behind the injected interface. Used by the service worker
// only; the dashboard calls chrome.permissions.request itself (it needs the
// click on "Hubungkan").

import { browser } from 'wxt/browser';
import type { KeyValueStore, UnixSeconds } from '@sulo/core/types';
import { NEOSIA_PERMISSIONS, type ModuleDeps, type ScriptingApi } from '@sulo/core/neosia/module';

/** A mutable copy, as the browser API types want. */
export const neosiaPermissionRequest = () => ({ permissions: [...NEOSIA_PERMISSIONS.permissions], origins: [...NEOSIA_PERMISSIONS.origins] });

export function browserModuleDeps(store: KeyValueStore, now: () => UnixSeconds): ModuleDeps {
  return {
    store,
    now,
    hasPermissions: () => browser.permissions.contains(neosiaPermissionRequest()),
    removePermissions: async () => {
      await browser.permissions.remove(neosiaPermissionRequest());
    },
    // undefined until "scripting" is granted.
    scripting: () => ((browser as unknown as { scripting?: ScriptingApi }).scripting ?? null),
  };
}
