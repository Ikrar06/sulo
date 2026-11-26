import { lazy, Suspense, useEffect, useId, useState, type ReactNode } from 'react';
import { browser } from 'wxt/browser';
import { useI18n } from '@sulo/ui/i18n';
import { WipeDialog } from '@/components/popup/WipeDialog';
import { RemindersPanel } from '@sulo/ui/reminders/RemindersPanel';
import { DocLayout } from '@sulo/ui/ui/doc-layout';
import { SwitchRow } from '@sulo/ui/ui/switch-row';
import { watchWords } from '@sulo/core/i18n/watch';
import { WatchSwitch } from '../../WatchSwitch';
import { Button } from '@sulo/ui/ui/button';
import { Input } from '@sulo/ui/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@sulo/ui/ui/select';
import { CALENDAR_NOTIFY_KINDS } from '@sulo/core/calendar/notify-settings';
import { LANGUAGE_NAMES, LOCALES, type Locale } from '@sulo/core/i18n';
import { DUE_FORMATS, NICKNAME_MAX, normalizeNickname, THEMES, type DueFormat, type Theme } from '@sulo/core/prefs';
import { UPDATE_CATEGORIES } from '@sulo/core/radar/settings';
import { local, timeZone } from '../data';
import { Card } from '@sulo/ui/card';
import { BugReport } from '@sulo/ui/dashboard/BugReport';
import { NeosiaSettings } from '../NeosiaSettings';
import type { PageProps } from '../types';

/** Development builds only: the branch is false in production, so the module is never bundled. */
const DevDiagnostics = import.meta.env.MODE === 'development' ? lazy(() => import('../DevDiagnostics')) : null;
/** Usage statistics and their export: development builds only (M7.1). */
const UsageStats = import.meta.env.MODE === 'development' ? lazy(() => import('../UsageStats')) : null;
// Tester and development builds: what the radar stored (counts and codes).
const RadarDiagnosis = import.meta.env.MODE !== 'production' ? lazy(() => import('../RadarDiagnosis')) : null;

