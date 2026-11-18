// The task card of the phone's Tugas list, as a plain view: the course chip
// and the time left on row 1, the title (two lines at most) and the check
// circle on row 2. Tugas feeds it real tasks; the onboarding's first scene
// shows the very same card with synthetic ones.

import type { ReactNode } from 'react';
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
}

export function TaskCardView({ course, color, title, relative, tone, date, done, doneLabel, onDone, onOpen }: TaskCardViewProps) {
  return (
    <Card dense onPress={onOpen} label={onOpen ? title : undefined}>
      {/* Row 1: the course; the time left in its urgency color, then the date when it fits. */}
      <div className="flex items-center gap-2">
        <span className="min-w-0 shrink">
          <Chip small color={color}>
            {course}
          </Chip>
        </span>
        <span className="ml-auto flex min-w-0 shrink-0 items-baseline justify-end overflow-hidden text-m12 whitespace-nowrap tabular-nums">
          <span className={tone}>{relative}</span>
          {date}
        </span>
      </div>
      {/* Row 2: the title (two lines at most) and the check circle at its middle. */}
      <div className="mt-1 flex items-center gap-3">
        <p className={`line-clamp-2 min-w-0 flex-1 text-m15 ${done ? 'text-muted-foreground line-through' : ''}`}>{title}</p>
        {/* 28 px, centered on the title without making the row taller. */}
        <span className="-my-1 flex">
          <CheckCircle checked={done} onChange={onDone} label={doneLabel} />
        </span>
      </div>
    </Card>
  );
}
