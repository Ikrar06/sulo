// The "Hubungkan NEOSIA" flow, shared by Pengaturan, the overview's invite
// card and the empty Jadwal page (M7.1): the consent dialog first, then
// Chrome's own permission prompt inside the click on "Hubungkan". Cancel or
// a refused permission leaves the module off.

import { useState } from 'react';
import { browser } from 'wxt/browser';
import { neosiaPermissionRequest } from '@/lib/neosia/browser-deps';
import type { EnableResult } from '@/lib/neosia/module';
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
    // Straight from the click: Chrome shows its own permission prompt now.
    void browser.permissions
      .request(neosiaPermissionRequest())
      .then(async (granted) => {
        if (!granted) {
          setNotice('denied');
          return;
        }
        const result = (await actions.send({ type: 'neosia/enable' })) as EnableResult | null;
        if (result !== 'enabled') setNotice(result === 'no_permission' ? 'denied' : 'failed');
      })
      .catch(() => setNotice('failed'))
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
