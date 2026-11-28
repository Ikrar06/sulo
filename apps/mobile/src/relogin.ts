// Which sources besides SIKOLA need signing in again (owner's decision of 26 Nov 2026): the morning
// summary's offer (reminders.ts) and the one "Masuk lagi" sequence (shell/AppShell.tsx). Read from the
// phone's own records; no request.
import { readModuleState } from '@sulo/core/neosia/module';
import { NEOSIA_SESSION_LOG_KEY, type NeosiaSessionEntry } from '@sulo/core/neosia/session-log';
import type { Platform } from '@sulo/core/platform';
import { readConnection } from '@sulo/core/sipakamase/connection';
import { readSipakamaseModule } from '@sulo/core/sipakamase/module';
import { createNeosiaStore } from './platform/neosia-store';
import { SuloNeosia } from './neosia-native';
import { sipakamaseStore } from './sipakamase/service';

/**
 * The other sources whose session ended, for the morning offer (owner's decision of 26 Nov 2026): Sipakamase
 * when its connection asks to sign in again, NEOSIA when its module is on and the last page Sulo saw was its
 * login. Read from the phone's own records; no request.
 */
export async function endedSources(platform: Platform): Promise<string[]> {
  const out: string[] = [];
  const sip = sipakamaseStore(platform);
  const sipOn = (await readSipakamaseModule(sip).catch(() => null))?.enabled === true;
  if (sipOn && (await readConnection(sip, true).catch(() => null))?.state === 'needs_login') out.push('Sipakamase');
  if ((await readModuleState(platform.store).catch(() => null))?.enabled) {
    const log = (await createNeosiaStore(platform.store, SuloNeosia).get<NeosiaSessionEntry[]>(NEOSIA_SESSION_LOG_KEY).catch(() => undefined)) ?? [];
    if (log[log.length - 1]?.event === 'needs_login') out.push('NEOSIA');
  }
  return out;
}
