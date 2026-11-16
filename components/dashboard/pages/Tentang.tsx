import { browser } from 'wxt/browser';
import { useI18n } from '@/components/i18n';
import { ExternalIcon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import { Button } from '@/components/ui/button';
import { FEEDBACK_FORM_URL, isShownLink, SOCIAL_LINKS, TRAKTEER_URL } from '@/lib/links';
import { CoffeeIcon } from '../icons';
import { Card } from '../Shell';
import type { PageProps } from '../types';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/**
 * About and appreciation. Every outside link is a plain link opened by a
 * click; nothing from Trakteer, social media or Google is loaded here (no
 * embed script, no image from their CDN). The coffee cup is our own SVG.
 */
export function TentangPage({ d, actions }: PageProps) {
  const { m } = useI18n();
  const t = d.tentang;
  const socials = SOCIAL_LINKS.filter((s) => isShownLink(s.url));
  const feedback = isShownLink(FEEDBACK_FORM_URL);

  return (
    <div className="max-w-[760px] space-y-5">
      <Card>
        <div className="flex items-start gap-4">
          <Mascot state="idle" size={72} grounded />
          <div className="space-y-2">
            <h2 className="font-heading text-[20px]">{t.nameTitle}</h2>
            <p className="text-[14.5px] leading-[22px] text-foreground/85">{t.nameBody}</p>
          </div>
        </div>
        <div className="mt-4 space-y-1 border-t border-border pt-4 text-[13.5px]">
          <p>{m.disclaimer}</p>
          <p className="text-muted-foreground">
            {t.version(browser.runtime.getManifest().version)}. {t.license}
          </p>
          <button
            type="button"
            className="rounded text-[13.5px] underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus"
            onClick={() => actions.openTab(browser.runtime.getURL('/privacy.html'))}
          >
            {t.privacy}
          </button>
        </div>
      </Card>

      <Card title={t.supportTitle}>
        <p className="text-[14px] leading-[22px] text-foreground/85">{t.supportBody}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button asChild className="h-11 rounded-xl px-4 text-[15px]">
            <a href={TRAKTEER_URL} {...external}>
              <CoffeeIcon className="size-5" />
              <span className="flex flex-col items-start leading-tight">
                <span className="font-semibold">{t.coffee}</span>
                <span className="text-[11.5px] font-normal opacity-80">{t.coffeeVia}</span>
              </span>
            </a>
          </Button>
          {feedback && (
            <Button asChild variant="outline" className="h-11 rounded-xl px-4">
              <a href={FEEDBACK_FORM_URL} {...external}>
                {t.feedback}
                <ExternalIcon className="size-3.5" />
              </a>
            </Button>
          )}
        </div>
        {socials.length > 0 && (
          <div className="mt-4">
            <p className="text-[13px] font-medium">{t.social}</p>
            <ul className="mt-1 flex flex-wrap gap-3 text-[13.5px]">
              {socials.map((s) => (
                <li key={s.url}>
                  <a href={s.url} {...external} className="inline-flex items-center gap-1 rounded underline underline-offset-2 outline-none focus-ring:ring-2 focus-ring:ring-focus">
                    {s.label}
                    <ExternalIcon className="size-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-4 text-[12.5px] text-muted-foreground">{t.externalNote}</p>
      </Card>
    </div>
  );
}
