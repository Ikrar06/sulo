import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AllowedFunction } from '../lib/moodle/calls';
import { parseCall } from '../lib/moodle/schemas';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../fixtures/synthetic/${name}.json`, import.meta.url), 'utf8'));

const CASES: [AllowedFunction, string][] = [
  ['core_session_time_remaining', 'session-time-remaining.normal'],
  ['core_calendar_get_action_events_by_timesort', 'calendar-action-events.normal'],
  ['core_courseformat_get_state', 'courseformat-state.normal'],
  ['message_popup_get_popup_notifications', 'popup-notifications.normal'],
  ['core_course_get_enrolled_courses_by_timeline_classification', 'enrolled-courses.normal'],
];

describe('function schemas accept valid fixtures', () => {
  it.each(CASES)('%s', (fn, file) => {
    const result = parseCall(fn, { ok: true, data: fixture(file) });
    expect(result.ok).toBe(true);
  });

  it('parses the course state JSON string and normalizes string ids', () => {
    const result = parseCall('core_courseformat_get_state', { ok: true, data: fixture('courseformat-state.normal') });
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.course.id).toBe(401);
    expect(result.data.cm.map((c) => c.module)).toEqual(['assign', 'label']);
  });

  it('keeps unknown fields (passthrough)', () => {
    const result = parseCall('message_popup_get_popup_notifications', { ok: true, data: fixture('popup-notifications.normal') });
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.notifications[0]).toHaveProperty('customdata');
  });
});

describe('broken input is PARSER_BROKEN, never empty data', () => {
  it('flags a missing required field with its path', () => {
    const data = fixture('calendar-action-events.normal') as { events: Record<string, unknown>[] };
    const broken = { ...data, events: data.events.map(({ timesort: _drop, ...rest }) => rest) };
    const result = parseCall('core_calendar_get_action_events_by_timesort', { ok: true, data: broken });
    expect(result).toMatchObject({ ok: false, status: 'PARSER_BROKEN', where: 'core_calendar_get_action_events_by_timesort' });
    if (result.ok || result.status !== 'PARSER_BROKEN') throw new Error('expected PARSER_BROKEN');
    expect(result.issues).toContain('events.0.timesort: invalid_type');
  });

  it('flags a course state that is not valid JSON', () => {
    const result = parseCall('core_courseformat_get_state', { ok: true, data: '{not json' });
    expect(result).toMatchObject({ ok: false, status: 'PARSER_BROKEN' });
  });

  it.each(CASES)('%s rejects null and an empty object', (fn) => {
    expect(parseCall(fn, { ok: true, data: null }).ok).toBe(false);
    expect(parseCall(fn, { ok: true, data: {} }).ok).toBe(false);
  });

  it('reports a call error separately from a parser problem', () => {
    expect(parseCall('core_course_get_enrolled_courses_by_timeline_classification', { ok: false, errorcode: 'servicenotavailable' })).toEqual({
      ok: false,
      status: 'CALL_ERROR',
      where: 'core_course_get_enrolled_courses_by_timeline_classification',
      errorcode: 'servicenotavailable',
    });
  });

  it('never includes field values in issue messages', () => {
    const result = parseCall('core_session_time_remaining', { ok: true, data: { userid: 'Nama Asli', timeremaining: 1 } });
    if (result.ok || result.status !== 'PARSER_BROKEN') throw new Error('expected PARSER_BROKEN');
    expect(result.issues.join(' ')).not.toContain('Nama Asli');
  });
});
