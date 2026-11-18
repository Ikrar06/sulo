// The bottom tab bar: five tabs with the dashboard's icons and labels. The
// Tugas tab shows how many tasks are overdue, in a neutral badge (never
// red: a count is information, not an alarm). Clear of the gesture bar.

import type { ComponentType, SVGProps } from 'react';
import { AttendanceIcon, CalendarIcon, HomeIcon, MoreIcon, TasksIcon } from '@sulo/ui/dashboard-icons';
import { TABS, type Tab } from './nav';

const ICONS: Record<Tab, ComponentType<SVGProps<SVGSVGElement>>> = {
  ringkasan: HomeIcon,
  tugas: TasksIcon,
  kalender: CalendarIcon,
  presensi: AttendanceIcon,
  lainnya: MoreIcon,
};

export function TabBar({ active, overdue, onSelect, label, labels, overdueLabel }: { active: Tab; overdue: number; onSelect: (tab: Tab) => void; label: string; labels: Record<Tab, string>; overdueLabel: (n: number) => string }) {
  return (
    <nav aria-label={label} className="shrink-0 border-t border-border bg-surface" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => {
          const Icon = ICONS[tab];
          const on = tab === active;
          const badge = tab === 'tugas' && overdue > 0 ? overdue : 0;
          return (
            <li key={tab} className="flex-1">
              <button
                type="button"
                onClick={() => onSelect(tab)}
                aria-current={on ? 'page' : undefined}
                aria-label={badge > 0 ? `${labels[tab]}, ${overdueLabel(badge)}` : labels[tab]}
                className={`relative flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 text-[12px] leading-4 outline-none focus-ring:ring-2 focus-ring:ring-focus focus-ring:ring-inset ${on ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
              >
                <span className="relative">
                  <Icon className="size-6" />
                  {badge > 0 && (
                    <span aria-hidden="true" className="absolute -top-1 -right-3 min-w-5 rounded-full border border-border bg-surface-raised px-1 text-center text-[12px] leading-4 font-semibold text-foreground tabular-nums">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{labels[tab]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
