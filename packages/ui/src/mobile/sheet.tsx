// Bottom sheets for choices and menus on the phone (instead of a dropdown):
// a small handle, top radius 24, rising in 240 ms and leaving in 200 ms
// (styles in the app, motion rules in sheet-motion.ts). Built on Radix
// Dialog for focus and Escape; the Android back button closes the newest
// sheet through closeTopSheet. Every sheet in the app goes through this one
// component.
//
// Closing stays on the compositor: only the sheet's transform and the
// scrim's opacity animate. At the start of the exit the sheet is pinned in
// px (top and height) and a text field inside it is blurred, so the keyboard
// going down (and the viewport growing) never moves it; it is unmounted on
// animationend, with a timeout guard. Work the caller hands to
// afterSheetClosed runs after that, one frame later.

import { Dialog } from 'radix-ui';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { Input } from '../ui/input';
import { CheckIcon, ChevronRightIcon } from '../icons';
import { CLOSE_MS, DRAG_SLOP_PX, GUARD_MS, REDUCED_MS, afterSheetClosed, dragEnd, pushSheet, releaseSpeed, sheetClosed, sheetClosing } from './sheet-motion';

export { afterSheetClosed, closeTopSheet, flushSheetWork } from './sheet-motion';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Far enough below the largest viewport the page can get (the keyboard going down grows it). */
const bottomEdge = () => Math.max(window.innerHeight, window.screen?.height ?? 0);

type Phase = 'open' | 'closing' | 'gone';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

/** Closes the sheet this is called inside: the exit runs first, the caller hears onOpenChange(false) once it is gone. */
const CloseContext = createContext<() => void>(() => undefined);
export const useSheetClose = () => useContext(CloseContext);

