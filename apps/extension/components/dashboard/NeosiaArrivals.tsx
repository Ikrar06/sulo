// A toast when new NEOSIA data comes in while the dashboard is open (M7.1),
// e.g. after the user opened the transcript in another tab. The page itself
// re-reads storage on its own; this only says so. Nothing on first load.

import { useEffect, useRef } from 'react';
import { useI18n } from '@/components/i18n';
import { useToast } from '@/components/ui/toast';
import type { Page } from '@sulo/core/dashboard/routes';
import { neosiaWords } from '@sulo/core/i18n/neosia';
import { arrivals, arrivalMessage } from '@sulo/core/neosia/sources';
import type { Snapshots } from '@sulo/core/neosia/store';

export function NeosiaArrivals({ snapshots, page }: { snapshots: Snapshots; page: Page }) {
  const { locale } = useI18n();
  const toast = useToast();
  const previous = useRef<Snapshots | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = snapshots;
    if (before === null) return;
    const kind = arrivalMessage(arrivals(before, snapshots), page);
    if (kind) toast.show({ message: neosiaWords(locale).arrived[kind], duration: 4000 });
  }, [snapshots, page, locale, toast]);
  return null;
}
