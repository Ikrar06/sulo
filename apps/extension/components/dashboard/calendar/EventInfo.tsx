import type { ReactNode } from 'react';
import { useI18n } from '@/components/i18n';
import { formatRange } from '@sulo/core/calendar/countdown';
import { mentionsAngkatan } from '@sulo/core/calendar/month';
import type { Kegiatan, Libur } from '@sulo/core/calendar/schema';
import type { DashMessages } from '@sulo/core/i18n/dashboard';

/** Small outlined tag; color is never the only signal. Warning colors stay reserved for lateness, so "check this" is a strong neutral. */
export function Tag({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'strong' | 'accent' }) {
  const toneClass = tone === 'strong' ? 'border-foreground text-foreground' : tone === 'accent' ? 'border-brand-amber text-foreground' : 'border-border text-muted-foreground';
  return <span className={`inline-flex items-center rounded border px-2 text-[12px] leading-5 ${toneClass}`}>{children}</span>;
}

/** One academic event with every flag the data carries. */
export function EventInfo({ k, d, angkatan }: { k: Kegiatan; d: DashMessages; angkatan: number | null }) {
  const { m } = useI18n();
  const c = d.kalender;
  const range = (r: { mulai: string; selesai: string | null }) => formatRange(r, m.intl, c.to, c.badge.ujungTerbuka.toLowerCase());
  const mine = k.kategori === 'evaluasi' && mentionsAngkatan(k, angkatan);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[14px] font-semibold">{k.judul}</span>
        <span className="text-[12px] text-muted-foreground">{c.kategori[k.kategori]}</span>
      </div>
      <p className="text-[14px] tabular-nums">{range(k)}</p>
      {(k.perkiraan || k.ujung_terbuka || k.status_verifikasi === 'perlu_cek' || mine) && (
        <div className="flex flex-wrap gap-2">
          {k.perkiraan && <Tag>{c.badge.perkiraan}</Tag>}
          {k.ujung_terbuka && <Tag>{c.badge.ujungTerbuka}</Tag>}
          {k.status_verifikasi === 'perlu_cek' && <Tag tone="strong">{c.badge.perluCek}</Tag>}
          {mine && angkatan !== null && <Tag tone="accent">{c.angkatanMatch(angkatan)}</Tag>}
        </div>
      )}
      {k.nilai_lain.map((n) => (
        <p key={`${n.mulai}-${n.sumber}`} className="text-[12px] text-muted-foreground">
          {c.badge.nilaiLain(range(n), n.sumber)}
        </p>
      ))}
      {k.catatan && k.status_verifikasi !== 'perlu_cek' && <p className="text-[12px] text-muted-foreground">{k.catatan}</p>}
      {k.rincian.length > 0 && (
        <div className="space-y-1 pt-1">
          {k.status_verifikasi === 'perlu_cek' && <p className="text-[12px] font-semibold">{c.perluCekNote}</p>}
          <ul className="list-disc space-y-1 pl-6 text-[14px] leading-normal" lang="id">
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
        <span className="text-[14px] font-semibold">{l.nama}</span>
        <span className="text-[12px] text-muted-foreground">{l.jenis === 'cuti_bersama' ? c.jointLeave : c.holiday}</span>
      </div>
      <p className="text-[14px] tabular-nums">{formatRange(l, m.intl, c.to, '')}</p>
      {l.catatan && <p className="text-[12px] text-muted-foreground">{l.catatan}</p>}
    </div>
  );
}
