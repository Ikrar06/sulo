// Academic-calendar periods when opening a NEOSIA page keeps Sulo's copy
// fresh (M7.1): grade input and grade appeals ("Nilai mungkin sudah
// keluar"), and KRS windows ("KRS sudah buka"). Gated by the calendar
// notification settings; month-level estimates and admissions never count. Pure.

import type { CalendarNotifySettings } from '../calendar/notify-settings';
import type { Kegiatan } from '../calendar/schema';
import { NEOSIA_KHS, NEOSIA_KRS } from '../links';

export interface Nudge {
  id: string;
  nudge: 'grades' | 'krs';
  mulai: string;
  selesai: string;
}

export function neosiaNudges(kegiatan: readonly Kegiatan[], settings: CalendarNotifySettings): Nudge[] {
  return kegiatan
    .filter((k) => !k.perkiraan && k.audiens !== 'calon_mahasiswa')
    .flatMap((k): Nudge[] => {
      if ((k.kategori === 'nilai' || k.kategori === 'sanggah') && settings.sanggah) return [{ id: k.id, nudge: 'grades' as const, mulai: k.mulai, selesai: k.selesai ?? k.mulai }];
      if (k.kategori === 'krs' && settings.krs) return [{ id: k.id, nudge: 'krs' as const, mulai: k.mulai, selesai: k.selesai ?? k.mulai }];
      return [];
    });
}

/** The page a nudge's click opens (user click on the notification): grades → KHS, KRS → KRS. */
export function nudgeTarget(notificationId: string): string {
  return notificationId.includes('nudge:grades:') ? NEOSIA_KHS : NEOSIA_KRS;
}
