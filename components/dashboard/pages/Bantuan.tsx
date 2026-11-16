import { useEffect } from 'react';
import { useI18n } from '@/components/i18n';
import { ChevronDownIcon } from '@/components/icons';
import { FAQ, HOW_IT_WORKS } from '@/lib/help/content';
import { FEEDBACK_FORM_URL, isShownLink } from '@/lib/links';
import { Card } from '../Shell';
import type { PageProps } from '../types';

/** How Sulo works and the FAQ, from lib/help/content.ts (bundled; works offline). Text page: 68ch. */
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

  return (
    <div className="db-prose space-y-4">
      <p className="text-[12px] text-muted-foreground">{b.offline}</p>
      <Card title={b.howTitle}>
        <div className="space-y-4">
          {HOW_IT_WORKS.map((s) => (
            <section key={s.heading.id} className="space-y-2">
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
      <Card title={b.faqTitle}>
        <div className="divide-y divide-border">
          {FAQ.map((f) => (
            <details key={f.id} id={`faq-${f.id}`} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md py-3 text-[14px] font-semibold outline-none focus-ring:ring-2 focus-ring:ring-focus [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{f.q[locale]}</span>
                <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
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
      {/* Only once the feedback form exists; never point to a hidden button. */}
      {isShownLink(FEEDBACK_FORM_URL) && <p className="text-[12px] text-muted-foreground">{b.moreHelp}</p>}
    </div>
  );
}
