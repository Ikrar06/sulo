// The phone's own calendar (1.1.0, owner 27 Nov 2026): iOS's add-event sheet (ios/.../SuloCalendarPlugin.swift)
// or the Android calendar app's new-event screen (android/.../calendar/SuloCalendarPlugin.kt), filled with one
// task, the same event as Google's link and the .ics file (core format/task-event.ts). The web preview and
// Vitest have no device calendar: there only Google's link is offered.

import { Capacitor, registerPlugin } from '@capacitor/core';
import type { TaskEvent } from '@sulo/core/format/task-event';

/** iPhone: saved, canceled, or calendar access refused (iOS 16 only); Android: opened, or no calendar app. */
export type AddResult = 'saved' | 'canceled' | 'denied' | 'opened' | 'unavailable';

interface SuloCalendarPlugin {
  addEvent(event: { title: string; startAt: number; endAt: number; notes: string; url?: string }): Promise<{ result: AddResult }>;
}

const SuloCalendar = registerPlugin<SuloCalendarPlugin>('SuloCalendar');

/** Whether there is a device calendar to add to (the app, not the web preview). */
export const hasDeviceCalendar = (): boolean => Capacitor.isNativePlatform();

export const isIphone = (): boolean => Capacitor.getPlatform() === 'ios';

export async function addToDeviceCalendar(event: TaskEvent): Promise<AddResult> {
  try {
    const { result } = await SuloCalendar.addEvent({ title: event.title, startAt: event.startAt, endAt: event.endAt, notes: event.notes, ...(event.url ? { url: event.url } : {}) });
    return result;
  } catch {
    return 'unavailable';
  }
}
