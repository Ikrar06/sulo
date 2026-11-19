// The urgency of a due time as a text color, the same on the phone and in the
// extension (core tasks/group.ts urgencyOf): overdue red, within a day the
// "soon" yellow, within three days the "week" blue, later muted.

import type { Urgency } from '@sulo/core/tasks/group';

export const URGENCY_TEXT: Record<Urgency, string> = {
  overdue: 'text-urgency-overdue',
  day: 'text-urgency-soon',
  threeDays: 'text-urgency-week',
  normal: 'text-muted-foreground',
};
