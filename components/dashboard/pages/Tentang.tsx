import type { ComponentType, SVGProps } from 'react';
import { browser } from 'wxt/browser';
import { ExternalIcon } from '@/components/icons';
import { CREATOR_LINKS, CREATOR_NAME, FEEDBACK_FORM_URL, isShownLink, TRAKTEER_URL, type CreatorLinkId } from '@/lib/links';
import { CoffeeIcon, GitHubIcon, GlobeIcon, InstagramIcon, LinkedInIcon } from '../icons';
import { Card } from '../Shell';
import type { PageProps } from '../types';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

const LINK_ICONS: Record<CreatorLinkId, ComponentType<SVGProps<SVGSVGElement>>> = {
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  github: GitHubIcon,
  web: GlobeIcon,
};

const textLink =
  'inline-flex items-center gap-2 rounded text-[14px] underline-offset-4 outline-none hover:underline focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-offset-2 focus-ring:ring-offset-background';

/**
 * About. Every outside link is a plain link opened by a click; nothing from
 * Trakteer, social media or Google is loaded here (no embed script, no
 * image from a CDN). Icons are our own inline SVG.
 */
export function TentangPage({ d, actions }: PageProps) {
  const t = d.tentang;
  const creators = CREATOR_LINKS.filter((l) => isShownLink(l.url));
  const feedback = isShownLink(FEEDBACK_FORM_URL);

  return (
    <div className="db-prose space-y-4">
      <Card large>
        <p className="text-[14px] leading-normal">{t.intro}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[14px] leading-normal">
          {t.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-normal text-muted-foreground">
          <span>
            {t.version(browser.runtime.getManifest().version)}. {t.license}
          </span>
          <button
            type="button"
            className="rounded underline underline-offset-2 outline-none hover:text-foreground focus-ring:ring-2 focus-ring:ring-focus"
            onClick={() => actions.openTab(browser.runtime.getURL('/privacy.html'))}
          >
            {t.privacy}
          </button>
        </p>
      </Card>

      {creators.length > 0 && (
        <Card title={t.madeBy(CREATOR_NAME)}>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {creators.map((l) => {
              const Icon = LINK_ICONS[l.id];
              return (
                <li key={l.id}>
                  <a href={l.url} {...external} className={textLink}>
                    <Icon className="size-4 shrink-0" />
                    <span>{l.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {feedback && (
        <Card title={t.feedbackTitle}>
          <a
            href={FEEDBACK_FORM_URL}
            {...external}
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-3 text-[14px] font-medium outline-none hover:bg-muted focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-offset-2 focus-ring:ring-offset-background"
          >
            {t.feedback}
            <ExternalIcon className="size-4" />
          </a>
          <p className="mt-2 text-[12px] leading-normal text-muted-foreground">{t.feedbackNote}</p>
        </Card>
      )}

      <Card title={t.supportTitle}>
        <p className="text-[14px] leading-normal">{t.supportBody}</p>
        <a
          href={TRAKTEER_URL}
          {...external}
          className="mt-4 inline-flex h-12 items-center gap-3 rounded-xl bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/85 focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-offset-2 focus-ring:ring-offset-background"
        >
          <CoffeeIcon className="size-5 shrink-0" />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[14px] font-semibold">{t.coffee}</span>
            <span className="text-[12px] opacity-80">{t.coffeeVia}</span>
          </span>
        </a>
        <p className="mt-4 text-[12px] leading-normal text-muted-foreground">{t.externalNote}</p>
      </Card>
    </div>
  );
}
