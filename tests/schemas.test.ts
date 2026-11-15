import { readFileSync, readdirSync } from 'node:fs';
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
  ['message_popup_get_popup_notifications', 'popup-notifications.grades'],
  ['core_course_get_enrolled_courses_by_timeline_classification', 'enrolled-courses.normal'],
];

describe('function schemas accept valid fixtures', () => {
  it.each(CASES)('%s', (fn, file) => {
    const result = parseCall(fn, { ok: true, data: fixture(file) });
    expect(result.ok).toBe(true);
  });

  it('validates every file in fixtures/synthetic', () => {
    const files = readdirSync(new URL('../fixtures/synthetic/', import.meta.url)).filter((f) => f.endsWith('.json'));
    const covered = new Set(CASES.map(([, file]) => `${file}.json`));
    expect(files.filter((f) => !covered.has(f))).toEqual([]);
  });

  it('parses the course state JSON string and normalizes string ids', () => {
    const result = parseCall('core_courseformat_get_state', { ok: true, data: fixture('courseformat-state.normal') });
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.course.id).toBe(401);
    expect(result.data.section.flatMap((s) => s.cmlist)).toEqual([311, 312, 313, 314, 301, 315, 316, 317]);
    expect(result.data.cm.map((c) => c.id)).toEqual([311, 312, 313, 314, 301, 315, 316, 317]);
  });

  it('accepts a label without url and keeps url for other activities', () => {
    const result = parseCall('core_courseformat_get_state', { ok: true, data: fixture('courseformat-state.normal') });
    if (!result.ok) throw new Error('expected ok');
    const label = result.data.cm.find((c) => c.module === 'label');
    expect(label?.url).toBeUndefined();
    expect(result.data.cm.filter((c) => c.module !== 'label').every((c) => typeof c.url === 'string')).toBe(true);
  });

  it('exposes the current section when the lecturer highlights one', () => {
    const result = parseCall('core_courseformat_get_state', { ok: true, data: fixture('courseformat-state.normal') });
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.section.filter((s) => s.current).map((s) => s.number)).toEqual([2]);
  });

  it('accepts quiz close events from the calendar (deadline only, never quiz content)', () => {
    const result = parseCall('core_calendar_get_action_events_by_timesort', { ok: true, data: fixture('calendar-action-events.normal') });
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.events.map((e) => `${e.modulename}/${e.eventtype}`)).toEqual(['assign/due', 'quiz/close', 'assign/due']);
  });

  it('accepts notifications from several components', () => {
    const result = parseCall('message_popup_get_popup_notifications', { ok: true, data: fixture('popup-notifications.normal') });
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.notifications.map((n) => n.component)).toEqual(['moodle', 'mod_assign', 'gradingform', 'mod_forum', 'mod_forum']);
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
