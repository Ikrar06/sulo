// Which calendar file to trust, and whether it is out of date. Pure.

import { startYear, type CalendarFile } from './schema.ts';

/**
 * A downloaded file replaces the current one only for a newer academic year,
 * or the same year with a higher revision (docs/KALENDER-AKADEMIK.md).
 */
export function shouldAccept(current: CalendarFile | null, incoming: CalendarFile): boolean {
  if (!current) return true;
  const a = startYear(current.tahun_ajaran);
  const b = startYear(incoming.tahun_ajaran);
  return b > a || (b === a && incoming.revisi > current.revisi);
}

export type CalendarStatus = { kind: 'missing' } | { kind: 'ok'; berlakuSampai: string } | { kind: 'expired'; berlakuSampai: string };

/**
 * After `berlaku_sampai` (30 Jun 2027 for 2026/2027) without data for the
 * next academic year, the calendar is out of date. M5a shows it; nothing
 * reads expired dates as current.
 */
export function calendarStatus(file: CalendarFile | null, today: string): CalendarStatus {
  if (!file) return { kind: 'missing' };
  return today > file.berlaku_sampai ? { kind: 'expired', berlakuSampai: file.berlaku_sampai } : { kind: 'ok', berlakuSampai: file.berlaku_sampai };
}
