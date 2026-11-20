import { describe, expect, it } from 'vitest';
import { afterStage, DONE_MS, holdLeft, IDLE, MIN_RUNNING_MS, running, statusLine } from '../src/shell/sync-status';

const words = { updating: 'Memperbarui dari SIKOLA…', stages: { tasks: 'Mengambil tugas…', courses: 'Memeriksa mata kuliah…', attendance: 'Mengambil presensi…' }, upToDate: 'Sudah terbaru' };

describe('the updating line follows the real stages, not a timer', () => {
  it('starts at the tasks and moves only when runSync says a stage ended well', () => {
    let ui = running();
    expect(statusLine(ui, words)).toBe('Mengambil tugas…');
    ui = afterStage(ui, 'tasks', 'ok');
    expect(statusLine(ui, words)).toBe('Memeriksa mata kuliah…');
    ui = afterStage(ui, 'courses', 'ok');
    expect(statusLine(ui, words)).toBe('Mengambil presensi…');
    // A failed stage leaves the line for the outcome to decide.
    expect(afterStage(ui, 'attendance', 'failed')).toEqual(ui);
  });

  it('stages arriving when nothing runs change nothing', () => {
    expect(afterStage(IDLE, 'tasks', 'ok')).toEqual(IDLE);
  });

  it('done and failed lines', () => {
    expect(statusLine({ phase: 'done', stage: null }, words)).toBe('Sudah terbaru');
    expect(statusLine({ phase: 'failed', stage: null, message: 'Belum bisa memperbarui.' }, words)).toBe('Belum bisa memperbarui.');
    expect(statusLine(IDLE, words)).toBe('');
  });
});

describe('timing', () => {
  it('a sync under 400 ms still shows its updating state 400 ms', () => {
    expect(MIN_RUNNING_MS).toBe(400);
    expect(holdLeft(1000, 1150)).toBe(250);
    expect(holdLeft(1000, 1600)).toBe(0);
  });

  it('"Sudah terbaru" stays 2 seconds', () => {
    expect(DONE_MS).toBe(2000);
  });
});
