// Debug build only: what happened to the SIKOLA session on this phone. Two
// sides that can disagree: the native vault (Diag: app start, saved, ended
// and why) and core's own session state, which the screens read ("Masuk lagi
// untuk memperbarui"), with core's latest requests (function names and
// outcome kinds). Times and codes only.
import { useEffect, useState } from 'react';
import { readSession } from '@sulo/core/moodle/session';
import { readBudget } from '@sulo/core/moodle/budget';
import { readTechLog, type TechLogEntry } from '@sulo/core/net/tech-log';
import { TEST_BUDGET_EXTRA, TEST_BUDGET_FLAG, testBudgetUsed } from './test-budget';
import type { Platform } from '@sulo/core/platform';
import type { SessionInfo } from '@sulo/core/types';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { SuloSession } from '../session';

const time = (at: number) => new Date(at * 1000).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' });

const SHORT: Record<string, string> = {
  core_session_time_remaining: 'sesi',
  core_calendar_get_action_events_by_timesort: 'tenggat',
  core_courseformat_get_state: 'isi_mk',
  message_popup_get_popup_notifications: 'notifikasi',
  core_course_get_enrolled_courses_by_timeline_classification: 'daftar_mk',
};
/** Short names for a phone line ("sesi+tenggat+isi_mk"); "page" stays. */
const shortFn = (fn: string) => fn.split('+').map((f) => SHORT[f] ?? f).join('+');

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

export function SessionDiagDev({ platform }: { platform: Platform }) {
  const [events, setEvents] = useState<{ at: number; e: string }[] | null>(null);
  const [core, setCore] = useState<SessionInfo | null>(null);
  const [tech, setTech] = useState<TechLogEntry[]>([]);
  const [cookies, setCookies] = useState<Record<string, number>>({});
  const [guard, setGuard] = useState<number[]>([]);
  const [testUsed, setTestUsed] = useState<number | null>(null);
  const load = () => {
    void SuloSession.diagLog()
      .then((r) => {
        setEvents([...r.events].reverse());
        setCookies(r.cookies ?? {});
        setGuard((r.guardMs ?? '').split(',').filter(Boolean).map(Number));
      })
      .catch(() => setEvents([]));
    void readSession(platform.store).then(setCore);
    void readTechLog(platform.store).then((log) => setTech(log.slice(0, 8)));
    void readBudget(platform.store, platform.clock).then((b) => {
      let flag: string | null = null;
      try {
        flag = localStorage.getItem(TEST_BUDGET_FLAG);
      } catch {
        flag = null;
      }
      setTestUsed(flag === platform.clock.localDate() ? testBudgetUsed(b.used) : null);
    });
  };
  useEffect(load, [platform]);
  return (
    <Card className="space-y-2">
      <h2 className="text-m15 font-semibold">Riwayat sesi (terbaru di atas)</h2>
      {core && (
        <p>
          Status sesi di layar (core): {core.state}
          {core.expiredAt ? ` sejak ${time(core.expiredAt)}` : ''}
        </p>
      )}
      <p className="text-muted-foreground">Vault (native):</p>
      {events === null || events.length === 0 ? (
        <p className="text-muted-foreground">Belum ada catatan.</p>
      ) : (
        <ul>
          {events.slice(0, 30).map((x, i) => (
            <li key={`${x.at}-${i}`}>
              {time(x.at)} · {x.e}
            </li>
          ))}
        </ul>
      )}
      <p>
        Set-Cookie MoodleSession: {Object.entries(cookies).map(([k, v]) => `${k} ${v}`).join(' · ') || 'belum ada'}
      </p>
      <p>Layanan permintaan (ms): {guard.length ? `${guard.length} kali, median ${median(guard)}, terpanjang ${Math.max(...guard)}` : 'belum ada'}</p>
      {testUsed !== null && <p>Anggaran uji {testUsed}/{TEST_BUDGET_EXTRA} (hari ini saja)</p>}
      <p className="text-muted-foreground">Request terakhir (core):</p>
      <ul>
        {tech.map((x, i) => (
          <li key={`${x.at}-${i}`}>
            {time(x.at)} · {shortFn(x.fn)} · {x.status}
          </li>
        ))}
      </ul>
      <PillButton onPress={load}>Muat ulang</PillButton>
    </Card>
  );
}
