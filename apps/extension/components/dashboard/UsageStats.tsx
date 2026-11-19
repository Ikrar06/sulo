import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { useI18n } from '@sulo/ui/i18n';
import { Button } from '@sulo/ui/ui/button';
import { formatDateKey } from '@sulo/core/calendar/countdown';
import { exportUsage, readUsage, USAGE_COUNTERS, USAGE_KEY, type Usage } from '@sulo/core/stats/usage';
import { local } from './data';
import type { PageProps } from './types';
import { statsWords } from '@sulo/core/i18n/stats-dev';

/**
 * Local usage counters with a voluntary export. The file is made in the
 * page and saved through a download link: nothing leaves the browser unless
 * the user sends the file themselves.
 */
/** Development builds only (loaded lazily by the settings page). */
export default function UsageStats({ data }: Pick<PageProps, 'data'>) {
  const { m, locale } = useI18n();
  const s = statsWords(locale === 'en' ? 'en' : 'id');
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    const load = () => void readUsage(local, data.today).then(setUsage);
    load();
    const onChange = (changes: Record<string, unknown>, area: string) => area === 'local' && USAGE_KEY in changes && load();
    browser.storage.onChanged.addListener(onChange);
    return () => browser.storage.onChanged.removeListener(onChange);
  }, [data.today]);

  if (!usage) return null;

  const download = () => {
    const blob = new Blob([exportUsage(usage, browser.runtime.getManifest().version, data.today)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sulo-statistik-${data.today}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-[14px] font-medium">{s.title}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">{s.since(formatDateKey(usage.since, m.intl, { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-[14px] sm:grid-cols-2">
        {USAGE_COUNTERS.map((c) => (
          <div key={c} className="flex justify-between gap-3 border-b border-border/60 py-1">
            <dt className="text-muted-foreground">{s.counters[c]}</dt>
            <dd className="font-medium tabular-nums">{usage.counters[c]}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 space-y-2">
        <Button variant="outline" onClick={download}>
          {s.export}
        </Button>
        <p className="max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{s.exportHelp}</p>
      </div>
    </div>
  );
}
