// The Sipakamase consent on the phone (1.1.0): SIPAKAMASE_CONSENT, the same
// object the privacy page shows, in a sheet. "Hubungkan" turns the module on
// and opens Sipakamase's own sign-in screen; "Nanti saja" changes nothing.

import { useState } from 'react';
import { sipakamaseWords } from '@sulo/core/i18n/sipakamase';
import { SIPAKAMASE_CONSENT as C } from '@sulo/core/privacy/content';
import { useI18n } from '@sulo/ui/i18n';
import { PillButton } from '@sulo/ui/mobile/controls';
import { Sheet } from '@sulo/ui/mobile/sheet';
import type { ConnectResult } from './service';

export function SipakamaseConsentSheet({ open, onClose, onConnect }: { open: boolean; onClose: () => void; onConnect: () => Promise<ConnectResult> }) {
  const { locale: l } = useI18n();
  const w = sipakamaseWords(l);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && !busy && onClose()} title={C.title[l]}>
      <div className="space-y-4">
        <p className="text-m15r">{C.how[l]}</p>
        <ul className="list-disc space-y-2 pl-5 text-m13 text-muted-foreground">
          {C.kept.map((t) => (
            <li key={t.id}>{t[l]}</li>
          ))}
        </ul>
        <div>
          <p className="text-m13 font-semibold">{C.droppedTitle[l]}</p>
          <p className="mt-1 text-m13 text-muted-foreground">{C.dropped.map((t) => t[l]).join(', ')}.</p>
        </div>
        <p className="text-m13 text-muted-foreground">{C.off[l]}</p>
        <p className="text-m12 text-muted-foreground">{C.unofficial[l]}</p>
        {note && (
          <p role="status" className="text-m13">
            {note}
          </p>
        )}
        <div className="space-y-2">
          <PillButton
            kind="primary"
            full
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              setNote(null);
              try {
                const r = await onConnect();
                if (r !== 'connected') setNote(r === 'offline' ? w.offline : w.notSignedIn);
              } finally {
                setBusy(false);
              }
            }}
          >
            {w.connect}
          </PillButton>
          <PillButton full disabled={busy} onPress={onClose}>
            {w.later}
          </PillButton>
        </div>
      </div>
    </Sheet>
  );
}
