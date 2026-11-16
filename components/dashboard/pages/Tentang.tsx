import type { ComponentType, SVGProps } from 'react';
import { browser } from 'wxt/browser';
import { ExternalIcon } from '@/components/icons';
import { CREATOR_LINKS, CREATOR_NAME, FEEDBACK_FORM_URL, isShownLink, TRAKTEER_URL, type CreatorLinkId } from '@/lib/links';
import { SupportButton } from '@/components/ui/support-button';
import { GitHubIcon, GlobeIcon, InstagramIcon, LinkedInIcon } from '../icons';
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
        <ul className="mt-3 list-disc space-y-1 pl-6 text-[14px] leading-normal">
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

      {/* Support first (primary), feedback beside it (secondary, same 40 px height); stacked 8 px apart on narrow screens. */}
      <Card title={t.supportTitle}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          {isShownLink(TRAKTEER_URL) && <SupportButton href={TRAKTEER_URL} label={t.coffee} note={t.supportNote} srHint={t.coffeeHint} />}
          {feedback && (
            <div className="flex flex-col items-start gap-2">
              <a
                href={FEEDBACK_FORM_URL}
                {...external}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-[14px] font-medium outline-none hover:bg-muted focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-offset-2 focus-ring:ring-offset-background"
              >
                {t.feedback}
                <ExternalIcon className="size-3.5 text-muted-foreground" />
              </a>
              <p className="text-[12px] leading-normal text-muted-foreground">{t.feedbackNote}</p>
            </div>
          )}
        </div>
        <p className="mt-4 text-[12px] leading-normal text-muted-foreground">{t.externalNote}</p>
      </Card>
    </div>
  );
}
