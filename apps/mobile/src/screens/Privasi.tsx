// Privasi: the Android app's own notice (core privacy/mobile.ts).
import { MOBILE_PRIVACY_INTRO, MOBILE_PRIVACY_SECTIONS, MOBILE_PRIVACY_TITLE, MOBILE_PRIVACY_UPDATED } from '@sulo/core/privacy/mobile';
import { useI18n } from '@sulo/ui/i18n';
import { DocBlocks } from './Doc';

export function PrivasiScreen() {
  const { locale } = useI18n();
  return (
    <article className="space-y-4">
      <header>
        <h2 className="text-m18">{MOBILE_PRIVACY_TITLE[locale]}</h2>
        <p className="text-m12 font-normal text-muted-foreground">{MOBILE_PRIVACY_UPDATED[locale]}</p>
      </header>
      <DocBlocks blocks={MOBILE_PRIVACY_INTRO} lang={locale} />
      {MOBILE_PRIVACY_SECTIONS.map((s) => (
        <section key={s.heading.en} className="space-y-2 rounded-card border border-border bg-surface p-4">
          <h3 className="text-m15 font-semibold">{s.heading[locale]}</h3>
          <DocBlocks blocks={s.blocks} lang={locale} />
        </section>
      ))}
    </article>
  );
}
