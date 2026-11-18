// The "Hubungkan NEOSIA" flow, shared by Pengaturan, the overview's invite
// card and the empty Jadwal page (M7.1): the consent dialog first, then
// Chrome's own permission prompt inside the click on "Hubungkan". Cancel or
// a refused permission leaves the module off.

import { useState } from 'react';
import { browser } from 'wxt/browser';
import { neosiaPermissionRequest } from '@/lib/neosia/browser-deps';
import type { EnableResult } from '@/lib/neosia/module';
import { connectFlow } from '@/lib/neosia/connect-flow';
import type { DashboardActions } from './data';
import { NeosiaConsent } from './NeosiaConsent';

export type ConnectNotice = 'denied' | 'failed' | null;

export function useNeosiaConnect(actions: DashboardActions) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<ConnectNotice>(null);

  const connect = () => {
    setNotice(null);
    setBusy(true);
    // Straight from the click: Chrome's own permission prompt, then the module, then the
    // NEOSIA transcript in a new active tab (connectFlow). A refused permission opens nothing.
    void connectFlow({
      requestPermission: () => browser.permissions.request(neosiaPermissionRequest()),
      enable: async () => (await actions.send({ type: 'neosia/enable' })) as EnableResult | null,
      openTab: (url) => browser.tabs.create({ url, active: true }),
    })
      .then((outcome) => setNotice(outcome === 'connected' ? null : outcome))
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
    dialog: <NeosiaConsent open={open} busy={busy} onCancel={() => setOpen(false)} onConnect={connect} />,
  };
}
