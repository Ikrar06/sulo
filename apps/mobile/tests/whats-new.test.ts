import { describe, expect, it } from 'vitest';
import { pendingWhatsNew, WHATS_NEW } from '@sulo/core/onboarding/whats-new';
import { NOTICE_VERSION } from '@sulo/core/storage';
import type { KeyValueStore } from '@sulo/core/platform';
import { markWhatsNewRead, readWhatsNewVersion, WHATS_NEW_READ_KEY } from '../src/WhatsNew';

function store(initial: Record<string, unknown> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    get: async <T,>(k: string) => data.get(k) as T | undefined,
    set: async (k: string, v: unknown) => void data.set(k, v),
    remove: async (keys: string | string[]) => void (Array.isArray(keys) ? keys : [keys]).forEach((k) => data.delete(k)),
    keys: async (prefix: string) => [...data.keys()].filter((k) => k.startsWith(prefix)),
  };
}

describe("what's new on the phone", () => {
  it('counts an install from before 1.1.0 as having read version 1, and a marked one as current', async () => {
    expect(await readWhatsNewVersion(store())).toBe(1);
    const s = store();
    await markWhatsNewRead(s);
    expect(await readWhatsNewVersion(s)).toBe(NOTICE_VERSION);
    expect(await readWhatsNewVersion(store({ [WHATS_NEW_READ_KEY]: 'x' }))).toBe(1);
  });

  it("shows the phone's entries only: the extension's watch switch is left out", () => {
    const phone = pendingWhatsNew(WHATS_NEW, 1, true, 'android');
    expect(phone.length).toBeGreaterThan(0);
    expect(phone.some((e) => e.action === 'watch')).toBe(false);
    expect(pendingWhatsNew(WHATS_NEW, 1, true, 'extension').some((e) => e.action === 'watch')).toBe(true);
    expect(pendingWhatsNew(WHATS_NEW, NOTICE_VERSION, true, 'android')).toEqual([]);
  });
});
