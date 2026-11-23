// Privasi (M8c.1, cards): the notice's title and date, a three-point
// summary in icon cards, then each section as a card (title 15 semibold,
// body 15/22). The servers section is a card of rows, one per server.

import { MOBILE_PRIVACY_INTRO, MOBILE_PRIVACY_SECTIONS, MOBILE_PRIVACY_SERVERS_HEADING, MOBILE_PRIVACY_SUMMARY, MOBILE_PRIVACY_TITLE, MOBILE_PRIVACY_UPDATED } from '@sulo/core/privacy/mobile';
import { EyeIcon, GlobeIcon, ShieldIcon } from '@sulo/ui/dashboard-icons';
import { KeyIcon } from '@sulo/ui/icons';
import { useI18n } from '@sulo/ui/i18n';
import { Card, IconTile } from '@sulo/ui/mobile/cards';
import { DocBlocks } from './Doc';

const ICONS = { key: KeyIcon, shield: ShieldIcon, eye: EyeIcon } as const;

export function PrivasiScreen() {
  const { locale } = useI18n();
  return (
    <article className="space-y-3">
      <header className="px-1 pb-1">
        <h2 className="text-m18 font-semibold">{MOBILE_PRIVACY_TITLE[locale]}</h2>
        <p className="text-m12 text-muted-foreground">{MOBILE_PRIVACY_UPDATED[locale]}</p>
      </header>
      <ul className="space-y-3">
        {MOBILE_PRIVACY_SUMMARY.map((p) => (
          <li key={p.icon}>
            <Card dense>
              <div className="flex items-center gap-3">
                <IconTile color="neutral" icon={ICONS[p.icon]} size={40} />
                <div className="min-w-0">
                  <h3 className="text-m15 font-medium">{p.title[locale]}</h3>
                  <p className="text-m13 text-muted-foreground">{p.body[locale]}</p>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <Card className="space-y-2">
        <DocBlocks blocks={MOBILE_PRIVACY_INTRO} lang={locale} />
      </Card>
      {MOBILE_PRIVACY_SECTIONS.map((s) =>
        s.heading.en === MOBILE_PRIVACY_SERVERS_HEADING ? (
          <Card key={s.heading.en}>
            <h3 className="text-m15 font-semibold">{s.heading[locale]}</h3>
            <ul className="mt-1">
              {s.blocks.flatMap((b) => (b.kind === 'p' ? [b.text] : b.items)).map((t, i) => (
                <li key={i} className="flex gap-3 py-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line">
                  <GlobeIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 text-m15r">{t[locale]}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card key={s.heading.en} className="space-y-2">
            <h3 className="text-m15 font-semibold">{s.heading[locale]}</h3>
            <DocBlocks blocks={s.blocks} lang={locale} />
          </Card>
        ),
      )}
    </article>
  );
}
