import { describe, expect, it } from 'vitest';
import { browserName, buildBugReport } from '../lib/support/bug-report';

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
});
