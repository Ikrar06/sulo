// Which Moodle notifications mean what. Recognised by the component and
// eventtype pair, never by the subject (translated text). One data table,
// tested, easy to correct once real samples arrive (docs/ROADMAP.md M4).
// Pairs not listed here are "other": logged, no Sulo notification.

export type NotificationKind = 'grade_feedback' | 'forum' | 'other';

interface Rule {
  component: string;
  /** null matches any eventtype of the component. */
  eventtype: string | null;
  kind: NotificationKind;
}

/** Order matters: the first matching rule wins. Pairs marked "estimate" still need a real sample. */
export const NOTIFICATION_RULES: readonly Rule[] = [
  // Assignment graded or feedback given (estimate).
  { component: 'mod_assign', eventtype: 'assign_notification', kind: 'grade_feedback' },
  // Rubric or marking guide feedback (estimate).
  { component: 'gradingform', eventtype: 'gradingform_notification', kind: 'grade_feedback' },
  // Quiz attempt graded manually (estimate).
  { component: 'mod_quiz', eventtype: 'attempt_grading_complete', kind: 'grade_feedback' },
  // Gradebook feedback (estimate).
  { component: 'moodle', eventtype: 'gradenotifications', kind: 'grade_feedback' },
  // Forum posts, announcements and digests (estimate).
  { component: 'mod_forum', eventtype: 'posts', kind: 'forum' },
  { component: 'mod_forum', eventtype: 'digests', kind: 'forum' },
  { component: 'mod_forum', eventtype: null, kind: 'forum' },
];

export function notificationKind(component: string, eventtype: string): NotificationKind {
  const rule = NOTIFICATION_RULES.find((r) => r.component === component && (r.eventtype === null || r.eventtype === eventtype));
  return rule?.kind ?? 'other';
}
