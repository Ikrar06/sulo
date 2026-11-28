// "Menyiapkan Sulo": each row's state comes from the real stages only.
import { describe, expect, it } from 'vitest';
import { preparingRows } from '@/components/onboarding/journey-preparing';

describe('preparingRows', () => {
  it('connected is done, the first stage runs, the rest wait', () => {
    expect(preparingRows([], false)).toEqual({ connected: 'done', tasks: 'running', courses: 'waiting', attendance: 'waiting' });
  });
  it('follows the stages as they end', () => {
    expect(preparingRows([{ stage: 'tasks', result: 'ok' }], false)).toEqual({ connected: 'done', tasks: 'done', courses: 'running', attendance: 'waiting' });
  });
  it('a failed stage is marked and the rows after it wait', () => {
    expect(preparingRows([{ stage: 'tasks', result: 'ok' }, { stage: 'courses', result: 'failed' }], true)).toEqual({ connected: 'done', tasks: 'done', courses: 'failed', attendance: 'waiting' });
  });
  it('a failed sync with no failed stage marks the running row', () => {
    expect(preparingRows([{ stage: 'tasks', result: 'ok' }], true)).toEqual({ connected: 'done', tasks: 'done', courses: 'failed', attendance: 'waiting' });
  });
  it('all done', () => {
    const ok = (stage: 'tasks' | 'courses' | 'attendance') => ({ stage, result: 'ok' as const });
    expect(preparingRows([ok('tasks'), ok('courses'), ok('attendance')], false)).toEqual({ connected: 'done', tasks: 'done', courses: 'done', attendance: 'done' });
  });
  it('ticks "Terhubung ke SIKOLA" only once SIKOLA answered', () => {
    // The request limits refused the first request: a pause, so nothing is ticked and nothing is marked failed.
    expect(preparingRows([{ stage: 'tasks', result: 'failed' }], false, 'waiting')).toEqual({ connected: 'waiting', tasks: 'waiting', courses: 'waiting', attendance: 'waiting' });
    // Offline: not connected, the rest waits.
    expect(preparingRows([{ stage: 'tasks', result: 'failed' }], true, 'failed')).toEqual({ connected: 'failed', tasks: 'waiting', courses: 'waiting', attendance: 'waiting' });
    // A stage that ended well proves the connection, whatever stopped the setup later.
    expect(preparingRows([{ stage: 'tasks', result: 'ok' }], false, 'waiting')).toMatchObject({ connected: 'done', tasks: 'done' });
  });
});
