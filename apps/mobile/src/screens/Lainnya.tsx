// "Lainnya": the pages that do not get a tab. Jadwal and Nilai come with
// NEOSIA in M8d, so they are not listed yet.

import type { ComponentType, SVGProps } from 'react';
import { mobileDash } from '@sulo/core/i18n/mobile';
import { mobileWords } from '@sulo/core/i18n/mobile';
import { BookIcon, GearIcon, HelpIcon, InfoIcon, NewsIcon, ShieldIcon } from '@sulo/ui/dashboard-icons';
import { useI18n } from '@sulo/ui/i18n';
import { ChevronRightIcon } from '@sulo/ui/icons';
import type { Screen, ScreenName } from '../shell/nav';
import { rowButton } from './ui';

const ITEMS: { name: ScreenName; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { name: 'kabar', icon: NewsIcon },
  { name: 'mata-kuliah', icon: BookIcon },
  { name: 'pengaturan', icon: GearIcon },
  { name: 'bantuan', icon: HelpIcon },
  { name: 'tentang', icon: InfoIcon },
  { name: 'privasi', icon: ShieldIcon },
];

export function LainnyaScreen({ go }: { go: (s: Screen) => void }) {
  const { locale } = useI18n();
  const d = mobileDash(locale);
  const w = mobileWords(locale);
  const label = (name: ScreenName) => (name === 'privasi' ? w.app.privasi : d.nav[name as keyof typeof d.nav]);
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {ITEMS.map(({ name, icon: Icon }) => (
          <li key={name}>
            <button type="button" className={rowButton} onClick={() => go({ name, detail: null })}>
              <Icon className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">{label(name)}</span>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      <p className="text-center text-[12px] text-muted-foreground">{w.unofficial}</p>
    </div>
  );
}
