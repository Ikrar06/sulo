import { useState } from 'react';
import { CopyIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { FEED_IDS, feedUrl } from '@/lib/calendar/feeds';
import type { DashMessages } from '@/lib/i18n/dashboard';

/**
 * The three public feeds. Copying an address is local (clipboard); nothing
 * is sent to Google: the user pastes it into Google Calendar themselves.
 */
export function Subscribe({ d }: { d: DashMessages }) {
  const s = d.kalender.subscribe;
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
  };
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-[14px] font-semibold">{s.title}</h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{s.lead}</p>
      <ul className="mt-3 divide-y divide-border">
        {FEED_IDS.map((id) => {
          const url = feedUrl(id);
          return (
            <li key={id} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="text-[14px] font-medium">{s.feeds[id].name}</p>
                <p className="text-[12.5px] text-muted-foreground">{s.feeds[id].desc}</p>
                <input readOnly value={url} aria-label={s.feeds[id].name} onFocus={(e) => e.currentTarget.select()} className="mt-1.5 h-8 w-full rounded-lg border border-border bg-background px-2.5 text-[12.5px] text-muted-foreground outline-none focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-ring/40" />
              </div>
              <Button variant="outline" onClick={() => void copy(url)}>
                <CopyIcon className="size-4" />
                {s.copy}
              </Button>
            </li>
          );
        })}
      </ul>
      {copied && (
        <p role="status" className="text-[12.5px] text-muted-foreground">
          {s.copied}
        </p>
      )}
      <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-[13px]">
        {s.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-2 text-[12.5px] text-muted-foreground">{s.delay}</p>
    </section>
  );
}
