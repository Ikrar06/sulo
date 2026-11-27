import { describe, expect, it } from 'vitest';
import { dismissSipakamaseInvite, mkpkCardShown, readSipakamaseInvite, showSipakamaseInvite, SIPAKAMASE_INVITE_KEY } from '@sulo/core/sipakamase/invite';
import { memoryStore } from './helpers';

const NOW = Date.UTC(2026, 10, 27, 4, 0) / 1000;
const DAY = 86_400;

describe('the "Hubungkan Sipakamase" card', () => {
  it('only while Sipakamase is off and the MKPK card shows', () => {
    const base = { moduleOn: false, mkpkCardShown: true, neosiaSetupDone: true, dismissedAt: null, now: NOW };
    expect(showSipakamaseInvite(base)).toBe(true);
    expect(showSipakamaseInvite({ ...base, moduleOn: true })).toBe(false);
    // No MKPK card (NEOSIA off, no MKPK, load "none"): connecting would show nothing.
    expect(showSipakamaseInvite({ ...base, mkpkCardShown: false })).toBe(false);
    // Never beside NEOSIA's checklist: one setup card at a time.
    expect(showSipakamaseInvite({ ...base, neosiaSetupDone: false })).toBe(false);
  });
  it('"Nanti saja" hides it for 30 days', () => {
    const base = { moduleOn: false, mkpkCardShown: true, neosiaSetupDone: true, now: NOW };
    expect(showSipakamaseInvite({ ...base, dismissedAt: NOW - 29 * DAY })).toBe(false);
    expect(showSipakamaseInvite({ ...base, dismissedAt: NOW - 30 * DAY })).toBe(true);
  });
  it('the MKPK card shows with NEOSIA on, MKPK that applies, and a load other than "none"', () => {
    expect(mkpkCardShown({ neosiaOn: true, applies: true, load: null })).toBe(true);
    expect(mkpkCardShown({ neosiaOn: true, applies: true, load: 20 })).toBe(true);
    expect(mkpkCardShown({ neosiaOn: false, applies: true, load: 20 })).toBe(false);
    expect(mkpkCardShown({ neosiaOn: true, applies: false, load: 20 })).toBe(false);
    expect(mkpkCardShown({ neosiaOn: true, applies: true, load: 'none' })).toBe(false);
  });
  it('keeps the dismissal, and reads a damaged one as never dismissed', async () => {
    const store = memoryStore();
    expect(await readSipakamaseInvite(store)).toEqual({ dismissedAt: null });
    await dismissSipakamaseInvite(store, NOW);
    expect(await readSipakamaseInvite(store)).toEqual({ dismissedAt: NOW });
    expect(await readSipakamaseInvite(memoryStore({ [SIPAKAMASE_INVITE_KEY]: { dismissedAt: 'kemarin' } }))).toEqual({ dismissedAt: null });
  });
});
