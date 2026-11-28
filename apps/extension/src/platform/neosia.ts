// The browser side of @sulo/core neosia/module.ts: Chrome's permissions and
// scripting APIs behind the injected interface. Used by the service worker
// only; the dashboard calls chrome.permissions.request itself (it needs the
// click on "Hubungkan").

import { browser } from 'wxt/browser';
import type { KeyValueStore, UnixSeconds } from '@sulo/core/types';
import { NEOSIA_PERMISSIONS, type ModuleDeps, type ScriptingApi } from '@sulo/core/neosia/module';
import { sipakamaseNeedsScripting } from './sipakamase';

/** A mutable copy, as the browser API types want. */
export const neosiaPermissionRequest = () => ({ permissions: [...NEOSIA_PERMISSIONS.permissions], origins: [...NEOSIA_PERMISSIONS.origins] });

export function browserModuleDeps(store: KeyValueStore, now: () => UnixSeconds): ModuleDeps {
  return {
    store,
    now,
    hasPermissions: () => browser.permissions.contains(neosiaPermissionRequest()),
    // "scripting" stays while the Sipakamase module still uses it.
    removePermissions: async () => {
      const keepScripting = await sipakamaseNeedsScripting(store);
      await browser.permissions.remove(keepScripting ? { origins: [...NEOSIA_PERMISSIONS.origins] } : neosiaPermissionRequest());
    },
    // undefined until "scripting" is granted.
    scripting: () => ((browser as unknown as { scripting?: ScriptingApi }).scripting ?? null),
  };
}
