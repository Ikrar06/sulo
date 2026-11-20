// The reminders read only NEOSIA's schedule records from the encrypted store
// (M8e 0c): the class schedule, the KRS dates and the course links; a grade
// snapshot is never even asked for.
import { describe, expect, it } from 'vitest';
import { REMINDER_NEOSIA_KEYS, remindersNeosia } from '../src/reminders';
import type { KeyValueStore } from '@sulo/core/types';

function store(values: Record<string, unknown>): KeyValueStore & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    get: async <T,>(k: string) => (asked.push(k), values[k] as T | undefined),
    set: async () => undefined,
    remove: async () => undefined,
    keys: async () => Object.keys(values),
  };
}

describe('reminders and NEOSIA', () => {
  it('only the schedule, the KRS dates and the course links are read', async () => {
    const s = store({ 'neosia:snap:belanja_krs': { v: 2 }, 'neosia:snap:getTranskripMahasiswa': { v: 2 }, 'neosia:snap:dashboard': { v: 2 }, 'neosia:courseMap': {} });
    const got = await remindersNeosia(s);
    expect(Object.keys(got).sort()).toEqual(['neosia:courseMap', 'neosia:snap:belanja_krs']);
    expect(s.asked).toEqual([...REMINDER_NEOSIA_KEYS]);
    expect(s.asked.some((k) => /Transkrip|kartu_hasil_studi|indeks_prestasi|dashboard/.test(k))).toBe(false);
  });

  it('an unreadable store gives nothing, not an error', async () => {
    const broken: KeyValueStore = { ...store({}), get: async () => Promise.reject(new Error('user missing')) };
    expect(await remindersNeosia(broken)).toEqual({});
  });
});
