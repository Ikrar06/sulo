import { useEffect } from 'react';
import { useI18n } from '@/components/i18n';
import { ChevronDownIcon, ExternalIcon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { DocLayout } from '@/components/ui/doc-layout';
import { FAQ, HOW_IT_WORKS } from '@/lib/help/content';
import { FEEDBACK_FORM_URL, isShownLink } from '@/lib/links';
import { Card } from '../Shell';
import type { PageProps } from '../types';

const secondary =
  'inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-[14px] font-medium outline-none hover:bg-surface-raised focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-offset-2 focus-ring:ring-offset-background';

/** How Sulo works and the FAQ, from lib/help/content.ts (bundled; works offline). Document layout: text at 68ch, aside with contents. */
export function BantuanPage({ d, route }: PageProps) {
  const { locale } = useI18n();
  const b = d.bantuan;

  // #bantuan/<id> opens that question and brings it into view.
  useEffect(() => {
    if (!route.detail) return;
    const el = document.getElementById(`faq-${route.detail}`) as HTMLDetailsElement | null;
    if (el) {
      el.open = true;
      el.scrollIntoView({ block: 'start' });
    }
  }, [route.detail]);

  const toc = [...HOW_IT_WORKS.map((s, i) => ({ id: `cara-${i + 1}`, label: s.heading[locale] })), { id: 'faq', label: b.faqTitle }];

  const stuck = isShownLink(FEEDBACK_FORM_URL) ? (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-3">
        <Mascot state="idle" size={40} still />
        <p className="text-[14px] font-semibold">{b.stuckTitle}</p>
      </div>
      <p className="mt-2 text-[12px] leading-normal text-muted-foreground">{b.stuckBody}</p>
      <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer" className={`${secondary} mt-3`}>
        {b.feedback}
        <ExternalIcon className="size-3.5 text-muted-foreground" />
      </a>
    </div>
  ) : null;

  return (
    <DocLayout toc={toc} tocLabel={b.onThisPage} aside={stuck}>
      <Card title={b.howTitle}>
        <div className="space-y-6">
          {HOW_IT_WORKS.map((s, i) => (
            <section key={s.heading.id} id={`cara-${i + 1}`} className="space-y-2">
              <h3 className="text-[14px] font-semibold">{s.heading[locale]}</h3>
              {s.paragraphs.map((p) => (
                <p key={p.id} className="text-[14px] leading-normal">
                  {p[locale]}
                </p>
              ))}
            </section>
          ))}
        </div>
      </Card>
      <section id="faq">
        <Card title={b.faqTitle}>
          <div className="divide-y divide-border">
            {FAQ.map((f) => (
              <details key={f.id} id={`faq-${f.id}`} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md py-3 text-[14px] font-semibold outline-none focus-ring:ring-2 focus-ring:ring-focus [&::-webkit-details-marker]:hidden">
                  <span className="flex-1">{f.q[locale]}</span>
                  <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                </summary>
                <div className="space-y-2 pb-4">
                  {f.a.map((p) => (
                    <p key={p.id} className="text-[14px] leading-normal">
                      {p[locale]}
                    </p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </Card>
      </section>
    </DocLayout>
  );
}
