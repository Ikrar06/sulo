// Where tapping a reminder leads in the app (the extension opens tabs for
// the same kinds, entrypoints/background.ts). Ids come from the core
// planner (reminders/run.ts parseNotificationId).

import { parseNotificationId } from '@sulo/core/reminders/run';
import type { Screen } from './nav';

export function screenForNotification(id: string): Screen {
  const { kind, eventId, courseId } = parseNotificationId(id);
  if (kind === 'task' && eventId !== null && Number.isFinite(eventId)) return { name: 'tugas', detail: String(eventId) };
  if (kind === 'summary' || kind === 'morning') return { name: 'tugas', detail: null };
  if (kind === 'calendar') return { name: 'kalender', detail: null };
  if (kind === 'changes' && courseId !== null && Number.isFinite(courseId)) return { name: 'kabar', detail: String(courseId) };
  if (kind === 'changes' || kind === 'changes_summary') return { name: 'kabar', detail: null };
  return { name: 'ringkasan', detail: null };
}
