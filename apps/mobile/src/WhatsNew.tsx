// "Yang baru di Sulo" on the phone (1.1.0): one sheet, once, the first time
// the app opens after an update that brought entries (core
// onboarding/whats-new.ts, the same list as the extension's, filtered for
// Android). A new install marks the current version as read when its
// onboarding finishes, so it never sees the sheet. An install from before
// this sheet existed has no mark and counts as having read version 1.

import { useEffect, useState } from 'react';
import { entryText, pendingWhatsNew, WHATS_NEW, type WhatsNewEntry } from '@sulo/core/onboarding/whats-new';
import type { KeyValueStore } from '@sulo/core/platform';
import { NOTICE_VERSION } from '@sulo/core/storage';
import { PillButton } from '@sulo/ui/mobile/controls';
import { Sheet } from '@sulo/ui/mobile/sheet';
import { useI18n } from '@sulo/ui/i18n';

export const WHATS_NEW_READ_KEY = 'mobile:whatsNewRead';

/** The notice version this phone has read; 1 for an install from before 1.1.0. */
export async function readWhatsNewVersion(store: KeyValueStore): Promise<number> {
  const v = await store.get<number>(WHATS_NEW_READ_KEY);
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 1;
}

export const markWhatsNewRead = (store: KeyValueStore) => store.set(WHATS_NEW_READ_KEY, NOTICE_VERSION);

export function WhatsNewSheet({ store }: { store: KeyValueStore }) {
  const { m, locale } = useI18n();
  const [entries, setEntries] = useState<WhatsNewEntry[]>([]);

  useEffect(() => {
    void readWhatsNewVersion(store).then((read) => setEntries(pendingWhatsNew(WHATS_NEW, read, true, 'android')));
  }, [store]);

  const close = () => {
    setEntries([]);
    void markWhatsNewRead(store);
  };

  return (
    <Sheet open={entries.length > 0} onOpenChange={(open) => !open && close()} title={m.onboarding.whatsNew.title}>
      <div className="space-y-5">
        <ul className="space-y-4">
          {entries.map((e) => (
            <li key={e.id} className="space-y-1">
              <p className="text-m15 font-semibold">{entryText(e, locale).title}</p>
              <p className="text-m15r text-muted-foreground">{entryText(e, locale).body}</p>
            </li>
          ))}
        </ul>
        <PillButton kind="primary" full onPress={close}>
          {m.onboarding.whatsNew.ok}
        </PillButton>
      </div>
    </Sheet>
  );
}
