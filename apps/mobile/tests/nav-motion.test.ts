import { describe, expect, it } from 'vitest';
import { back, motionBetween, open, selectTab, START } from '../src/shell/nav';

describe('screen motion follows the direction of travel', () => {
  const tugas = selectTab(START, 'tugas');
  const task = open(tugas, { name: 'tugas', detail: '7' });

  it('a detail opening slides in, from its own tab or from a card on another tab', () => {
    expect(motionBetween(tugas, task)).toBe('push');
    expect(motionBetween(START, open(START, { name: 'tugas', detail: '7' }))).toBe('push');
    // Task to task replaces the top: still forward.
    expect(motionBetween(task, open(task, { name: 'tugas', detail: '8' }))).toBe('push');
  });
  it('closing a detail brings the screen below in from the other side', () => {
    expect(motionBetween(task, back(task) as typeof task)).toBe('pop');
    // The current tab tapped again closes everything open on it.
    expect(motionBetween(task, selectTab(task, 'tugas'))).toBe('pop');
  });
  it('switching tabs and the same screen again have none', () => {
    expect(motionBetween(START, tugas)).toBeNull();
    expect(motionBetween(task, selectTab(task, 'presensi'))).toBeNull();
    expect(motionBetween(task, task)).toBeNull();
    // Android back to the previous tab is a tab switch too.
    expect(motionBetween(tugas, back(tugas) as typeof tugas)).toBeNull();
  });
});
