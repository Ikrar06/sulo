// "Hubungkan Sipakamase" (1.1.0): the consent dialog first, then Chrome's own
// permission prompt inside the click on "Hubungkan", then Sipakamase's home
// page in a new tab so the student signs in there. Cancel or a refused
// permission leaves the module off.

import { useState } from 'react';
import { browser } from 'wxt/browser';
import { SIPAKAMASE_PAGES } from '@sulo/core/sipakamase/allowlist';
import type { EnableResult } from '@sulo/core/sipakamase/module';
import { sipakamasePermissionRequest } from '@/src/platform/sipakamase';
import type { DashboardActions } from './data';
import { SipakamaseConsent } from './SipakamaseConsent';

export type SipakamaseNotice = 'denied' | 'failed' | null;

export function useSipakamaseConnect(actions: DashboardActions) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<SipakamaseNotice>(null);

  const connect = () => {
    setNotice(null);
    setBusy(true);
    void (async (): Promise<SipakamaseNotice> => {
      let granted: boolean;
      try {
        granted = await browser.permissions.request(sipakamasePermissionRequest());
      } catch {
        return 'failed';
      }
      if (!granted) return 'denied';
      const result = (await actions.send({ type: 'sipakamase/enable' }).catch(() => null)) as EnableResult | null;
      if (result !== 'enabled') return result === 'no_permission' ? 'denied' : 'failed';
      await browser.tabs.create({ url: SIPAKAMASE_PAGES.kegiatan, active: true }).catch(() => undefined);
      return null;
    })()
      .then(setNotice)
      .finally(() => {
        setBusy(false);
        setOpen(false);
      });
  };

  return {
    open,
    busy,
    notice,
    start: () => setOpen(true),
    dialog: <SipakamaseConsent open={open} busy={busy} onCancel={() => setOpen(false)} onConnect={connect} />,
  };
}
