// The browser side of @sulo/core sipakamase/module.ts and run.ts: Chrome's
// permissions and scripting APIs behind the injected interfaces. Service
// worker only; the dashboard calls chrome.permissions.request itself (it
// needs the click on "Hubungkan").
//
// NEOSIA and Sipakamase share the optional "scripting" permission: turning
// one off removes "scripting" only when the other is off too.

import { browser } from 'wxt/browser';
import type { KeyValueStore, UnixSeconds } from '@sulo/core/types';
import { readModuleState } from '@sulo/core/neosia/module';
import { readSipakamaseModule, SIPAKAMASE_PERMISSIONS, type ModuleDeps, type ScriptingApi } from '@sulo/core/sipakamase/module';

export const sipakamasePermissionRequest = () => ({ permissions: [...SIPAKAMASE_PERMISSIONS.permissions], origins: [...SIPAKAMASE_PERMISSIONS.origins] });

export function browserSipakamaseDeps(store: KeyValueStore, now: () => UnixSeconds): ModuleDeps {
  return {
    store,
    now,
    hasPermissions: () => browser.permissions.contains(sipakamasePermissionRequest()),
    removePermissions: async () => {
      const neosiaOn = (await readModuleState(store)).enabled;
      await browser.permissions.remove({ origins: [...SIPAKAMASE_PERMISSIONS.origins], ...(neosiaOn ? {} : { permissions: [...SIPAKAMASE_PERMISSIONS.permissions] }) });
    },
    scripting: () => ((browser as unknown as { scripting?: ScriptingApi }).scripting ?? null),
  };
}

/** For neosia.ts: whether "scripting" must stay for Sipakamase. */
export const sipakamaseNeedsScripting = async (store: KeyValueStore) => (await readSipakamaseModule(store)).enabled;
