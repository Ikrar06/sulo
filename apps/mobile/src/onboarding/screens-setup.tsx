// Screens 6-8 (M8c.2): the courses to follow, the nickname, reminders with
// "Pantau tugas baru". The mascot (96) stands at the top middle of each and
// reacts: a glance at the row just tapped, eyes on the field while typing,
// a hop when the switch turns on. The block (mascot, title, content) is
// centered in the stage when it is short and scrolls when it is long.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { OnboardingWords } from '@sulo/core/i18n/mobile-onboarding';
import { NICKNAME_MAX } from '@sulo/core/prefs';
import { ChevronDownIcon } from '@sulo/ui/icons';
import { Card } from '@sulo/ui/mobile/cards';
import { Toggle } from '@sulo/ui/mobile/controls';
import { Sheet } from '@sulo/ui/mobile/sheet';
import { initials, ON_SOLID, tintBg, tintVar } from '@sulo/ui/mobile/tint';
import { act, burstSparks, NotifyBanner } from './bits';
import { MascotSpot, useExpression, useMascot } from './FlyingMascot';
import { BackButton, Frame, ProgressBar, TextLink, useTitleFocus, type FrameAction } from './Frame';
import { haptic } from './haptics';
import { EASE_SPRING, SHORT_SCREEN } from './motion';

export interface CourseChoice {
  id: number;
  name: string;
  color: number | null;
  /** Shown before "Tampilkan semua" (in progress or already followed). */
  main: boolean;
}

type Progress = { index: number; total: number; label: string } | null;

/** The mascot on the setup screens: 120, or 96 on a short phone. */
export const SETUP_MASCOT = SHORT_SCREEN ? 96 : 120;
/**
 * A gap between groups grows to this at most. 40 was asked for; on a tall
 * phone that leaves one void of over 100 px under a short screen (the
 * reminders), which breaks the 72 px rule, so the free height is shared out
 * evenly, up to 72 between groups and 56 under the last one.
 */
const GAP_MAX = 72;
/** A step change takes this long to bring the new content in (110 ms wait + 240 ms, styles.css). */
const STEP_IN_MS = 360;
const SUPPORT = 'mt-1.5 text-center text-m15r text-muted-foreground';

/** A flexible space between two parts of a setup screen: at least `min`, growing up to `max` when the stage has room. */
export function Gap({ min = 16, max = GAP_MAX, grow = 2 }: { min?: number; max?: number; grow?: number }) {
  return <div aria-hidden="true" className="shrink-0" style={{ flex: `${grow} 1 ${min}px`, minHeight: min, maxHeight: max }} />;
}

/** A setup screen: back and progress on top, the centered block, the fixed action block. */
function SetupFrame({ w, stepKey, progress, onBack, title, support, hint, primary, secondary, children, sparksRef, fitKeyboard = false }: { w: OnboardingWords; stepKey: string; progress: Progress; onBack: (() => void) | null; title: string; /** The nickname screen: with the keyboard up and too little height, the block tightens, then the mascot steps out, so the title, the field and the button all show without scrolling. */ fitKeyboard?: boolean; /** The supporting line's slot, centered under the title. */ support?: ReactNode; hint?: ReactNode; primary: FrameAction; secondary?: ReactNode; children: ReactNode; sparksRef?: React.Ref<HTMLDivElement> }) {
  const titleRef = useTitleFocus(stepKey);
  const scroller = useRef<HTMLDivElement | null>(null);
  // The edge fade only when the content overflows, and only once the screen has arrived (see styles.css).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const check = () => el.classList.toggle('is-long', el.scrollHeight > el.clientHeight + 1);
    const id = window.setTimeout(check, STEP_IN_MS);
    const ro = new ResizeObserver(() => el.classList.contains('is-long') !== el.scrollHeight > el.clientHeight + 1 && check());
    const late = window.setTimeout(() => ro.observe(el), STEP_IN_MS);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(late);
      ro.disconnect();
    };
  }, []);
  // 0: as designed. 1: mascot 72, tighter spacing. 2: no mascot, tighter spacing.
  const [tight, setTight] = useState<0 | 1 | 2>(0);
  useLayoutEffect(() => {
    if (!fitKeyboard) return;
    const el = scroller.current;
    if (!el) return;
    const check = () => {
      const typing = el.contains(document.activeElement) && document.activeElement?.tagName === 'INPUT';
      const over = el.scrollHeight > el.clientHeight + 1;
      setTight((t) => {
        if (!typing) return 0;
        if (over && t < 2) return (t + 1) as 1 | 2;
        return t;
      });
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', check);
    return () => {
      ro.disconnect();
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', check);
    };
  }, [fitKeyboard, tight]);
  const mascotSize = tight === 0 ? SETUP_MASCOT : 72;
  return (
    <Frame
      topLeft={
        <>
          {onBack && <BackButton label={w.back} onPress={onBack} />}
          {progress && <ProgressBar {...progress} />}
        </>
      }
      hint={hint}
      primary={primary}
      secondary={secondary}
    >
      {/* The mascot hangs from the top, the same size at the same place on all three setup screens, so it never jumps between steps. */}
      <div ref={scroller} className="onb-scroll -mx-4 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4">
        <div className={`flex min-h-full flex-col ${tight ? 'pt-[8px]' : 'pt-[20px]'}`} data-onb-tight={tight || undefined}>
          {tight < 2 && (
            <div ref={sparksRef} className="relative mx-auto">
              <MascotSpot size={mascotSize} />
            </div>
          )}
          <h1 ref={titleRef} tabIndex={-1} className={`onb-title text-center outline-none ${tight === 2 ? '' : tight ? 'mt-[8px]' : 'mt-[16px]'}`}>
            {title}
          </h1>
          {support}
          {/* Each group of content follows a Gap, and one closes the column: the free height is shared out evenly. */}
          {children}
          <Gap min={0} max={56} grow={1} />
        </div>
      </div>
    </Frame>
  );
}

