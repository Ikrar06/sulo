// Lainnya (M8c.1, cards): a profile card (the mascot, "Terhubung ke
// SIKOLA", when it was updated, a small Keluar pill that asks first), a
// two-column grid of tiles for the other pages (Kabar terbaru carries its
// unseen count), and the disclaimer. Jadwal and Nilai come with NEOSIA (M8d).

import { useState, type ComponentType, type SVGProps } from 'react';
import { formatAgo } from '@sulo/core/format/time';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import { BookIcon, GearIcon, HelpIcon, InfoIcon, NewsIcon, ShieldIcon } from '@sulo/ui/dashboard-icons';
import { useI18n } from '@sulo/ui/i18n';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import { Card, IconTile } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import type { TintColor } from '@sulo/ui/mobile/tint';
import { SignOutSheet } from './SignOutSheet';
import { useMobileData } from '../shell/data';
import type { Screen, ScreenName } from '../shell/nav';

const ITEMS: { name: ScreenName; icon: ComponentType<SVGProps<SVGSVGElement>>; tint: TintColor }[] = [
  { name: 'kabar', icon: NewsIcon, tint: 'course-5' },
  { name: 'mata-kuliah', icon: BookIcon, tint: 'course-3' },
  { name: 'pengaturan', icon: GearIcon, tint: 'neutral' },
  { name: 'bantuan', icon: HelpIcon, tint: 'course-7' },
  { name: 'tentang', icon: InfoIcon, tint: 'course-2' },
  { name: 'privasi', icon: ShieldIcon, tint: 'course-6' },
];

export function LainnyaScreen({ go, onSignedOut }: { go: (s: Screen) => void; onSignedOut: () => void }) {
  const { m, locale } = useI18n();
  const d = mobileDash(locale);
  const w = mobileWords(locale);
  const { data } = useMobileData();
  const [confirm, setConfirm] = useState(false);
  const label = (name: ScreenName) => (name === 'privasi' ? w.app.privasi : d.nav[name as keyof typeof d.nav]);
  const last = data?.view.lastSyncAt ?? null;
  const unseen = data?.view.updatesUnseen ?? 0;

  return (
    <div className="space-y-6">
      <Card hero className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-m-inset" aria-hidden="true">
          <Mascot state="idle" size={40} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-m15 font-semibold">{w.connected.title}</p>
          <p className="truncate text-m13 text-muted-foreground">{last === null ? w.connected.never : w.connected.updated(formatAgo(last, data!.now, m))}</p>
        </div>
        <PillButton small onPress={() => setConfirm(true)}>
          {w.connected.signOut}
        </PillButton>
      </Card>

      <ul className="grid grid-cols-2 gap-3">
        {ITEMS.map(({ name, icon, tint }) => (
          <li key={name}>
            <Card onPress={() => go({ name, detail: null })} label={name === 'kabar' && unseen > 0 ? `${label(name)}, ${unseen}` : label(name)} className="h-full">
              <div className="flex items-start justify-between">
                <IconTile color={tint} icon={icon} size={40} />
                {name === 'kabar' && unseen > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-m-inset px-2 text-m12 tabular-nums">{unseen > 99 ? '99+' : unseen}</span>}
              </div>
              <p className="mt-3 text-m15">{label(name)}</p>
            </Card>
          </li>
        ))}
      </ul>

      <p className="text-center text-m12 font-normal text-muted-foreground">{w.unofficial}</p>

      <SignOutSheet open={confirm} onOpenChange={setConfirm} onSignedOut={onSignedOut} />
    </div>
  );
}
