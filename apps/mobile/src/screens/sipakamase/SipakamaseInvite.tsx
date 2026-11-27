// Ringkasan's "Hubungkan Sipakamase" card (1.1.0, owner 27 Nov 2026): the phone's twin of NEOSIA's invite, in
// the same place once NEOSIA is set up and the MKPK card shows (core sipakamase/invite.ts decides). "Hubungkan"
// opens the same consent sheet as Pengaturan; "Nanti saja" puts it off for 30 days, and the MKPK card's quiet
// link stays meanwhile. No mascot: Ringkasan has its own.

import { useState } from 'react';
import { sipakamaseWords } from '@sulo/core/i18n/sipakamase';
import { mkpkProgress } from '@sulo/core/mkpk/progress';
import { CHECKLIST_SOURCES } from '@sulo/core/neosia/sources';
import { mkpkCardShown, showSipakamaseInvite } from '@sulo/core/sipakamase/invite';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { useI18n } from '@sulo/ui/i18n';
import { useNeosia } from '../../neosia/NeosiaProvider';
import { useMobileData } from '../../shell/data';
import { useSipakamase } from '../../sipakamase/SipakamaseProvider';

const REQUIRED = CHECKLIST_SOURCES.filter((s) => s.checklist === 'required');

/** Whether the invite card is on Ringkasan now (the MKPK card hides its own link while it is). */
export function useSipakamaseInvite(): boolean {
  const sip = useSipakamase();
  const neo = useNeosia();
  const { data } = useMobileData();
  if (!data || sip.inviteDismissedAt === undefined) return false;
  const applies = neo.enabled && mkpkProgress(neo.snapshots, neo.mkpk).applies;
  return showSipakamaseInvite({
    moduleOn: sip.enabled,
    mkpkCardShown: mkpkCardShown({ neosiaOn: neo.enabled, applies, load: data.prefs.mkpkLoad }),
    neosiaSetupDone: REQUIRED.every((s) => neo.done.has(s.id)),
    dismissedAt: sip.inviteDismissedAt,
    now: data.now,
  });
}

export function SipakamaseInviteCard() {
  const { locale } = useI18n();
  const sw = sipakamaseWords(locale);
  const sip = useSipakamase();
  const shown = useSipakamaseInvite();
  const [busy, setBusy] = useState(false);
  if (!shown) return null;
  const later = () => {
    setBusy(true);
    void sip.laterInvite().finally(() => setBusy(false));
  };
  return (
    <Card className="mb-4" inner="space-y-3">
      <p className="text-m15 font-semibold">{sw.name}</p>
      <p className="text-m13 text-muted-foreground">{sw.invite}</p>
      <div className="flex flex-wrap gap-2">
        <PillButton kind="primary" small onPress={sip.ask}>
          {sw.connect}
        </PillButton>
        <PillButton small disabled={busy} onPress={later}>
          {sw.later}
        </PillButton>
      </div>
    </Card>
  );
}
