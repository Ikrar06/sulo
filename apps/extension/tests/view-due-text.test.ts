// What a task row shows on the right for each due-time format (core
// view/popup-view.ts dueText): only the countdown ticks, and only before
// the deadline; a far deadline shows its date alone.
import { describe, expect, it } from 'vitest';
import { dueText, type TaskRow } from '@sulo/core/view/popup-view';

const NOW = 1_795_000_000;
const row = (p: Partial<TaskRow>): TaskRow => ({ dueAt: NOW + 7200, remaining: '2 jam lagi', clock: 'Kam 14.00', left: '2 jam lagi', far: false, ...p }) as TaskRow;

describe('dueText', () => {
  it('no deadline: the remaining text only, never ticking', () => {
    expect(dueText(row({ dueAt: null, remaining: 'Tanpa tenggat' }), 'countdown', NOW, 'Asia/Makassar')).toEqual({ primary: 'Tanpa tenggat', secondary: null, ticking: false });
  });
  it('remaining and clock formats show one line', () => {
    expect(dueText(row({}), 'remaining', NOW, 'Asia/Makassar')).toEqual({ primary: '2 jam lagi', secondary: null, ticking: false });
    expect(dueText(row({}), 'clock', NOW, 'Asia/Makassar')).toEqual({ primary: 'Kam 14.00', secondary: null, ticking: false });
  });
  it('countdown ticks before the deadline and stops once late', () => {
    expect(dueText(row({}), 'countdown', NOW, 'Asia/Makassar').ticking).toBe(true);
    const late = dueText(row({ dueAt: NOW - 600 }), 'countdown', NOW, 'Asia/Makassar');
    expect(late.ticking).toBe(false);
    expect(late.primary).toMatch(/terlambat/);
  });
  it('both: time left with the clock under it, or the date alone when far', () => {
    expect(dueText(row({}), 'both', NOW, 'Asia/Makassar')).toEqual({ primary: '2 jam lagi', secondary: 'Kam 14.00', ticking: false });
    expect(dueText(row({ far: true }), 'both', NOW, 'Asia/Makassar')).toEqual({ primary: 'Kam 14.00', secondary: null, ticking: false });
  });
});
