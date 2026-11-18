import { browser } from 'wxt/browser';
import type { SecretStore } from '@sulo/core/platform';

type StorageArea = typeof browser.storage.session;

/**
 * Secrets in chrome.storage.session: kept in memory only, gone when the
 * browser closes, never synced. This is where the SIKOLA sesskey lives
 * today (entrypoints/background.ts, key "sesskey").
 */
export function createSessionSecrets(area: StorageArea = browser.storage.session): SecretStore {
  return {
    async get(key) {
      const value = (await area.get(key))[key];
      return typeof value === 'string' ? value : null;
    },
    async set(key, value) {
      await area.set({ [key]: value });
    },
    async remove(key) {
      await area.remove(key);
    },
  };
}