export function Courses({ w, progress, courses, selected, onToggle, onNext, onBack }: { w: OnboardingWords; progress: Progress; courses: readonly CourseChoice[]; selected: ReadonlySet<number>; onToggle: (id: number) => void; onNext: () => void; onBack: (() => void) | null }) {
  const t = w.courses;
  const mascot = useMascot();
  const [all, setAll] = useState(() => courses.every((c) => c.main));
  useExpression('neutral');
  const shown = all ? courses : courses.filter((c) => c.main || selected.has(c.id));
  const hidden = courses.length - shown.length;
  return (
    <SetupFrame w={w} stepKey="courses" progress={progress} onBack={onBack} title={t.title} support={<p className={SUPPORT}>{t.body}</p>} hint={<span role="status">{selected.size > 0 ? t.selected(selected.size) : t.none}</span>} primary={{ label: w.next, onPress: onNext, disabled: selected.size === 0 }}>
      <Gap />
      <ul className="space-y-2">
        {shown.map((c) => (
          <li key={c.id}>
            <CourseRow
              course={c}
              on={selected.has(c.id)}
              onToggle={(el) => {
                haptic('light');
                mascot.lookAt(el, 900);
                if (!selected.has(c.id)) mascot.flash('happy', 600);
                onToggle(c.id);
              }}
            />
          </li>
        ))}
      </ul>
      {!all && hidden > 0 && <Gap min={12} max={40} grow={1} />}
      {!all && hidden > 0 && (
        <button type="button" onClick={() => setAll(true)} className="m-hit inline-flex items-center gap-1 self-start rounded-full px-1 text-m13 text-muted-foreground outline-none focus-ring:ring-2 focus-ring:ring-focus">
          {t.showAll}
          <ChevronDownIcon aria-hidden="true" className="size-4" />
        </button>
      )}
    </SetupFrame>
  );
}

