import { useEffect, useId, useState, type ReactNode } from 'react';
import { browser } from 'wxt/browser';
import { useI18n } from '@/components/i18n';
import { WipeDialog } from '@/components/popup/WipeDialog';
import { RemindersPanel } from '@/components/popup/RemindersPanel';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CALENDAR_NOTIFY_KINDS } from '@/lib/calendar/notify-settings';
import { LANGUAGE_NAMES, LOCALES, type Locale } from '@/lib/i18n';
import { DAILY_BUDGET } from '@/lib/moodle/limits';
import { DUE_FORMATS, NICKNAME_MAX, normalizeNickname, THEMES, type DueFormat, type Theme } from '@/lib/prefs';
import { UPDATE_CATEGORIES } from '@/lib/radar/settings';
import { timeZone } from '../data';
import { Card } from '../Shell';
import { UsageStats } from '../UsageStats';
import type { PageProps } from '../types';

/** Sections reachable as #pengaturan/<id> (notifications and the popup link here). */
const SECTIONS = ['tampilan', 'tentangKamu', 'pengingat', 'kabar', 'kalender', 'data'] as const;

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2 py-1">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-1" />
      <label htmlFor={id} className="text-[14px] leading-6">
        {children}
      </label>
    </div>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="grid gap-2 py-2 md:grid-cols-[200px_minmax(0,1fr)] md:items-start md:gap-6">
      {/* 32 px row: label line (24) + 4 top aligns its text with the control's text. */}
      <label htmlFor={id} className="pt-1 text-[14px] leading-6 font-semibold">
        {label}
      </label>
      <div className="space-y-1">
        {children(id)}
        {help && <p className="max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{help}</p>}
      </div>
    </div>
  );
}

export function PengaturanPage({ d, data, actions, route }: PageProps) {
  const { m } = useI18n();
  const t = d.pengaturan;
  const prefs = data.prefs;
  const [nickname, setNickname] = useState(prefs.nickname);
  const [tested, setTested] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const year = Number(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric' }).format(new Date(data.now * 1000)));
  const years = Array.from({ length: 12 }, (_, i) => year - i);

  useEffect(() => {
    if (route.detail && (SECTIONS as readonly string[]).includes(route.detail)) document.getElementById(`set-${route.detail}`)?.scrollIntoView();
  }, [route.detail]);

  return (
    <div className="space-y-4">
      <Card title={<span id="set-tampilan">{t.sections.tampilan}</span>}>
        <Field label={t.theme}>
          {(id) => (
            <Select value={prefs.theme} onValueChange={(v) => void actions.setPrefs({ theme: v as Theme })}>
              <SelectTrigger id={id} className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEMES.map((th) => (
                  <SelectItem key={th} value={th}>
                    {t.themes[th]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t.language}>
          {(id) => (
            <Select value={prefs.locale ?? 'auto'} onValueChange={(v) => void actions.setPrefs({ locale: v === 'auto' ? null : (v as Locale) })}>
              <SelectTrigger id={id} className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t.languageAuto}</SelectItem>
                {LOCALES.map((l) => (
                  <SelectItem key={l} value={l} lang={l}>
                    {LANGUAGE_NAMES[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={t.dueFormat}>
          {(id) => (
            <Select value={prefs.dueFormat} onValueChange={(v) => void actions.setPrefs({ dueFormat: v as DueFormat })}>
              <SelectTrigger id={id} className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DUE_FORMATS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {m.popup.settings.formats[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </Card>

      <Card title={<span id="set-tentangKamu">{t.sections.tentangKamu}</span>}>
        <Field label={t.nickname} help={t.nicknameHelp}>
          {(id) => (
            <Input
              id={id}
              className="w-56"
              maxLength={NICKNAME_MAX}
              autoComplete="off"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onBlur={() => {
                const next = normalizeNickname(nickname);
                setNickname(next);
                if (next !== prefs.nickname) void actions.setPrefs({ nickname: next });
              }}
            />
          )}
        </Field>
        <Field label={t.angkatan} help={t.angkatanHelp}>
          {(id) => (
            <Select value={prefs.angkatan === null ? 'none' : String(prefs.angkatan)} onValueChange={(v) => void actions.setPrefs({ angkatan: v === 'none' ? null : Number(v) })}>
              <SelectTrigger id={id} className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t.angkatanNone}</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </Card>

      <Card title={<span id="set-pengingat">{t.sections.pengingat}</span>} className="p-0 pt-4 [&>div:first-child]:px-4">
        <RemindersPanel
          settings={prefs.reminders}
          timeZone={timeZone}
          onChange={(reminders) => void actions.setPrefs({ reminders })}
          onTest={async () => {
            await actions.send({ type: 'notify/test' });
          }}
          onOpenUpdates={() => document.getElementById('set-kabar')?.scrollIntoView({ behavior: 'smooth' })}
        />
      </Card>

      <Card title={<span id="set-kabar">{t.sections.kabar}</span>}>
        <p className="mb-2 text-[12px] text-muted-foreground">{t.updatesHelp}</p>
        {UPDATE_CATEGORIES.map((c) => (
          <Check key={c} checked={prefs.updates[c]} onChange={(v) => void actions.setPrefs({ updates: { ...prefs.updates, [c]: v } })}>
            {m.popup.updates.categories[c]}
          </Check>
        ))}
      </Card>

      <Card title={<span id="set-kalender">{t.sections.kalender}</span>}>
        <p className="mb-2 max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{t.calendarHelp}</p>
        {CALENDAR_NOTIFY_KINDS.map((k) => (
          <Check key={k} checked={prefs.calendar[k]} onChange={(v) => void actions.setPrefs({ calendar: { ...prefs.calendar, [k]: v } })}>
            {t.calendarKinds[k]}
          </Check>
        ))}
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={async () => {
              await actions.send({ type: 'notify/test' });
              setTested(true);
            }}
          >
            {t.sendTest}
          </Button>
          {tested && (
            <span role="status" className="text-[12px] text-muted-foreground">
              {t.testSent}
            </span>
          )}
        </div>
      </Card>

      <Card title={<span id="set-data">{t.sections.data}</span>}>
        <p className="text-[14px] tabular-nums">{t.requestsToday(data.view.budget.used, DAILY_BUDGET)}</p>
        <UsageStats d={d} data={data} actions={actions} />
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={() => actions.openTab(browser.runtime.getURL('/onboarding.html#courses'))}>
            {t.manageCourses}
          </Button>
          <Button variant="outline" onClick={() => actions.openTab(browser.runtime.getURL('/privacy.html'))}>
            {t.openPrivacy}
          </Button>
        </div>
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <p className="text-[12px] text-muted-foreground">{t.wipeHelp}</p>
          <Button variant="destructive" onClick={() => setWipeOpen(true)}>
            {m.popup.settings.wipe}
          </Button>
        </div>
        <WipeDialog open={wipeOpen} onOpenChange={setWipeOpen} onConfirm={() => void actions.send({ type: 'data/wipeAll' }).then(() => window.close())} />
      </Card>
    </div>
  );
}