/** Sections reachable as #pengaturan/<id> (notifications and the popup link here). */
const SECTIONS = ['tampilan', 'tentangKamu', 'pantau', 'notifikasi', 'pengingat', 'kabar', 'kalender', 'neosia', 'data', 'laporan', 'hapus'] as const;

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
  const { m, locale } = useI18n();
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

  // The sections on the right, as on Bantuan (DocLayout's scrollspy, core's pure getActiveSection). Delete stays last.
  const toc = SECTIONS.map((id) => ({ id: `set-${id}`, label: id === 'neosia' ? 'NEOSIA' : id === 'pantau' ? watchWords(locale).title : id === 'laporan' ? t.bugReport.cardTitle : t.sections[id] }));

  return (
    <DocLayout toc={toc} tocLabel={d.bantuan.onThisPage} hashFor={(id) => `pengaturan/${id.slice(4)}`}>
      <Card id="set-tampilan" title={t.sections.tampilan}>
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

      <Card id="set-tentangKamu" title={t.sections.tentangKamu}>
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

      {/* "Pantau tugas baru" (1.1.0): off until the user turns it on; the setup offers it to new installs. */}
      <Card id="set-pantau" title={watchWords(locale).title}>
        <WatchSwitch />
      </Card>

      {/* One test for every kind of notification (tasks, updates, calendar): they share one path. */}
      <Card id="set-notifikasi" title={t.sections.notifikasi}>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={async () => {
              await actions.send({ type: 'notify/test' });
              setTested(true);
            }}
          >
            {m.popup.reminders.test}
          </Button>
          {tested && (
            <span role="status" className="text-[12px] text-muted-foreground">
              {t.testSent}
            </span>
          )}
        </div>
        <p className="mt-3 max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{m.popup.reminders.testHelp}</p>
        <ul className="mt-1 space-y-1 text-[12px] leading-normal text-muted-foreground">
          <li>{m.popup.reminders.macSteps}</li>
          <li>{m.popup.reminders.winSteps}</li>
        </ul>
        <p className="mt-2 text-[12px] leading-normal text-muted-foreground">{m.popup.reminders.sessionNote}</p>
      </Card>

      {/* The panel's sections use the dashboard padding (--panel-px: 20) so they line up with the card title. */}
      <Card id="set-pengingat" title={t.sections.pengingat} className="!px-0 !pb-0 [&>div:first-child]:px-5">
        <RemindersPanel
          settings={prefs.reminders}
          timeZone={timeZone}
          onChange={(reminders) => void actions.setPrefs({ reminders })}
          onTest={async () => {
            await actions.send({ type: 'notify/test' });
          }}
          showCheck={false}
          onOpenUpdates={() => document.getElementById('set-kabar')?.scrollIntoView({ behavior: 'smooth' })}
        />
      </Card>

      <Card id="set-kabar" title={t.sections.kabar}>
        <p className="mb-2 text-[12px] text-muted-foreground">{t.updatesHelp}</p>
        {UPDATE_CATEGORIES.map((c) => (
          <SwitchRow key={c} checked={prefs.updates[c]} onChange={(v) => void actions.setPrefs({ updates: { ...prefs.updates, [c]: v } })}>
            {m.popup.updates.categories[c]}
          </SwitchRow>
        ))}
      </Card>

      <Card id="set-kalender" title={t.sections.kalender}>
        <p className="mb-2 max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{t.calendarHelp}</p>
        {CALENDAR_NOTIFY_KINDS.map((k) => (
          <SwitchRow key={k} checked={prefs.calendar[k]} onChange={(v) => void actions.setPrefs({ calendar: { ...prefs.calendar, [k]: v } })}>
            {t.calendarKinds[k]}
          </SwitchRow>
        ))}
      </Card>

      <Card id="set-neosia" title="NEOSIA">
        <NeosiaSettings data={data} actions={actions} />
      </Card>

      <Card id="set-data" title={t.sections.data}>
        {UsageStats && (
          <Suspense fallback={null}>
            <UsageStats data={data} />
            <div className="mt-4 border-t border-border" />
          </Suspense>
        )}
        <div className={`flex flex-wrap gap-2 ${UsageStats ? 'pt-4' : ''}`}>
          <Button variant="outline" onClick={() => actions.openTab(browser.runtime.getURL('/onboarding.html#courses'))}>
            {t.manageCourses}
          </Button>
          <Button variant="outline" onClick={() => actions.openTab(browser.runtime.getURL('/privacy.html'))}>
            {t.openPrivacy}
          </Button>
        </div>
      </Card>

      <Card id="set-laporan" title={t.bugReport.cardTitle}>
        <p className="mb-3 max-w-[68ch] text-[12px] leading-normal text-muted-foreground">{t.bugReport.help}</p>
        <BugReport d={d} lastSyncAt={data.view.lastSyncAt} store={local} version={browser.runtime.getManifest().version} />
      </Card>

      {RadarDiagnosis && (
        <Suspense fallback={null}>
          <RadarDiagnosis data={data} />
        </Suspense>
      )}
      {DevDiagnostics && (
        <Suspense fallback={null}>
          <DevDiagnostics data={data} />
        </Suspense>
      )}

      {/* Always the last section: the one destructive action, behind a confirmation dialog. */}
      <Card id="set-hapus" title={t.sections.hapus}>
        <p className="mb-3 text-[12px] text-muted-foreground">{t.wipeHelp}</p>
        <Button variant="destructive" onClick={() => setWipeOpen(true)}>
          {m.popup.settings.wipe}
        </Button>
        <WipeDialog open={wipeOpen} onOpenChange={setWipeOpen} onConfirm={() => void actions.send({ type: 'data/wipeAll' }).then(() => window.close())} />
      </Card>
    </DocLayout>
  );
}
