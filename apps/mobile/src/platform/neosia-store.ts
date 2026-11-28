// core's NEOSIA code reads and writes one KeyValueStore. On Android its data
// (keys under "neosia:") goes to the native NeosiaStore: encrypted value by
// value with a Keystore key of its own, one file per SIKOLA account (M8d B2).
// Every other key (the module's on/off state, the remote config) stays in
// the app's store. No current account: NEOSIA data is neither read nor
// written.

import { NEOSIA_DATA_PREFIX } from '@sulo/core/neosia/module';
import type { KeyValueStore, StorageChange } from '@sulo/core/platform';
import { currentUser } from '@sulo/core/storage';

export interface NeosiaNative {
  storeGet(o: { user: number; key: string }): Promise<{ value: string | null }>;
  storeSet(o: { user: number; key: string; value: string }): Promise<void>;
  storeRemove(o: { user: number; keys: string[] }): Promise<void>;
  storeKeys(o: { user: number; prefix: string }): Promise<{ keys: string[] }>;
}

/** NEOSIA's keys in its encrypted store (the wrapper below, with NEOSIA's prefix). */
export const createNeosiaStore = (main: KeyValueStore, native: NeosiaNative): KeyValueStore => createEncryptedStore(main, native, NEOSIA_DATA_PREFIX);

/**
 * Keys under `prefix` go to a native encrypted store, one file per SIKOLA
 * account; every other key stays in `main`. Sipakamase (1.1.0) uses the same
 * wrapper with its own prefix and its own native store and key.
 */
export function createEncryptedStore(main: KeyValueStore, native: NeosiaNative, prefix: string): KeyValueStore {
  const isNeosia = (key: string) => key.startsWith(prefix);
  const NEOSIA_DATA_PREFIX = prefix;
  const user = () => currentUser(main);
  return {
    async get<T>(key: string): Promise<T | undefined> {
      if (!isNeosia(key)) return main.get<T>(key);
      const u = await user();
      if (u === null) return undefined;
      const { value } = await native.storeGet({ user: u, key });
      if (value === null) return undefined;
      try {
        return JSON.parse(value) as T;
      } catch {
        return undefined;
      }
    },
    async set<T>(key: string, value: T): Promise<void> {
      if (!isNeosia(key)) return main.set(key, value);
      const u = await user();
      if (u === null) return;
      await native.storeSet({ user: u, key, value: JSON.stringify(value) });
    },
    async remove(keys: string | string[]): Promise<void> {
      const list = Array.isArray(keys) ? keys : [keys];
      const neosia = list.filter(isNeosia);
      const rest = list.filter((k) => !isNeosia(k));
      if (rest.length) await main.remove(rest);
      const u = await user();
      if (neosia.length && u !== null) await native.storeRemove({ user: u, keys: neosia });
    },
    async keys(start: string): Promise<string[]> {
      const fromMain = (await main.keys(start)).filter((k) => !isNeosia(k));
      if (!isNeosia(start) && !NEOSIA_DATA_PREFIX.startsWith(start)) return fromMain;
      const u = await user();
      if (u === null) return fromMain;
      const { keys } = await native.storeKeys({ user: u, prefix: isNeosia(start) ? start : NEOSIA_DATA_PREFIX });
      return [...fromMain, ...keys.filter((k) => k.startsWith(start))];
    },
    watch(listener: (changes: Record<string, StorageChange>) => void) {
      // NEOSIA data changes only through this store's own writes (the screens re-read after a capture).
      return main.watch(listener);
    },
  };
}
