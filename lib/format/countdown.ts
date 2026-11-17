// "Hitung mundur": one format for every range, in the popup and the
// dashboard. Pure. Hours, minutes and seconds always have two digits:
//   more than a day   "2 hari 03:15:42"  (en "2d 03:15:42")
//   under a day       "03:15:42"
//   under an hour     "00:45:09"
//   under a minute    "00:00:37"
// Past the deadline there is no countdown (null): callers show the usual
// "terlambat …" label instead of a negative clock.

export type CountdownLocale = 'id' | 'en';

const pad = (n: number) => String(n).padStart(2, '0');

export function formatCountdown(msLeft: number, locale: CountdownLocale): string | null {
  if (msLeft < 0) return null;
  const total = Math.floor(msLeft / 1000);
  const days = Math.floor(total / 86_400);
  const rest = total - days * 86_400;
  const hms = `${pad(Math.floor(rest / 3600))}:${pad(Math.floor((rest % 3600) / 60))}:${pad(rest % 60)}`;
  if (days === 0) return hms;
  return locale === 'id' ? `${days} hari ${hms}` : `${days}d ${hms}`;
}

/**
 * The spoken version, updated once a minute (never every second, and never
 * in a live region): "sisa 45 menit", "sisa 2 hari 3 jam" / "45 minutes left".
 */
export function countdownLabel(msLeft: number, locale: CountdownLocale): string | null {
  if (msLeft < 0) return null;
  const minutes = Math.floor(msLeft / 60_000);
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  const id = locale === 'id';
  const unit = (n: number, one: string, many: string) => (id ? `${n} ${one}` : `${n} ${n === 1 ? one : many}`);
  const parts = d > 0 ? [unit(d, id ? 'hari' : 'day', 'days'), h > 0 ? unit(h, id ? 'jam' : 'hour', 'hours') : ''] : h > 0 ? [unit(h, id ? 'jam' : 'hour', 'hours'), m > 0 ? unit(m, id ? 'menit' : 'minute', 'minutes') : ''] : [m > 0 ? unit(m, id ? 'menit' : 'minute', 'minutes') : id ? 'kurang dari 1 menit' : 'under a minute'];
  const text = parts.filter(Boolean).join(' ');
  return id ? `sisa ${text}` : `${text} left`;
}
