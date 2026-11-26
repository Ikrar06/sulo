import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type { KeyValueStore, StorageChange } from '@sulo/core/platform';

// Local data in @capacitor/preferences (Android SharedPreferences, app
// private, excluded from backups). Values are JSON. No secret is stored
// here: the SIKOLA session stays in SuloSession's Keystore vault.

/**
 * On the phone, writes go through SuloStore (native, commit(): on disk before
 * they count as done, whole or not at all), same file as Preferences. The
 * web build keeps Preferences.
 *
 * iOS reads through SuloStore too: there Preferences is UserDefaults, a
 * plain plist that goes into iCloud backups, so SuloStore keeps the whole
 * store in its own files, excluded from backups (ios/App/App/Sulo/FileStore.swift).
 */
interface Writer {
  set(o: { key: string; value: string }): Promise<void>;
  remove(o: { key: string }): Promise<void>;
}
interface Reader {
  get(o: { key: string }): Promise<{ value: string | null }>;
  keys(): Promise<{ keys: string[] }>;
}
const SuloStore = registerPlugin<Writer & Reader>('SuloStore');
const writer = (): Writer => (Capacitor.isNativePlatform() ? SuloStore : Preferences);
const reader = (): Reader => (Capacitor.getPlatform() === 'ios' ? SuloStore : Preferences);

type Listener = (changes: Record<string, StorageChange>) => void;

export function createPreferencesStore(prefix = 'sulo:'): KeyValueStore {
  const listeners = new Set<Listener>();
  const emit = (changes: Record<string, StorageChange>) => listeners.forEach((l) => l(changes));
  const read = async <T>(key: string): Promise<T | undefined> => {
    const { value } = await reader().get({ key: prefix + key });
    if (value === null) return undefined;
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  };
  return {
    get: read,
    async set<T>(key: string, value: T) {
      const oldValue = await read(key);
      await writer().set({ key: prefix + key, value: JSON.stringify(value) });
      emit({ [key]: { oldValue, newValue: value } });
    },
    async remove(keys: string | string[]) {
      const list = Array.isArray(keys) ? keys : [keys];
      const changes: Record<string, StorageChange> = {};
      for (const key of list) {
        changes[key] = { oldValue: await read(key) };
        await writer().remove({ key: prefix + key });
      }
      emit(changes);
    },
    async keys(start: string) {
      const { keys } = await reader().keys();
      return keys.filter((k) => k.startsWith(prefix + start)).map((k) => k.slice(prefix.length));
    },
    watch(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
