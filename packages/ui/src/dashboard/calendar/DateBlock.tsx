import { formatDateKey } from '@sulo/core/calendar/countdown';
import { useI18n } from '../../i18n';

/** A small date block: the day large, the month small. */
export function DateBlock({ day }: { day: string }) {
  const { m } = useI18n();
  return (
    <span aria-hidden="true" className="flex w-10 shrink-0 flex-col items-center rounded-lg border border-border py-1 leading-none">
      <span className="text-[16px] font-semibold tabular-nums">{Number(day.slice(8))}</span>
      <span className="mt-1 text-[12px] text-muted-foreground">{formatDateKey(day, m.intl, { month: 'short' })}</span>
    </span>
  );
}
