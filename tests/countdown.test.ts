import { describe, expect, it } from 'vitest';
import { countdownLabel, formatCountdown } from '../lib/format/countdown';

const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;

describe('formatCountdown', () => {
  it.each([
    [2 * D + 3 * H + 15 * M + 42 * S, '2 hari 03:15:42', '2d 03:15:42'],
    [D - S, '23:59:59', '23:59:59'],
    [H, '01:00:00', '01:00:00'],
    [H - S, '00:59:59', '00:59:59'],
    [45 * M + 9 * S, '00:45:09', '00:45:09'],
    [37 * S, '00:00:37', '00:00:37'],
    [S, '00:00:01', '00:00:01'],
    [0, '00:00:00', '00:00:00'],
  ])('%i ms: %s / %s', (ms, id, en) => {
    expect(formatCountdown(ms, 'id')).toBe(id);
    expect(formatCountdown(ms, 'en')).toBe(en);
  });

  it('never turns into "45 menit" under an hour, and never goes negative', () => {
    expect(formatCountdown(45 * M, 'id')).toMatch(/^\d\d:\d\d:\d\d$/);
    expect(formatCountdown(-1, 'id')).toBeNull();
    expect(formatCountdown(-10 * M, 'en')).toBeNull();
  });

  it('a spoken label once a minute', () => {
    expect(countdownLabel(45 * M + 9 * S, 'id')).toBe('sisa 45 menit');
    expect(countdownLabel(45 * M + 9 * S, 'en')).toBe('45 minutes left');
    expect(countdownLabel(2 * D + 3 * H + 15 * M, 'id')).toBe('sisa 2 hari 3 jam');
    expect(countdownLabel(H + M, 'en')).toBe('1 hour 1 minute left');
    expect(countdownLabel(30 * S, 'id')).toBe('sisa kurang dari 1 menit');
    expect(countdownLabel(-1, 'id')).toBeNull();
  });
});
