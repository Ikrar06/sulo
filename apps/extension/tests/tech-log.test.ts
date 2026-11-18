import { describe, expect, it } from 'vitest';
import { appendTechLog, statusOf, TECH_LOG_MAX, type TechLogEntry } from '@sulo/core/net/tech-log';

const e = (at: number): TechLogEntry => ({ at, fn: 'core_session_time_remaining', status: 'ok' });

describe('technical log', () => {
  it('keeps the newest 300, newest first', () => {
    let log: TechLogEntry[] = [];
    for (let i = 0; i < TECH_LOG_MAX + 20; i += 1) log = appendTechLog(log, e(i));
    expect(log).toHaveLength(300);
    expect(log[0]?.at).toBe(TECH_LOG_MAX + 19);
  });
  it('holds only time, function names and status', () => {
    expect(Object.keys(e(1)).sort()).toEqual(['at', 'fn', 'status']);
    expect(statusOf({ kind: 'refused', reason: 'BACKING_OFF' })).toBe('refused:BACKING_OFF');
    expect(statusOf({ kind: 'ok' })).toBe('ok');
  });
});
