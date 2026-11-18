import { describe, expect, it } from 'vitest';
import { browserName, buildBugReport } from '@sulo/core/support/bug-report';

describe('bug report', () => {
  it('names the browser and version only', () => {
    expect(browserName('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/142.0.1.2 Safari/537.36')).toBe('Chrome 142');
    expect(browserName('Mozilla/5.0 Chrome/142.0 Safari/537.36 Edg/142.0.3')).toBe('Edge 142');
  });

  it('holds version, browser, sync status and at most 20 log lines, nothing personal', () => {
    const log = Array.from({ length: 25 }, (_, i) => ({ at: 1_794_000_000 - i * 60, fn: 'core_session_time_remaining+core_calendar_get_action_events_by_timesort', status: 'ok' }));
    const text = buildBugReport({ version: '0.1.0', userAgent: 'Chrome/142.0', lastSyncAt: 1_794_000_000, lastAttemptAt: 1_794_000_000, lastOutcome: { status: 'ok', at: 1_794_000_000, tasks: 7, courseListFetched: false }, log });
    expect(text.split('\n')[0]).toBe('Sulo 0.1.0');
    expect(text).toContain('Browser: Chrome 142');
    expect(text.split('\n').filter((l) => l.endsWith('core_calendar_get_action_events_by_timesort'))).toHaveLength(20);
    // No task count, no ids, no names: only status words and function names.
    expect(text).not.toMatch(/tasks|sesskey|userid/i);
  });

  it('says only whether NEOSIA is on and when its data last came, never its data', () => {
    const base = { version: '0.2.0', userAgent: 'Chrome/142.0', lastSyncAt: null, lastAttemptAt: null, lastOutcome: null, log: [] };
    expect(buildBugReport({ ...base, neosia: { enabled: false, lastSeenAt: null } })).toContain('NEOSIA: off');
    const on = buildBugReport({ ...base, neosia: { enabled: true, lastSeenAt: 1_794_000_000 } });
    expect(on).toContain('NEOSIA: on, last data 2026-');
    expect(on).not.toMatch(/ipk|ips|nilai|grade|sks|krs/i);
  });
});
