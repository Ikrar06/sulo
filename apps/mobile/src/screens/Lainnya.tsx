// Lainnya (M8c.1, cards): a profile card (the mascot, "Terhubung ke
// SIKOLA", when it was updated, a small Keluar pill that asks first), a
// two-column grid of tiles for the other pages (Kabar terbaru carries its
// unseen count), an "Akademik" pair (Jadwal, Nilai) once NEOSIA is
// connected (M8d), a short "Dukung Sulo" card, and the disclaimer last.

import { useState, type ComponentType, type SVGProps } from 'react';
import { formatAgo } from '@sulo/core/format/time';
import { FEEDBACK_FORM_URL, isShownLink, TRAKTEER_URL } from '@sulo/core/links';
import { mobileDash, mobileWords } from '@sulo/core/i18n/mobile';
import { neosiaWords } from '@sulo/core/i18n/neosia';
import { BookIcon, ClockIcon, GearIcon, GradeIcon, HelpIcon, InfoIcon, NewsIcon, ShieldIcon } from '@sulo/ui/dashboard-icons';
import { useI18n } from '@sulo/ui/i18n';
import { SuloMascot } from '@sulo/ui/mascot/SuloMascot';
import { Card, IconTile } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import type { TintColor } from '@sulo/ui/mobile/tint';
import { SignOutSheet } from './SignOutSheet';
import { useMobileData } from '../shell/data';
import { useNeosia } from '../neosia/NeosiaProvider';
import type { Screen, ScreenName } from '../shell/nav';

const ITEMS: { name: ScreenName; icon: ComponentType<SVGProps<SVGSVGElement>>; tint: TintColor }[] = [
  { name: 'kabar', icon: NewsIcon, tint: 'course-5' },
  { name: 'mata-kuliah', icon: BookIcon, tint: 'course-3' },
  { name: 'pengaturan', icon: GearIcon, tint: 'neutral' },
  { name: 'bantuan', icon: HelpIcon, tint: 'course-7' },
  { name: 'tentang', icon: InfoIcon, tint: 'course-2' },
  { name: 'privasi', icon: ShieldIcon, tint: 'course-6' },
];

type Item = (typeof ITEMS)[number];
const ACADEMIC: Item[] = [
  { name: 'jadwal', icon: ClockIcon, tint: 'course-4' },
  { name: 'nilai', icon: GradeIcon, tint: 'course-1' },
];

export function LainnyaScreen({ go, onSignedOut }: { go: (s: Screen) => void; onSignedOut: () => void }) {
  const { m, locale } = useI18n();
  const d = mobileDash(locale);
  const w = mobileWords(locale);
  const { data } = useMobileData();
  const [confirm, setConfirm] = useState(false);
  const neo = useNeosia();
  const label = (name: ScreenName) => (name === 'privasi' ? w.app.privasi : d.nav[name as keyof typeof d.nav]);
  const last = data?.view.lastSyncAt ?? null;
  const unseen = data?.view.updatesUnseen ?? 0;

  return (
    <div className="space-y-6">
      <Card hero className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-m-inset" aria-hidden="true">
          <SuloMascot mood="neutral" size={40} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-m15 font-semibold">{w.connected.title}</p>
          <p className="truncate text-m13 text-muted-foreground">{last === null ? w.connected.never : w.connected.updated(formatAgo(last, data!.now, m))}</p>
        </div>
        <PillButton small onPress={() => setConfirm(true)}>
          {w.connected.signOut}
        </PillButton>
      </Card>

      <TileGrid items={ITEMS} go={go} label={label} unseen={unseen} />

      {neo.enabled && (
        <section aria-labelledby="akademik-title" className="space-y-3">
          <h2 id="akademik-title" className="text-m15 font-semibold">
            {neosiaWords(locale).mobile.akademik}
          </h2>
          <TileGrid items={ACADEMIC} go={go} label={label} unseen={0} />
        </section>
      )}

      {(isShownLink(TRAKTEER_URL) || isShownLink(FEEDBACK_FORM_URL)) && (
        <Card>
          <h2 className="text-m15 font-semibold">{d.tentang.supportTitle}</h2>
          <p className="mt-1 text-m13 text-muted-foreground">{d.tentang.supportNote}</p>
          <div className="mt-3 flex gap-2">
            {isShownLink(TRAKTEER_URL) && (
              <PillButton kind="primary" small href={TRAKTEER_URL}>
                {d.tentang.coffee}
                <span className="sr-only"> {d.tentang.coffeeHint}</span>
              </PillButton>
            )}
            {isShownLink(FEEDBACK_FORM_URL) && (
              <PillButton small href={FEEDBACK_FORM_URL}>
                {d.tentang.feedback}
              </PillButton>
            )}
          </div>
        </Card>
      )}

      <p className="text-center text-m12 font-normal text-muted-foreground">{w.unofficial}</p>

      <SignOutSheet open={confirm} onOpenChange={setConfirm} onSignedOut={onSignedOut} />
    </div>
  );
}

function TileGrid({ items, go, label, unseen }: { items: Item[]; go: (s: Screen) => void; label: (n: ScreenName) => string; unseen: number }) {
  return (
        <ul className="grid grid-cols-2 gap-3">
          {items.map(({ name, icon, tint }) => (
            <li key={name}>
              {/* As tall as its icon and label: the whole page, Dukung Sulo and the disclaimer included, sits close. */}
              <Card dense onPress={() => go({ name, detail: null })} label={name === 'kabar' && unseen > 0 ? `${label(name)}, ${unseen}` : label(name)} className="h-full">
                <div className="flex items-start justify-between">
                  <IconTile color={tint} icon={icon} size={36} />
                  {name === 'kabar' && unseen > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-m-inset px-2 text-m12 tabular-nums">{unseen > 99 ? '99+' : unseen}</span>}
                </div>
                <p className="mt-2 text-m15">{label(name)}</p>
              </Card>
            </li>
          ))}
        </ul>
  );
}
