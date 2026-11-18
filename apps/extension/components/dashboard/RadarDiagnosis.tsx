// "Diagnosis Radar" (tester and development builds only; Pengaturan loads it
// behind MODE !== 'production'): what the radar stored, counts and codes
// only, and the last batches from the technical log. No names, no content.

import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { TECH_LOG_KEY, type TechLogEntry } from '@sulo/core/net/tech-log';
import type { DashboardData } from './data';

const time = (at: number | undefined) => (at ? new Date(at * 1000).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-');
/** "core_session_time_remaining+core_courseformat_get_state+…" -> "session, state x4, …" */
const short = (fn: string) => {
  const counts = new Map<string, number>();
  for (const f of fn.split('+')) {
    const k = f.replace(/^core_courseformat_get_/, '').replace(/^core_|^message_popup_get_/, '').replace(/_by_timesort|_by_timeline_classification/, '');
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].map(([k, n]) => (n > 1 ? `${k} x${n}` : k)).join(', ');
};

export default function RadarDiagnosis({ data }: { data: DashboardData }) {
  const [log, setLog] = useState<TechLogEntry[]>([]);
  useEffect(() => {
    void browser.storage.local.get(TECH_LOG_KEY).then((r) => setLog(((r[TECH_LOG_KEY] as TechLogEntry[] | undefined) ?? []).slice(0, 12)));
  }, [data.now]);
  const user = data.user;
  if (!user) return null;
  const snapshots = Object.values(user.snapshots ?? {});
  const checked = Object.values(user.radar.stateCheckedAt ?? {});
  const run = user.radar.lastRun;
  return (
    <details className="rounded-xl border border-dashed border-border p-4 text-[12px] tabular-nums">
      <summary className="cursor-pointer text-muted-foreground">Diagnosis Radar (build penguji)</summary>
      <div className="mt-2 space-y-1">
        <p>Snapshot struktur: {snapshots.length} mata kuliah {snapshots.length > 0 && `(${snapshots.map((s) => `${s.courseId}: ${Object.keys(s.items ?? {}).length} modul`).join(', ')})`}</p>
        <p>lastCheckedAt terakhir: {time(checked.length ? Math.max(...checked) : undefined)} ({checked.length} mata kuliah pernah dicek)</p>
        <p>Kabar tersimpan: {user.changes.length}</p>
        <p>Notifikasi terakhir diambil: {time(user.radar.notificationsFetchedAt)}; baseline kalender: {String(user.radar.calendarBaseline)}</p>
        <p>Akses gagal: {Object.keys(user.radar.courseAccess ?? {}).length} mata kuliah</p>
        <p>Putaran Radar terakhir: {run ? `${time(run.at)} · direncanakan ${run.planned} · disimpan ${run.stored} · notifikasi ${run.notifications} · galat ${JSON.stringify(run.errors)}${run.failure ? ` · ${run.failure}` : ''}` : 'belum tercatat'}</p>
        <p className="pt-2 text-muted-foreground">Batch terakhir (log teknis):</p>
        <ul>
          {log.map((e) => (
            <li key={`${e.at}-${e.fn}`}>
              {time(e.at)} · {short(e.fn)} · {e.status}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
