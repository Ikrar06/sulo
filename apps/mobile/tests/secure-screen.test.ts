// FLAG_SECURE (M8e E2): on with the first screen showing grades, off only
// after the last one closes; a double release never switches it off early.
import { describe, expect, it } from 'vitest';
import { secureHolder } from '../src/neosia/secure-screen';

describe('secureHolder', () => {
  it('on at the first hold, off after the last release', () => {
    const calls: boolean[] = [];
    const h = secureHolder({ secure: async ({ on }) => void calls.push(on) });
    const nilai = h.hold();
    const studi = h.hold();
    expect(calls).toEqual([true]);
    nilai();
    nilai(); // twice: counted once
    expect(calls).toEqual([true]);
    expect(h.holds).toBe(1);
    studi();
    expect(calls).toEqual([true, false]);
    expect(h.holds).toBe(0);
  });

  it('a failing native switch is not an error for the screen', async () => {
    const h = secureHolder({ secure: async () => Promise.reject(new Error('no activity')) });
    expect(() => h.hold()()).not.toThrow();
  });
});
