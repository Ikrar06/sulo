// One source of truth for the SIKOLA session on the phone: the native vault.
// Core keeps its own state (global:session) for its gates and the screens;
// on every open it is brought back in line with the vault, so a stored
// "EXPIRED" can never ask for a sign-in while the vault still holds a session
// (20 Nov 2026: core had marked EXPIRED from a page redirect, the vault was fine).

import { readSession, writeSession } from '@sulo/core/moodle/session';
import type { Platform } from '@sulo/core/platform';
import type { SessionStatus } from './session';

/** What changed in core's state, for the session history; null when nothing did. */
export async function alignSession(platform: Pick<Platform, 'store' | 'clock'>, vault: SessionStatus): Promise<'core_expired_cleared' | 'core_expired_from_vault' | null> {
  const core = await readSession(platform.store);
  if (vault === 'connected' && core.state === 'EXPIRED') {
    // The first check decides again (and core asks twice before anything ends).
    await writeSession(platform.store, platform.clock, 'UNKNOWN');
    return 'core_expired_cleared';
  }
  if (vault === 'expired' && core.state !== 'EXPIRED') {
    await writeSession(platform.store, platform.clock, 'EXPIRED');
    return 'core_expired_from_vault';
  }
  return null;
}