/** Chosen: the row takes a tint of its course color and the circle fills; not chosen: a plain card, dimmed to 60 %. No border either way. */
function CourseRow({ course, on, onToggle }: { course: CourseChoice; on: boolean; onToggle: (el: HTMLElement) => void }) {
  const tint = course.color ? (`course-${course.color}` as const) : 'neutral';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={(e) => onToggle(e.currentTarget)}
      className={`m-hit onb-row flex min-h-14 w-full items-center gap-3 rounded-card px-3 py-2 text-left outline-none focus-ring:ring-2 focus-ring:ring-focus ${on ? 'is-on' : 'm-card'}`}
      style={{ '--row-tint': tintBg(tint, 16, 'var(--m-card)') } as CSSProperties}
    >
      <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-ctl text-m13 font-semibold transition-opacity duration-150 ${on ? '' : 'opacity-60'}`} style={course.color ? { background: tintVar(`course-${course.color}`), ...ON_SOLID } : { background: 'var(--m-inset)' }}>
        {initials(course.name)}
      </span>
      <span className={`min-w-0 flex-1 text-m15 transition-opacity duration-150 ${on ? '' : 'opacity-60'}`}>{course.name}</span>
      <span aria-hidden="true" className={`onb-check inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'is-on border-foreground bg-foreground text-bg' : 'border-muted-foreground text-transparent'}`}>
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5 10 17 19 7.5" />
        </svg>
      </span>
    </button>
  );
}

/** Screen 7: the greeting, large, changes with every letter; the field has the focus so the keyboard is up. */
export function Nickname({ w, progress, line1, initial, onNext, onSkip, onBack }: { w: OnboardingWords; progress: Progress; line1: string; initial: string; onNext: (name: string) => void; onSkip: () => void; onBack: (() => void) | null }) {
  const t = w.nickname;
  const mascot = useMascot();
  const [name, setName] = useState(initial);
  const greeted = useRef(initial.trim() !== '');
  const input = useRef<HTMLInputElement | null>(null);
  useExpression('neutral');
  useEffect(() => {
    // The field takes the focus once the screen has arrived: the keyboard
    // resizes the page, and that must not happen in the middle of the slide.
    const focus = window.setTimeout(() => input.current?.focus({ preventScroll: true }), STEP_IN_MS);
    // The keyboard takes half the screen: the field stays in view when the stage shrinks.
    const show = () => input.current?.scrollIntoView({ block: 'nearest' });
    window.visualViewport?.addEventListener('resize', show);
    window.addEventListener('resize', show);
    // Eyes on the field.
    const id = window.setTimeout(() => mascot.lookAt(input.current, 0), STEP_IN_MS + 60);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(focus);
      window.visualViewport?.removeEventListener('resize', show);
      window.removeEventListener('resize', show);
      mascot.lookAt(null);
    };
  }, [mascot]);
  const clean = name.trim();
  // Without a name: the greeting alone, no comma.
  const preview = clean ? `${line1} ${clean}.` : `${line1.replace(/,\s*$/, '')}.`;
  return (
    <SetupFrame
      fitKeyboard
      w={w}
      stepKey="nickname"
      progress={progress}
      onBack={onBack}
      title={t.title}
      support={
        // The live greeting in the supporting line: muted while empty, the text color once there is a letter.
        <p aria-live="polite" className={`onb-greeting mt-1.5 text-center break-words ${clean ? 'text-foreground' : 'text-muted-foreground'}`}>
          {preview}
        </p>
      }
      primary={{ label: w.next, onPress: () => onNext(clean) }}
      secondary={<TextLink onPress={onSkip}>{w.skip}</TextLink>}
    >
      <Gap />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onNext(clean);
        }}
      >
        <input
          ref={input}
          aria-label={t.label}
          placeholder={t.label}
          maxLength={NICKNAME_MAX}
          value={name}
          enterKeyHint="next"
          autoComplete="nickname"
          autoCapitalize="words"
          onChange={(e) => {
            const v = e.target.value;
            setName(v);
            // The eyes follow the text as it grows.
            const r = e.target.getBoundingClientRect();
            mascot.lookAt({ x: r.left + 24 + Math.min(1, v.length / NICKNAME_MAX) * (r.width - 48), y: r.top + r.height / 2 }, 0);
            if (!greeted.current && v.trim() !== '') {
              greeted.current = true;
              mascot.flash('happy', 900);
              mascot.hop();
            }
            if (v.trim() === '') greeted.current = false;
          }}
          className="h-13 w-full rounded-card border border-m-line bg-m-card px-4 text-m18 outline-none placeholder:text-muted-foreground focus-visible:border-foreground"
        />
        <p className="mt-2 text-m12 text-muted-foreground">{t.note}</p>
      </form>
    </SetupFrame>
  );
}

export interface ReminderSample {
  title: string;
  course: string;
}

const STAGES = [1440, 180, 60] as const;

/** Screen 8: the mascot presents a real-size reminder for the user's nearest task; three short chips; the watch switch with its one line and "Detail". */
export function Reminders({ w, progress, sample, stages, onStages, watch, watchAllowed, onWatch, onAllow, onLater, onBack }: { w: OnboardingWords; progress: Progress; sample: ReminderSample; stages: ReadonlySet<number>; onStages: (s: Set<number>) => void; watch: boolean; watchAllowed: boolean; onWatch: (on: boolean) => void; onAllow: () => void; onLater: () => void; onBack: (() => void) | null }) {
  const t = w.reminders;
  const mascot = useMascot();
  const [detail, setDetail] = useState(false);
  /** The stage the banner shows: the one touched last, else the nearest one that is on. */
  const [shownStage, setShownStage] = useState<number>(() => [...stages].sort((a, b) => a - b)[0] ?? 180);
  const banner = useRef<HTMLDivElement | null>(null);
  const when = useRef<HTMLSpanElement | null>(null);
  const sparks = useRef<HTMLDivElement | null>(null);
  useExpression('happy');
  useLayoutEffect(() => {
    const a = act(
      banner.current,
      560,
      [
        { at: 0, opacity: 0, transform: 'translateY(-28px)' },
        { at: 140, opacity: 0, transform: 'translateY(-28px)', easing: EASE_SPRING },
        { at: 560, opacity: 1, transform: 'translateY(0)' },
      ],
      false,
    );
    const id = window.setTimeout(() => mascot.lookAt(banner.current, 900), 200);
    return () => {
      window.clearTimeout(id);
      a?.cancel();
    };
  }, [mascot]);
  const toggleStage = (s: number) => {
    const next = new Set(stages);
    // One stage always stays on.
    if (next.has(s) && next.size === 1) return;
    if (next.has(s)) next.delete(s);
    else next.add(s);
    haptic('light');
    onStages(next);
    setShownStage(next.has(s) ? s : ([...next].sort((a, b) => a - b)[0] ?? 180));
    mascot.lookAt(banner.current, 700);
    act(
      when.current,
      240,
      [
        { at: 0, opacity: 0.2, transform: 'translateY(4px)' },
        { at: 240, opacity: 1, transform: 'translateY(0)' },
      ],
      false,
    );
  };
  return (
    <>
      <SetupFrame w={w} stepKey="reminders" progress={progress} onBack={onBack} title={t.title} primary={{ label: t.allow, onPress: onAllow }} secondary={<TextLink onPress={onLater}>{t.later}</TextLink>} sparksRef={sparks}>
        <Gap />
        <div ref={banner}>
          <NotifyBanner
            wrap
            title={sample.title}
            body={
              <>
                <span ref={when} className="inline-block text-primary">
                  {t.inTime(t.stages[shownStage] ?? '')}
                </span>
                {` · ${sample.course}`}
              </>
            }
          />
        </div>
        <Gap />
        <p className="text-m13 text-muted-foreground">{t.stagesLabel}</p>
        <div role="group" aria-label={t.stagesLabel} className="mt-2 flex gap-2">
          {STAGES.map((s) => (
            <button key={s} type="button" aria-pressed={stages.has(s)} onClick={() => toggleStage(s)} className={`m-hit onb-press h-9 min-w-0 flex-1 rounded-full text-m13 font-medium whitespace-nowrap outline-none focus-ring:ring-2 focus-ring:ring-focus ${stages.has(s) ? 'bg-foreground text-bg' : 'bg-m-inset'}`}>
              {t.stages[s]}
            </button>
          ))}
        </div>
        {watchAllowed && (
          <>
            <Gap />
            <Card dense>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-m15 font-medium">{t.watchTitle}</p>
                  <p className="mt-0.5 text-m13 text-muted-foreground">
                    {t.watchBody}{' '}
                    <button type="button" onClick={() => setDetail(true)} className="m-hit rounded text-foreground underline underline-offset-4 outline-none focus-ring:ring-2 focus-ring:ring-focus">
                      {t.detail}
                    </button>
                  </p>
                </div>
                <Toggle
                  checked={watch}
                  label={t.watchTitle}
                  onChange={(on) => {
                    onWatch(on);
                    haptic('light');
                    if (on) {
                      mascot.hop();
                      mascot.flash('happy', 900);
                      burstSparks(sparks.current, 8);
                    }
                  }}
                />
              </div>
            </Card>
          </>
        )}
      </SetupFrame>
      <Sheet open={detail} onOpenChange={setDetail} title={t.watchTitle}>
        <p className="text-m15r text-muted-foreground">{w.sheets.watch}</p>
      </Sheet>
    </>
  );
}
