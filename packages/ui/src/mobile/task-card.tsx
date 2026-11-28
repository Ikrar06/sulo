// The task card of the phone's Tugas list, as a plain view: the course chip
// and the time left on row 1, the title (two lines at most) and the check
// circle on row 2. Tugas feeds it real tasks; the onboarding's first scene
// shows the very same card with synthetic ones. A task whose grade was read
// shows the grade in the circle's place (1.1.0): it is finished, so there is
// nothing left to tick.

import type { ReactNode } from 'react';
import type { GradeBadge } from '@sulo/core/tasks/grade-view';
import { Card, Chip } from './cards';
import { CheckCircle } from './controls';
import type { TintColor } from './tint';

export interface TaskCardViewProps {
  course: string;
  color: TintColor;
  title: string;
  /** The time left ("4 jam lagi"), in `tone` (a text color class). */
  relative: string;
  tone: string;
  /** After the time left: the short date, when there is one. */
  date?: ReactNode;
  done: boolean;
  doneLabel: string;
  onDone: (done: boolean) => void;
  onOpen?: () => void;
  /** A picture of the card (the extension's onboarding scenes): the circle is not a control. */
  still?: boolean;
  /** A read grade, in the circle's place (tasks/grade-view.ts gradeBadge); with the words it needs. */
  grade?: GradeBadge | null;
  gradeLabels?: { graded: string; value: (grade: string) => string; masked: string };
}

export function TaskCardView({ course, color, title, relative, tone, date, done, doneLabel, onDone, onOpen, still = false, grade = null, gradeLabels }: TaskCardViewProps) {
  return (
    <Card dense onPress={onOpen} label={onOpen ? title : undefined}>
      {/* Row 1: the course; the time left in its urgency color, then the date when it fits. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 shrink">
          <Chip small color={color}>
            {course}
          </Chip>
        </span>
        {/* The time left, then the date: each whole, the date under the time when both do not fit on one line. */}
        <span className="ml-auto flex min-w-0 flex-wrap items-baseline justify-end text-m12 whitespace-nowrap tabular-nums">
          <span className={tone}>{relative}</span>
          {date}
        </span>
      </div>
      {/* Row 2: the title (two lines at most) and the check circle at its middle. */}
      <div className="mt-1 flex items-center gap-3">
        <p className={`line-clamp-2 min-w-0 flex-1 text-m15 ${done ? 'text-muted-foreground line-through' : ''}`}>{title}</p>
        {/* 28 px, centered on the title without making the row taller. */}
        <span className="-my-1 flex">
          {grade && gradeLabels ? <GradePill grade={grade} labels={gradeLabels} /> : <CheckCircle checked={done} onChange={onDone} label={doneLabel} still={still} />}
        </span>
      </div>
    </Card>
  );
}

/**
 * The grade where the circle was: as tall as the circle (28), on the inset layer, the number in the text color and
 * tabular; "Dinilai" muted while grades are hidden; a mask in privacy mode. Not a control (the card opens).
 */
export function GradePill({ grade, labels }: { grade: GradeBadge; labels: NonNullable<TaskCardViewProps['gradeLabels']> }) {
  const text = grade.kind === 'value' ? grade.text : grade.kind === 'masked' ? '•••' : labels.graded;
  const name = grade.kind === 'value' ? labels.value(grade.text) : grade.kind === 'masked' ? labels.masked : labels.graded;
  return (
    <span
      role="img"
      aria-label={name}
      className={`inline-flex h-7 shrink-0 items-center rounded-full bg-m-inset px-2.5 whitespace-nowrap tabular-nums select-none ${grade.kind === 'value' ? 'text-m13 font-semibold text-foreground' : 'text-m12 font-medium text-muted-foreground'} ${grade.kind === 'masked' ? 'tracking-widest' : ''}`}
    >
      {text}
    </span>
  );
}
