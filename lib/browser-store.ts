import { browser } from 'wxt/browser';
import type { KeyValueStore } from './types';

type StorageArea = typeof browser.storage.local;

// Adapter from a chrome.storage area to the injectable KeyValueStore.
// Lives outside lib/moodle so that module stays free of browser APIs.
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