export function Sheet({ open: wanted, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode }) {
  /**
   * A close from inside (scrim, Escape, Back, a drag, useSheetClose) starts
   * the exit here and tells the caller only after it: the screen behind
   * re-renders once the sheet is gone, never during its exit.
   */
  const [requested, setRequested] = useState(false);
  if (!wanted && requested) setRequested(false);
  const open = wanted && !requested;
  const requestedRef = useRef(requested);
  requestedRef.current = requested;
  const requestClose = useCallback(() => setRequested(true), []);
  const [phase, setPhase] = useState<Phase>(open ? 'open' : 'gone');
  // Radix's portal mounts its children one render late: the node is state, so the effects see it.
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  content.current = node;
  const scrim = useRef<HTMLDivElement | null>(null);
  /** What the sheet showed last while open: kept during the exit, so it never empties or shrinks while leaving. */
  const shown = useRef({ title, children });
  if (open) shown.current = { title, children };
  const drag = useRef<{ y0: number; x0: number; on: boolean; off: number; samples: { t: number; y: number }[] } | null>(null);
  const changeRef = useRef(onOpenChange);
  changeRef.current = onOpenChange;

  if (open && phase !== 'open') setPhase('open');
  if (!open && phase === 'open') setPhase('closing');

  // Open: clear what a previous exit pinned; register for the back button.
  useLayoutEffect(() => {
    if (!open) return;
    const el = content.current;
    if (el) {
      for (const k of ['top', 'bottom', 'height', 'max-height', 'transform', 'transition', 'will-change', '--m-sheet-from', '--m-sheet-exit', '--m-sheet-dur', '--m-sheet-ease', '--m-scrim-from']) el.style.removeProperty(k);
    }
    scrim.current?.style.removeProperty('opacity');
    scrim.current?.style.removeProperty('transition');
    return pushSheet(requestClose);
  }, [open, node]);

  // The exit starts: pin, blur, then unmount on animationend (or the guard).
  useLayoutEffect(() => {
    if (phase !== 'closing') return;
    sheetClosing();
    const el = content.current;
    const reduced = reducedMotion();
    if (el) {
      const offset = drag.current?.off ?? 0;
      const rect = el.getBoundingClientRect();
      const top = rect.top - offset;
      el.style.setProperty('top', `${top}px`);
      el.style.setProperty('bottom', 'auto');
      el.style.setProperty('height', `${rect.height}px`);
      el.style.setProperty('max-height', 'none');
      el.style.setProperty('--m-sheet-exit', `${Math.ceil(bottomEdge() - top)}px`);
      el.style.removeProperty('transition');
      if (el.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    }
    drag.current = null;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setPhase('gone');
      requestAnimationFrame(() => {
        if (requestedRef.current) changeRef.current(false);
        sheetClosed();
      });
    };
    const ms = reduced ? REDUCED_MS : Number.parseFloat(el?.style.getPropertyValue('--m-sheet-dur') || '') || CLOSE_MS;
    const onEnd = (e: AnimationEvent) => e.target === el && finish();
    el?.addEventListener('animationend', onEnd);
    const timer = setTimeout(finish, ms + GUARD_MS);
    return () => {
      el?.removeEventListener('animationend', onEnd);
      clearTimeout(timer);
      if (!done) sheetClosed();
    };
  }, [phase]);

  // Drag down to dismiss, following the finger (touch only; none under reduced motion).
  useEffect(() => {
    const el = node;
    if (!el || phase !== 'open') return;
    const scrolledAbove = (target: EventTarget | null) => {
      for (let n = target as HTMLElement | null; n && n !== el.parentElement; n = n.parentElement) if (n.scrollTop > 0) return true;
      return false;
    };
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || !t || reducedMotion() || scrolledAbove(e.target) || (e.target as HTMLElement).closest('input, textarea')) return void (drag.current = null);
      drag.current = { y0: t.clientY, x0: t.clientX, on: false, off: 0, samples: [{ t: e.timeStamp, y: t.clientY }] };
    };
    const onMove = (e: TouchEvent) => {
      const d = drag.current;
      const t = e.touches[0];
      if (!d || !t) return;
      const dy = t.clientY - d.y0;
      if (!d.on) {
        if (Math.abs(t.clientX - d.x0) > Math.abs(dy) || dy < DRAG_SLOP_PX) {
          if (Math.abs(dy) > DRAG_SLOP_PX || Math.abs(t.clientX - d.x0) > DRAG_SLOP_PX) drag.current = null;
          return;
        }
        d.on = true;
        d.y0 = t.clientY;
        el.style.setProperty('transition', 'none');
        // Its own layer only while the finger moves it (and its glide back), never permanently.
        el.style.setProperty('will-change', 'transform');
      }
      e.preventDefault();
      d.off = Math.max(0, t.clientY - d.y0);
      d.samples = [...d.samples.slice(-5), { t: e.timeStamp, y: t.clientY }];
      el.style.setProperty('transform', `translateY(${d.off}px)`);
      if (scrim.current) scrim.current.style.setProperty('opacity', String(Math.max(0, 1 - d.off / el.offsetHeight)));
    };
    const onEnd = () => {
      const d = drag.current;
      if (!d?.on) return void (drag.current = null);
      const exit = bottomEdge() - el.getBoundingClientRect().top + d.off;
      const end = dragEnd(d.off, releaseSpeed(d.samples), el.offsetHeight, exit);
      if (end.close) {
        el.style.setProperty('--m-sheet-from', `${d.off}px`);
        el.style.setProperty('--m-sheet-dur', `${end.durationMs}ms`);
        el.style.setProperty('--m-sheet-ease', 'linear');
        el.style.setProperty('--m-scrim-from', scrim.current?.style.opacity || '1');
        requestClose();
        return;
      }
      // Back up: the open curve, no bounce.
      drag.current = null;
      el.style.setProperty('transition', 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)');
      el.style.setProperty('transform', 'translateY(0px)');
      window.setTimeout(() => el.style.removeProperty('will-change'), 240);
      scrim.current?.style.setProperty('transition', 'opacity 200ms ease-out');
      scrim.current?.style.setProperty('opacity', '1');
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [phase, node]);

  const mounted = phase !== 'gone';
  return (
    <Dialog.Root open={open} onOpenChange={(o) => (o ? onOpenChange(true) : requestClose())}>
      {mounted && (
        <Dialog.Portal forceMount>
          <Dialog.Overlay ref={scrim} forceMount onTouchStart={stop} onTouchMove={stop} onTouchEnd={stop} className="m-scrim fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content
            ref={setNode}
            forceMount
            aria-describedby={undefined}
            // Focus goes back to what opened the sheet only once it is gone (Radix does it on unmount).
            className="m-sheet fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-[24px] bg-m-card px-4 pt-2 outline-none"
            style={{ paddingBottom: 'calc(16px + var(--m-bar-inset, env(safe-area-inset-bottom)))' }}
            // React events bubble through portals: a drag here must not reach the screen behind (pull to refresh).
            onTouchStart={stop}
            onTouchMove={stop}
            onTouchEnd={stop}
            onTouchCancel={stop}
          >
            <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-m-line" />
            <Dialog.Title className="mb-3 text-m18">{shown.current.title}</Dialog.Title>
            <CloseContext.Provider value={requestClose}>{shown.current.children}</CloseContext.Provider>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
}

/**
 * A one-field form in a sheet (a nickname, a course name): its text is local
 * state, so typing re-renders only this form; "Selesai" hands the value over
 * at once (it is saved before anything else happens), then closes the sheet.
 */
export function SheetTextForm({ label, initial, maxLength, placeholder, help, submitLabel, onSave }: { label: string; initial: string; maxLength: number; placeholder?: string; help: string; submitLabel: string; onSave: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  const close = useSheetClose();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // Saved at once (a process ended mid-animation must not lose it), then the sheet closes.
        onSave(value);
        close();
      }}
    >
      <Input autoFocus aria-label={label} maxLength={maxLength} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
      <p className="mt-2 text-m13 text-muted-foreground">{help}</p>
      <button type="submit" className="m-hit m-press mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-m15 text-primary-foreground outline-none focus-ring:ring-2 focus-ring:ring-focus">
        {submitLabel}
      </button>
    </form>
  );
}

/** A list of options in a sheet: one 48 px row each, a check on the chosen one, an optional color dot. */
export function SheetOptions<T extends string | number>({ value, options, onChoose }: { value: T; options: readonly { value: T; label: string; dot?: string }[]; onChoose: (v: T) => void }) {
  return (
    <ul role="listbox" className="rounded-card bg-m-inset px-4 py-1">
      {options.map((o) => (
        <li key={String(o.value)} role="option" aria-selected={o.value === value} className="[&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line">
          <button type="button" onClick={() => onChoose(o.value)} className="flex min-h-12 w-full items-center gap-3 text-left text-m15 outline-none focus-ring:ring-2 focus-ring:ring-focus">
            {o.dot && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: o.dot }} />}
            <span className="min-w-0 flex-1">{o.label}</span>
            {o.value === value && <CheckIcon className="size-4" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** A menu in a sheet: one 52 px row per action, an icon, its label and a chevron; rows inside one inset card with hairlines between. */
export function SheetMenu({ items }: { items: readonly { label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; onPress: () => void }[] }) {
  return (
    <ul className="rounded-card bg-m-inset px-4 py-1">
      {items.map((it) => (
        <li key={it.label} className="[&:not(:last-child)]:border-b [&:not(:last-child)]:border-m-line">
          <button type="button" onClick={it.onPress} className="flex min-h-13 w-full items-center gap-3 text-left text-m15 outline-none focus-ring:ring-2 focus-ring:ring-focus">
            <it.icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">{it.label}</span>
            <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  );
}
