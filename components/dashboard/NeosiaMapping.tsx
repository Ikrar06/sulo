// "Jadwal dari NEOSIA" on the Mata kuliah page (M7 part E4): NEOSIA courses
// that were not linked by their code, each with a choice of SIKOLA course.
// A manual choice is stored in neosia:courseMap and wins over the code.

import { useMemo } from 'react';
import { useI18n } from '@/components/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { courseNameWithClass } from '@/lib/courses/display-name';
import { neosiaWords } from '@/lib/i18n/neosia';
import { setCourseLink } from '@/lib/neosia/course-map';
import { distinctCourses, linkedMeetings } from '@/lib/neosia/linked';
import { classMeetings } from '@/lib/neosia/view';
import { local, type DashboardData } from './data';
import { Card } from './Shell';

const NONE = 'none';

export function NeosiaMapping({ data }: { data: DashboardData }) {
  const { locale } = useI18n();
  const w = neosiaWords(locale).mapping;
  const courses = data.user?.courses ?? [];
  // Shown: every course not linked by code (manual links stay here so they can be changed).
  const rows = useMemo(() => distinctCourses(linkedMeetings(classMeetings(data.neosia.snapshots), courses, data.neosia.courseMap)).filter((m) => m.how !== 'code'), [data.neosia, courses]);
  if (!data.neosia.module.enabled || rows.length === 0) return null;
  const sorted = [...courses].sort((a, b) => courseNameWithClass(a).localeCompare(courseNameWithClass(b), 'id'));
  return (
    <Card title={w.title}>
      <p className="mb-3 max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{w.help}</p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_280px] md:items-center">
            <p className="min-w-0 text-[14px]">
              <span className="font-semibold">{r.displayName}</span>
              {r.code && <span className="ml-2 rounded bg-surface-raised px-1 font-mono text-[12px] leading-5">{r.code}</span>}
            </p>
            <Select value={r.course ? String(r.course.id) : NONE} onValueChange={(v) => void setCourseLink(local, r.key, v === NONE ? null : Number(v))}>
              <SelectTrigger aria-label={`${w.choose}: ${r.displayName}`} className="w-full">
                <SelectValue placeholder={w.choose} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{w.none}</SelectItem>
                {sorted.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {courseNameWithClass(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </li>
        ))}
      </ul>
    </Card>
  );
}
