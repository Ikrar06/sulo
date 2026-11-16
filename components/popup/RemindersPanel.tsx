import { useId, useState, type ReactNode } from 'react';
import { useI18n } from '@/components/i18n';
import { ChevronLeftIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatClock } from '@/lib/format/time';
import type { Messages } from '@/lib/i18n';
import { STAGE_OPTIONS, lastStage, type ReminderSettings, type StageMin } from '@/lib/reminders/settings';
import { zonedToUnix } from '@/lib/reminders/zoned';

// "Pengingat": reminder settings inside the popup, with a back button. The
// full settings page comes with the dashboard (M5a). Plain words from the
// glossary; no "sakelar".

export interface RemindersPanelProps {
  settings: ReminderSettings;
  timeZone: string;
  onChange: (next: ReminderSettings) => void;
  onTest: () => Promise<void>;
  /** Popup: a back button. Omitted in the dashboard, where the page has the title. */
  onBack?: () => void;
  onOpenUpdates: () => void;
}

export function stageAmount(stage: StageMin, m: Messages): string {
  return stage >= 1440 ? m.time.days(stage / 1440) : m.time.hours(stage / 60);
}

/** "22.00" or "22:00", in the chosen language. */
const hourLabel = (minuteOfDay: number, timeZone: string, m: Messages) => formatClock(zonedToUnix('2026-01-01', minuteOfDay, timeZone), timeZone, m);

const HOURS = Array.from({ length: 24 }, (_, h) => h * 60);

function Check({ checked, disabled, onChange, children }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  const id = useId();
  return (
    <div className={`flex items-start gap-2 py-1 ${disabled ? 'opacity-50' : ''}`}>
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(v) => onChange(v === true)} className="mt-px" />
      <label htmlFor={id} className="text-(length:--fs-body) leading-(--lh-body)">
        {children}
      </label>
    </div>
  );
}

function HourSelect({ value, label, disabled, timeZone, onChange }: { value: number; label: string; disabled?: boolean; timeZone: string; onChange: (v: number) => void }) {
  const { m } = useI18n();
  return (
    <Select value={String(value)} disabled={disabled} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger aria-label={label} className="w-[84px] text-(length:--fs-body) tabular-nums">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {HOURS.map((h) => (
          <SelectItem key={h} value={String(h)} className="text-(length:--fs-body) tabular-nums">
            {hourLabel(h, timeZone, m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1 border-b border-border px-4 py-3 last:border-b-0">
      <h2 className="text-(length:--fs-caption) font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function RemindersPanel({ settings, timeZone, onChange, onTest, onBack, onOpenUpdates }: RemindersPanelProps) {
  const { m } = useI18n();
  const r = m.popup.reminders;
  const [tested, setTested] = useState(false);
  const off = !settings.enabled;
  const set = (patch: Partial<ReminderSettings>) => onChange({ ...settings, ...patch });
  const toggleStage = (stage: StageMin, on: boolean) => {
    const next = on ? [...settings.stages, stage] : settings.stages.filter((s) => s !== stage);
    if (next.length > 0) set({ stages: [...new Set(next)].sort((a, b) => b - a) });
  };
  const last = stageAmount(lastStage(settings), m);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {onBack ? (
        <header className="flex items-center gap-1 px-2 pt-2.5 pb-1.5">
          <Button size="icon-sm" variant="ghost" aria-label={r.back} onClick={onBack}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <h1 className="font-heading text-[17px] leading-5">{r.title}</h1>
        </header>
      ) : (
        <h3 className="sr-only">{r.title}</h3>
      )}
      <div className="flex-1 overflow-y-auto">
        <section className="border-b border-border px-4 pt-1 pb-3">
          <Check checked={settings.enabled} onChange={(enabled) => set({ enabled })}>
            {r.enabled}
          </Check>
        </section>

        <Section title={r.stages}>
          {STAGE_OPTIONS.map((stage) => {
            const chosen = settings.stages.includes(stage);
            const only = chosen && settings.stages.length === 1;
            return (
              <Check key={stage} checked={chosen} disabled={off || only} onChange={(v) => toggleStage(stage, v)}>
                {r.stage(stageAmount(stage, m))}
              </Check>
            );
          })}
          {settings.stages.length === 1 && <p className="pl-6 text-[12px] text-muted-foreground">{r.atLeastOne}</p>}
        </Section>

        <Section title={r.quiet}>
          <Check checked={settings.quiet.enabled} disabled={off} onChange={(enabled) => set({ quiet: { ...settings.quiet, enabled } })}>
            {r.quietOn}
          </Check>
          <div className="flex items-center gap-2 py-1 pl-6 text-(length:--fs-body) leading-8">
            <span>{r.from}</span>
            <HourSelect label={`${r.quiet}: ${r.from}`} value={settings.quiet.startMin} disabled={off || !settings.quiet.enabled} timeZone={timeZone} onChange={(startMin) => set({ quiet: { ...settings.quiet, startMin } })} />
            <span>{r.to}</span>
            <HourSelect label={`${r.quiet}: ${r.to}`} value={settings.quiet.endMin} disabled={off || !settings.quiet.enabled} timeZone={timeZone} onChange={(endMin) => set({ quiet: { ...settings.quiet, endMin } })} />
          </div>
          <Check checked={settings.lastStageDuringQuiet} disabled={off || !settings.quiet.enabled} onChange={(lastStageDuringQuiet) => set({ lastStageDuringQuiet })}>
            {r.lastStage(last)}
          </Check>
        </Section>

        <Section title={r.morning}>
          <Check checked={settings.morning.enabled} disabled={off} onChange={(enabled) => set({ morning: { ...settings.morning, enabled } })}>
            {r.morningOn}
          </Check>
          <div className="flex items-center gap-2 py-1 pl-6 text-(length:--fs-body) leading-8">
            <span>{r.at}</span>
            <HourSelect label={`${r.morning}: ${r.at}`} value={settings.morning.atMin} disabled={off || !settings.morning.enabled} timeZone={timeZone} onChange={(atMin) => set({ morning: { ...settings.morning, atMin } })} />
          </div>
        </Section>

        <Section title={m.popup.row.snooze}>
          <div className="flex items-center gap-2 py-1 text-(length:--fs-body) leading-(--lh-body)">
            <span>{r.snoozeMorning}</span>
            <HourSelect label={r.snoozeMorning} value={settings.snoozeMorningMin} timeZone={timeZone} onChange={(snoozeMorningMin) => set({ snoozeMorningMin })} />
          </div>
        </Section>

        <Section title={r.check}>
          <Button
            variant="outline"
            onClick={() => {
              void onTest().then(() => setTested(true));
            }}
          >
            {r.test}
          </Button>
          {tested && (
            <p role="status" className="text-(length:--fs-caption)">
              {r.testSent}
            </p>
          )}
          <p className="pt-1 text-(length:--fs-caption) leading-(--lh-caption) text-muted-foreground">{r.testHelp}</p>
          <ul className="space-y-0.5 text-[12px] leading-(--lh-caption) text-muted-foreground">
            <li>{r.macSteps}</li>
            <li>{r.winSteps}</li>
          </ul>
          <p className="pt-1 text-[12px] leading-(--lh-caption) text-muted-foreground">{r.sessionNote}</p>
          <button
            type="button"
            onClick={onOpenUpdates}
            className="mt-1 rounded-sm text-left text-(length:--fs-caption) font-medium underline-offset-2 outline-none hover:underline focus-ring:ring-2 focus-ring:ring-focus"
          >
            {r.updatesLink}
          </button>
        </Section>
      </div>
    </div>
  );
}
