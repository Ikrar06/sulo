// Screens 6-9 (M8c.2): the courses to follow, the nickname, reminders (with
// "Pantau tugas baru"), and done. The screens hold their own choices; the
// flow saves them when the user moves on.

import { useEffect, useRef, useState } from 'react';
import type { OnboardingWords } from '@sulo/core/i18n/mobile-onboarding';
import { NICKNAME_MAX } from '@sulo/core/prefs';
import { BellIcon, ChevronDownIcon } from '@sulo/ui/icons';
import { Card, Chip, IconTile } from '@sulo/ui/mobile/cards';
import { PillButton, Toggle } from '@sulo/ui/mobile/controls';
import { initials, ON_SOLID, tintVar } from '@sulo/ui/mobile/tint';
import { MascotSpot, useMascotCue } from './FlyingMascot';
import { EASE_SPRING, MS } from './motion';
import { SetupLayout, useTitleFocus } from './Shell';
import { Piece, useAfter } from './Stage';

export interface CourseChoice {
  id: number;
  name: string;
  color: number | null;
  /** Shown before "Tampilkan semua" (in progress or already followed). */
  main: boolean;
}

type Progress = { index: number; total: number; label: string } | null;

export function Courses({ w, progress, courses, selected, onToggle, onNext, onBack }: { w: OnboardingWords; progress: Progress; courses: readonly CourseChoice[]; selected: ReadonlySet<number>; onToggle: (id: number) => void; onNext: () => void; onBack: (() => void) | null }) {
  const t = w.courses;
  const [all, setAll] = useState(() => courses.every((c) => c.main));
  useMascotCue({ state: 'onboarding' });
  const shown = all ? courses : courses.filter((c) => c.main || selected.has(c.id));
  const hidden = courses.length - shown.length;
  return (
    <SetupLayout
      stepKey="courses"
      progress={progress}
      title={t.title}
      body={t.body}
      back={onBack ? { label: w.back, onPress: onBack } : null}
      action={{ label: t.next(selected.size), onPress: onNext, disabled: selected.size === 0, help: t.noneHelp }}
    >
      {/* The list scrolls on its own when long; the link stays right under it. */}
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
        <ul className="space-y-2">
          {shown.map((c) => (
            <li key={c.id}>
              <CourseCard course={c} on={selected.has(c.id)} onToggle={() => onToggle(c.id)} />
            </li>
          ))}
        </ul>
        {!all && hidden > 0 && (
          <button type="button" onClick={() => setAll(true)} className="m-hit mt-2 inline-flex items-center gap-1 rounded-full px-1 text-m13 text-muted-foreground outline-none focus-ring:ring-2 focus-ring:ring-focus">
            {t.showAll}
            <ChevronDownIcon aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
    </SetupLayout>
  );
}

function CourseCard({ course, on, onToggle }: { course: CourseChoice; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onToggle}
      className={`m-hit m-press flex min-h-14 w-full items-center gap-3 rounded-card px-3 py-2 text-left outline-none focus-ring:ring-2 focus-ring:ring-focus ${on ? 'bg-m-inset shadow-[inset_0_0_0_1.5px_var(--text)]' : 'm-card'}`}
    >
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-ctl text-m13 font-semibold" style={course.color ? { background: tintVar(`course-${course.color}`), ...ON_SOLID } : { background: 'var(--m-inset)', color: 'var(--muted)' }}>
        {initials(course.name)}
      </span>
      <span className="line-clamp-2 min-w-0 flex-1 text-m15">{course.name}</span>
      <span aria-hidden="true" className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${on ? 'border-foreground bg-foreground text-bg' : 'border-muted-foreground text-transparent'}`} style={{ transitionDuration: `${MS.check}ms` }}>
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5 10 17 19 7.5" className={on ? 'm-check-draw' : ''} />
        </svg>
      </span>
    </button>
  );
}

/** Screen 7: a live preview of the greeting above a large field; the keyboard opens at once. */
export function Nickname({ w, progress, line1, initial, onNext, onSkip, onBack }: { w: OnboardingWords; progress: Progress; line1: string; initial: string; onNext: (name: string) => void; onSkip: () => void; onBack: (() => void) | null }) {
  const t = w.nickname;
  const [name, setName] = useState(initial);
  const [hop, setHop] = useState(0);
  const waved = useRef(initial.trim() !== '');
  const input = useRef<HTMLInputElement | null>(null);
  useMascotCue({ state: hop > 0 ? 'all-done' : 'onboarding', poke: hop });
  useEffect(() => input.current?.focus({ preventScroll: true }), []);
  const clean = name.trim();
  const preview = clean ? `${line1} ${clean}.` : `${line1.replace(/,\s*$/, '')}.`;
  return (
    <SetupLayout
      stepKey="nickname"
      progress={progress}
      title={t.title}
      barMascot={false}
      back={onBack ? { label: w.back, onPress: onBack } : null}
      action={{ label: w.next, onPress: () => onNext(clean) }}
      skip={{ label: w.skipStep, onPress: onSkip }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onNext(clean);
        }}
      >
        <div className="flex items-center gap-3">
          <MascotSpot size={72} />
          <p aria-live="polite" className="min-w-0 text-m18 break-words">
            {preview}
          </p>
        </div>
        <input
          ref={input}
          aria-label={t.label}
          placeholder={t.placeholder}
          maxLength={NICKNAME_MAX}
          value={name}
          enterKeyHint="next"
          autoComplete="nickname"
          onChange={(e) => {
            setName(e.target.value);
            // The first letters: one small wave.
            if (!waved.current && e.target.value.trim() !== '') {
              waved.current = true;
              setHop((n) => n + 1);
            }
          }}
          className="mt-5 h-13 w-full rounded-card border border-m-line bg-m-card px-4 text-m18 outline-none placeholder:text-muted-foreground focus-visible:border-foreground"
        />
        <p className="mt-2 text-m12 text-muted-foreground">{t.note}</p>
      </form>
    </SetupLayout>
  );
}

export interface ReminderSample {
  title: string;
  when: string;
  course: string;
}

/** Screen 8: a real (or sample) reminder drops in; three time chips; "Pantau tugas baru"; then Android's own permission dialog. */
export function Reminders({ w, progress, sample, stages, onStages, watch, watchAllowed, onWatch, onAllow, onLater, onBack }: { w: OnboardingWords; progress: Progress; sample: ReminderSample; stages: ReadonlySet<number>; onStages: (s: Set<number>) => void; watch: boolean; watchAllowed: boolean; onWatch: (on: boolean) => void; onAllow: () => void; onLater: () => void; onBack: (() => void) | null }) {
  const t = w.reminders;
  const [joy, setJoy] = useState(0);
  // Happy here; a small hop when the reminder lands and when watching is turned on.
  useMascotCue({ state: 'all-done', poke: joy });
  return (
    <SetupLayout
      stepKey="reminders"
      progress={progress}
      title={t.title}
      body={t.body}
      barMascot={false}
      back={onBack ? { label: w.back, onPress: onBack } : null}
      action={{ label: t.allow, onPress: onAllow }}
      skip={{ label: t.later, onPress: onLater }}
    >
      <div className="relative">
        <div className="flex items-start gap-3">
          <div className="relative h-[76px] min-w-0 flex-1">
            <Piece rest={{ left: 0, top: 0, width: 100, rotate: 0, scale: 1 }} from={{ y: -40 }} delay={120} duration={MS.enterLong} easing={EASE_SPRING} onIn={() => setJoy((n) => n + 1)}>
              <Card dense>
                <div className="flex items-center gap-3">
                  <IconTile color="accent" icon={BellIcon} />
                  <div className="min-w-0">
                    <p className="truncate text-m15">{sample.title}</p>
                    <p className="truncate text-m13 text-muted-foreground">{t.sample.body(sample.when, sample.course)}</p>
                  </div>
                </div>
              </Card>
            </Piece>
          </div>
          <MascotSpot size={72} />
        </div>
        <p className="mt-4 text-m13 text-muted-foreground">
          {t.stagesLabel}
        </p>
        <div role="group" aria-label={t.stagesLabel} className="mt-2 flex flex-wrap gap-2">
          {[1440, 180, 60].map((s) => (
            <Chip
              key={s}
              selected={stages.has(s)}
              onPress={() => {
                const next = new Set(stages);
                if (next.has(s)) next.delete(s);
                else next.add(s);
                onStages(next);
              }}
            >
              {`${t.stages[s]} ${t.before}`}
            </Chip>
          ))}
        </div>
        {watchAllowed && (
          <div className="mt-4">
            <Card dense>
              <label className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-m15">{t.watchTitle}</span>
                  <span className="mt-0.5 block text-m13 text-muted-foreground">{t.watchBody}</span>
                </span>
                <Toggle
                  checked={watch}
                  label={t.watchTitle}
                  onChange={(on) => {
                    onWatch(on);
                    if (on) setJoy((n) => n + 1);
                  }}
                />
              </label>
            </Card>
          </div>
        )}
      </div>
    </SetupLayout>
  );
}

/** Screen 9: the mascot large in the middle, one celebration, the real count, "Buka Sulo". */
export function Done({ w, summary, onOpen }: { w: OnboardingWords; summary: string; onOpen: () => void }) {
  const title = useTitleFocus('done');
  const [party, setParty] = useState(0);
  useMascotCue({ state: 'all-done', celebrate: party });
  useAfter(360, () => setParty(1));
  // Two seconds, or a tap anywhere.
  useAfter(2000, onOpen, true);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[calc(8px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom))]" onClick={(e) => e.target === e.currentTarget && onOpen()}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <MascotSpot size={120} />
        <h1 ref={title} tabIndex={-1} className="mt-6 text-m26 outline-none">
          {w.done.title}
        </h1>
        <p className="mt-2 max-w-[32ch] text-m15 text-muted-foreground">{summary}</p>
      </div>
      <PillButton kind="primary" full onPress={onOpen}>
        {w.done.open}
      </PillButton>
    </main>
  );
}
