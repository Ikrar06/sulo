// Turns a planned notice into notification text in the chosen language.
// Short title and body, following the glossaries. Never grades or other
// sensitive data: only task name, course name and due time.

import { formatDueClock, formatLeft } from '../format/time';
import type { Messages } from '../i18n';
import type { Task, UnixSeconds } from '../types';
import type { Notice } from './plan';

export type NotifyIcon = 'idle' | 'urgent' | 'sleepy';

export interface NotificationView {
  title: string;
  message: string;
  icon: NotifyIcon;
  /** Button labels: "Tunda 1 jam" and "Tandai selesai" for a single task, none otherwise. */
  buttons: string[];
}

// Short enough that the system never cuts off the time at the end of the title.
const MAX_NAME = 40;
export const shorten = (name: string) => (name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 1).trimEnd()}…` : name);

const DAY = 86_400;

export function noticeView(
  notice: Notice,
  ctx: { now: UnixSeconds; timeZone: string; m: Messages; courseName: (task: Task) => string },
): NotificationView {
  const { now, timeZone, m } = ctx;
  const n = m.notify;
  const left = (t: Task) => formatLeft(t.dueAt as UnixSeconds, now, timeZone, m);
  switch (notice.kind) {
    case 'task': {
      const t = notice.task;
      return {
        title: n.taskTitle(shorten(t.name), left(t)),
        message: n.taskBody(ctx.courseName(t), formatDueClock(t.dueAt as UnixSeconds, now, timeZone, m)),
        icon: (t.dueAt as UnixSeconds) - now <= DAY ? 'urgent' : 'idle',
        buttons: [n.snoozeButton, n.doneButton],
      };
    }
    case 'summary':
      return { title: n.summaryTitle(notice.count), message: n.summaryBody(shorten(notice.nearest.name), left(notice.nearest)), icon: 'idle', buttons: [] };
    case 'morning':
      return {
        title: n.morningTitle,
        message: n.morningBody(notice.today, notice.week, shorten(notice.nearest.name), left(notice.nearest)),
        icon: 'idle',
        buttons: [],
      };
    case 'session':
      return { title: notice.repeat ? n.sessionRepeatTitle : n.sessionTitle, message: n.sessionBody, icon: 'sleepy', buttons: [] };
  }
}
