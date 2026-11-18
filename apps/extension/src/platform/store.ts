import { browser } from 'wxt/browser';
import type { KeyValueStore as PlatformStore, StorageChange } from '@sulo/core/platform';
import type { KeyValueStore } from '@sulo/core/types';

type StorageArea = typeof browser.storage.local;

// Adapter from a chrome.storage area to the injectable store packages/core
// uses (get/set/remove/keys). packages/core never imports this.
export function createBrowserStore(area: StorageArea): KeyValueStore {
  return {
    async get<T>(key: string) {
      const result = await area.get(key);
      return result[key] as T | undefined;
    },
    async set<T>(key: string, value: T) {
      await area.set({ [key]: value });
    },
    async remove(keys: string | string[]) {
      await area.remove(keys);
    },
    async keys(prefix: string) {
      const all = await area.get(null);
      return Object.keys(all).filter((k) => k.startsWith(prefix));
    },
  };
}

/**
 * The platform KeyValueStore (packages/core/src/platform): the same store
 * plus watch, from chrome.storage.onChanged for this area only.
 */
export function createWatchedStore(area: StorageArea, areaName: 'local' | 'session'): PlatformStore {
  return {
    ...createBrowserStore(area),
    watch(listener) {
      const onChanged = (changes: Record<string, StorageChange>, name: string) => {
        if (name === areaName) listener(changes);
      };
      browser.storage.onChanged.addListener(onChanged);
      return () => browser.storage.onChanged.removeListener(onChanged);
    },
  };
}
