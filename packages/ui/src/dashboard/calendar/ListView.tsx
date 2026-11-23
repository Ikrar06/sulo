import { useState } from 'react';
import { useI18n } from '../../i18n';
import { SuloMascot } from '../../mascot/SuloMascot';
import { formatDateKey, formatRange } from '@sulo/core/calendar/countdown';
import type { CalEvent } from '@sulo/core/calendar/groups';
import type { DashMessages } from '@sulo/core/i18n/dashboard';
import { DateBlock } from './DateBlock';

/** Events by month: date block, name and range, category chip. Past events hide behind a button. */
export function ListView({ events, today, d }: { events: readonly CalEvent[]; today: string; d: DashMessages }) {
  const { m } = useI18n();
  const k = d.kalender;
  const [showPast, setShowPast] = useState(false);
  const pastCount = events.filter((e) => e.end < today).length;
  const shown = [...events].filter((e) => showPast || e.end >= today).sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.id.localeCompare(b.id));
  const months = [...new Set(shown.map((e) => e.start.slice(0, 7)))];

  return (
    <div className="space-y-4">
      {pastCount > 0 && (
        <button type="button" onClick={() => setShowPast((v) => !v)} className="h-8 rounded-lg border border-border px-3 text-[14px] outline-none hover:bg-surface-raised focus-ring:ring-2 focus-ring:ring-focus">
          {showPast ? k.hidePast : k.showPast}
        </button>
      )}
      {shown.length === 0 ? (
        // The one mascot on the calendar page.
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-5 py-8 text-center">
          <SuloMascot mood="happy" size={40} />
          <p className="text-[14px] text-muted-foreground">{k.listEmpty}</p>
        </div>
      ) : (
        months.map((month) => (
          <section key={month} className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-[16px] leading-6 font-semibold">{formatDateKey(`${month}-01`, m.intl, { month: 'long', year: 'numeric' })}</h3>
            <ul className="divide-y divide-border">
              {shown
                .filter((e) => e.start.slice(0, 7) === month)
                .map((e) => {
                  const k2 = e.source.type === 'kegiatan' ? e.source.kegiatan : null;
                  return (
                    <li key={e.id} className="flex items-center gap-3 py-3">
                      <DateBlock day={e.start} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold">{e.title}</p>
                        <p className="text-[12px] text-muted-foreground tabular-nums">
                          {formatRange({ mulai: e.start, selesai: k2 ? k2.selesai : e.end }, m.intl, k.to, k.badge.ujungTerbuka.toLowerCase())}
                          {k2?.perkiraan ? ` · ${k.badge.perkiraan}` : ''}
                          {k2?.status_verifikasi === 'perlu_cek' ? ` · ${k.badge.perluCek}` : ''}
                        </p>
                      </div>
                      <span className={`db-cat-${e.group} db-cat-bar inline-flex shrink-0 items-center gap-1 rounded-md px-2 text-[12px] leading-5`}>
                        <span aria-hidden="true" className="db-cat-dot size-2 rounded-full" />
                        {k.groups[e.group]}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
