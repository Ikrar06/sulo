// The floating tab bar (M8c.1): a pill 52 high on the card layer, 16 from
// the sides and 12 above the gesture bar, the faintest shadow in the light
// theme only. Icons only, 24 px: inactive ones muted; the active one in the
// text color and filled (the same drawing, never another shape), with a 4 px
// accent dot under it. Every tab is a 48x48 target with its full name for
// TalkBack (role tab); a long press shows the name. Tugas carries the
// overdue count as a 14 px neutral badge beside the icon's top right
// corner, never on the drawing.

import { useRef, useState, type ComponentType, type SVGProps } from 'react';
import { AttendanceIcon, AttendanceSolidIcon, CalendarIcon, CalendarSolidIcon, HomeIcon, HomeSolidIcon, MoreIcon, TasksIcon, TasksSolidIcon } from '@sulo/ui/dashboard-icons';
import { TABS, type Tab } from './nav';

type IconType = ComponentType<SVGProps<SVGSVGElement>>;
/** Each tab's drawing, and the same drawing filled for the selected tab. */
const ICONS: Record<Tab, { line: IconType; selected: IconType }> = {
  ringkasan: { line: HomeIcon, selected: HomeSolidIcon },
  tugas: { line: TasksIcon, selected: TasksSolidIcon },
  kalender: { line: CalendarIcon, selected: CalendarSolidIcon },
  presensi: { line: AttendanceIcon, selected: AttendanceSolidIcon },
  // Three dots have nothing to fill: selected, they take the ink color like the others, and the dot below.
  lainnya: { line: MoreIcon, selected: MoreIcon },
};

/** Hold this long for the name tooltip. */
const LONG_PRESS_MS = 450;
/** The bar's height plus its gap to the bottom: content keeps this clear (plus 24). */
export const TAB_BAR_SPACE = 52 + 12;

export function TabBar({ active, overdue, onSelect, label, labels, overdueLabel }: { active: Tab; overdue: number; onSelect: (tab: Tab) => void; label: string; labels: Record<Tab, string>; overdueLabel: (n: number) => string }) {
  const [tip, setTip] = useState<Tab | null>(null);
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const startHold = (tab: Tab) => {
    held.current = false;
    timer.current = window.setTimeout(() => {
      held.current = true;
      setTip(tab);
    }, LONG_PRESS_MS);
  };
  const endHold = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    window.setTimeout(() => setTip(null), held.current ? 900 : 0);
  };
  return (
    <nav aria-label={label} className="pointer-events-none fixed inset-x-0 z-30 px-4" style={{ bottom: 'calc(12px + var(--m-bar-inset))' }}>
      <div role="tablist" aria-label={label} className="m-card pointer-events-auto mx-auto flex h-[52px] max-w-md items-center justify-around rounded-full px-2">
        {TABS.map((tab) => {
          const on = tab === active;
          const Icon = on ? ICONS[tab].selected : ICONS[tab].line;
          const badge = tab === 'tugas' && overdue > 0 ? overdue : 0;
          return (
            <div key={tab} className="relative flex justify-center">
              <button
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={badge > 0 ? `${labels[tab]}, ${overdueLabel(badge)}` : labels[tab]}
                onClick={() => !held.current && onSelect(tab)}
                onPointerDown={() => startHold(tab)}
                onPointerUp={endHold}
                onPointerLeave={endHold}
                onContextMenu={(e) => e.preventDefault()}
                className={`relative flex size-12 flex-col items-center justify-center rounded-full outline-none focus-ring:ring-2 focus-ring:ring-focus ${on ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                <span className="relative">
                  <Icon className="size-6" />
                  {badge > 0 && (
                    <span aria-hidden="true" className="absolute -top-1.5 left-[calc(100%-2px)] flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-m-inset px-1 text-m11 leading-none text-foreground tabular-nums">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                <span aria-hidden="true" className={`absolute bottom-1.5 size-1 rounded-full ${on ? 'bg-[var(--brand-orange)]' : 'bg-transparent'}`} />
              </button>
              {tip === tab && (
                <span role="tooltip" className="m-card absolute -top-10 rounded-full px-3 py-1 text-m12 whitespace-nowrap">
                  {labels[tab]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
