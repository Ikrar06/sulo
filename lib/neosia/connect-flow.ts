// "Hubungkan" after the consent dialog (M7.1). Pure, the browser calls are
// injected (tests/neosia-sources.test.ts). All of it runs from the user's
// click: Chrome's permission prompt, turning the module on, then opening
// the NEOSIA transcript in a new active tab so its data comes in. A refused
// permission opens nothing. Sulo never closes or touches that tab.

import { NEOSIA_TRANSKRIP } from '../links';

export type ConnectOutcome = 'connected' | 'denied' | 'failed';

export async function connectFlow(deps: {
  requestPermission: () => Promise<boolean>;
  enable: () => Promise<'enabled' | 'no_permission' | 'failed' | null>;
  openTab: (url: string) => Promise<unknown>;
}): Promise<ConnectOutcome> {
  let granted: boolean;
  try {
    granted = await deps.requestPermission();
  } catch {
    return 'failed';
  }
  if (!granted) return 'denied';
  const result = await deps.enable().catch(() => 'failed' as const);
  if (result !== 'enabled') return result === 'no_permission' ? 'denied' : 'failed';
  await deps.openTab(NEOSIA_TRANSKRIP).catch(() => undefined);
  return 'connected';
}
