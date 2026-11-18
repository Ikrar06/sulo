import type { CourseId, UnixSeconds } from '../types';

/** "x / y" points; null when the cell is empty or "-". */
export interface Points {
  got: number;
  max: number;
}

/** One course in the "All courses" recap. */
export interface RecapRow {
  courseId: CourseId;
  /** The course's attendance activity (course module id). */
  cmid: number;
  /** Taken sessions. */
  taken: number;
  points: Points | null;
  /** 0 to 100; null for "-" (nothing taken yet). */
  percent: number | null;
}

export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent' | 'unknown';

export interface SessionRow {
  /** The date and time as SIKOLA writes them (shown as is). */
  dateText: string;
  timeText: string;
  /** Session start when the date and time could be read; else null. */
  at: UnixSeconds | null;
  description: string;
  /** From the status text (English or Indonesian); "unknown" for others, which then shows statusText. */
  status: AttendanceStatus;
  statusText: string;
  points: Points | null;
  /** Free text from the teacher; hidden in privacy mode. */
  remarks: string;
}

export type ParseResult<T> = { kind: 'ok'; value: T } | { kind: 'unknown_shape' };

/** What Sulo keeps per account (u:<id>:presensi): monitored courses only. */
export interface PresensiData {
  recap: { fetchedAt: UnixSeconds; rows: RecapRow[] } | null;
  /** Keyed by cmid. */
  details: Record<string, { fetchedAt: UnixSeconds; sessions: SessionRow[] }>;
  /** Last request of any kind to an attendance page (cooldown). */
  lastRequestAt: UnixSeconds | null;
  /** The last answer could not be read (shape changed): shown as a safe message. */
  unknownShapeAt: UnixSeconds | null;
  /**
   * Attendance activities (cmid) seen before, newest first: from the recap,
   * from a course structure, or from the URL of an attendance page the user
   * opened on SIKOLA. Any one opens the global "All courses" recap.
   */
  knownCmids?: number[];
  /** Development builds' diagnosis: how the last fetch went (codes only). */
  lastOutcome?: { at: UnixSeconds; status: string; reason?: string; via?: CmidSource; probes?: number } | null;
}

/** Where the cmid for the recap came from (presensi/service.ts findRecapCmid). */
export type CmidSource = 'snapshot' | 'known' | 'probe';

export const EMPTY_PRESENSI: PresensiData = { recap: null, details: {}, lastRequestAt: null, unknownShapeAt: null, knownCmids: [], lastOutcome: null };
