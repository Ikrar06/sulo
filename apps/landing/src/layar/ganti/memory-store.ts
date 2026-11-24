import type { KeyValueStore, StorageChange } from '@sulo/core/platform';
export function memoryStore(seed: Record<string, unknown> = {}): KeyValueStore {
  const map = new Map<string, unknown>(Object.entries(seed));
  const listeners = new Set<(c: Record<string, StorageChange>) => void>();
  return {
    get: async <T,>(k: string) => (map.has(k) ? (structuredClone(map.get(k)) as T) : undefined),
    set: async <T,>(k: string, v: T) => {
      const oldValue = map.get(k);
      map.set(k, structuredClone(v));
      listeners.forEach((l) => l({ [k]: { oldValue, newValue: v } }));
    },
    remove: async (keys) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) map.delete(k);
    },
    keys: async (prefix) => [...map.keys()].filter((k) => k.startsWith(prefix)),
    watch: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}
