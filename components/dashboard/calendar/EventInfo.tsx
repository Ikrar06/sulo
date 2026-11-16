import type { ReactNode } from 'react';
import { useI18n } from '@/components/i18n';
import { formatRange } from '@/lib/calendar/countdown';
import { mentionsAngkatan } from '@/lib/calendar/month';
import type { Kegiatan, Libur } from '@/lib/calendar/schema';
import type { DashMessages } from '@/lib/i18n/dashboard';

/** Small outlined tag; color is never the only signal. */
export function Tag({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warn' | 'accent' }) {
  const toneClass = tone === 'warn' ? 'border-urgency-soon/60 text-urgency-soon' : tone === 'accent' ? 'border-brand-amber/60 text-foreground' : 'border-border text-muted-foreground';
  return <span className={`inline-flex items-center rounded border px-1.5 text-[11.5px] leading-[18px] ${toneClass}`}>{children}</span>;
}

/** One academic event with every flag the data carries. */
export function EventInfo({ k, d, angkatan }: { k: Kegiatan; d: DashMessages; angkatan: number | null }) {
  const { m } = useI18n();
  const c = d.kalender;
  const range = (r: { mulai: string; selesai: string | null }) => formatRange(r, m.intl, c.to, c.badge.ujungTerbuka.toLowerCase());
  const mine = k.kategori === 'evaluasi' && mentionsAngkatan(k, angkatan);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[14px] font-medium">{k.judul}</span>
        <span className="text-[12.5px] text-muted-foreground">{c.kategori[k.kategori]}</span>
      </div>
      <p className="text-[13px] tabular-nums">{range(k)}</p>
      <div className="flex flex-wrap gap-1.5">
        {k.perkiraan && <Tag>{c.badge.perkiraan}</Tag>}
        {k.ujung_terbuka && <Tag>{c.badge.ujungTerbuka}</Tag>}
        {k.status_verifikasi === 'perlu_cek' && <Tag tone="warn">{c.badge.perluCek}</Tag>}
        {mine && angkatan !== null && <Tag tone="accent">{c.angkatanMatch(angkatan)}</Tag>}
      </div>
      {k.nilai_lain.map((n) => (
        <p key={`${n.mulai}-${n.sumber}`} className="text-[12.5px] text-muted-foreground">
          {c.badge.nilaiLain(range(n), n.sumber)}
        </p>
      ))}
      {k.catatan && k.status_verifikasi !== 'perlu_cek' && <p className="text-[12.5px] text-muted-foreground">{k.catatan}</p>}
      {k.rincian.length > 0 && (
        <div className="space-y-1">
          {k.status_verifikasi === 'perlu_cek' && <p className="text-[12.5px] font-medium text-urgency-soon">{c.perluCekNote}</p>}
          <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] leading-[18px] text-foreground/85" lang="id">
            {k.rincian.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function HolidayInfo({ l, d }: { l: Libur; d: DashMessages }) {
  const { m } = useI18n();
  const c = d.kalender;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[14px] font-medium">{l.nama}</span>
        <span className="text-[12.5px] text-muted-foreground">{c.holiday}</span>
      </div>
      <p className="text-[13px] tabular-nums">{formatRange(l, m.intl, c.to, '')}</p>
      {l.catatan && <p className="text-[12.5px] text-muted-foreground">{l.catatan}</p>}
    </div>
  );
}
