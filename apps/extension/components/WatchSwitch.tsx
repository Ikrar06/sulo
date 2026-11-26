// "Pantau tugas baru" as one switch row with its explanation, shared by the
// settings, the setup's last step and "Yang baru di Sulo". The choice is
// stored by the service worker (message watch/set), which also moves the
// alarm. `defaultOn`: the setup turns it on for a new install that has
// never chosen, and the user can turn it off right there.

import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { useI18n } from '@sulo/ui/i18n';
import { SwitchRow } from '@sulo/ui/ui/switch-row';
import { watchWords } from '@sulo/core/i18n/watch';
import { readRemoteConfig } from '@sulo/core/remote/remote-config';
import { EXTENSION_WATCH_KEY, readExtensionWatch, watchInForce } from '@sulo/core/watch/extension';
import { createWatchedStore } from '@/src/platform/store';

const local = createWatchedStore(browser.storage.local, 'local');

export function WatchSwitch({ defaultOn = false, compact = false }: { defaultOn?: boolean; compact?: boolean }) {
  const { locale } = useI18n();
  const w = watchWords(locale);
  const [state, setState] = useState<{ chosen: boolean; stopped: boolean } | null>(null);

  useEffect(() => {
    const read = async () => {
      const stored = await readExtensionWatch(local);
      if (defaultOn && stored.changedAt === null) {
        await browser.runtime.sendMessage({ type: 'watch/set', enabled: true });
        return;
      }
      const force = watchInForce(stored, await readRemoteConfig(local));
      setState({ chosen: force.chosen, stopped: force.stoppedRemotely });
    };
    void read();
    return local.watch((changes) => {
      if (EXTENSION_WATCH_KEY in changes || 'global:remoteConfig' in changes) void read();
    });
  }, [defaultOn]);

  if (state === null) return null;
  return (
    <div>
      <SwitchRow checked={state.chosen} disabled={state.stopped} onChange={(enabled) => void browser.runtime.sendMessage({ type: 'watch/set', enabled })}>
        {w.title}
      </SwitchRow>
      <p className="mt-1 max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{state.stopped ? w.stopped : w.body}</p>
      {!compact && !state.stopped && (
        <ul className="mt-1 max-w-[68ch] space-y-1 text-[12px] leading-normal text-muted-foreground">
          <li>{w.session}</li>
          <li>{w.closed}</li>
        </ul>
      )}
      {compact && !state.stopped && <p className="mt-1 max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{w.session}</p>}
    </div>
  );
}
