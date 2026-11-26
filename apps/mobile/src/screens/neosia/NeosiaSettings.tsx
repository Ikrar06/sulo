// Pengaturan > NEOSIA (M8d B3), shown once NEOSIA is connected: "Tampilkan
// nilai" (off by default; grades and the GPA stay hidden until it is on),
// the credits target (100 to 200, 144 by default) and "Putuskan NEOSIA",
// which asks first and then wipes every NEOSIA record and NEOSIA's own
// WebView storage on this phone.

import { useEffect, useRef, useState } from 'react';
import { neosiaWords } from '@sulo/core/i18n/neosia';
import { mobileWords } from '@sulo/core/i18n/mobile';
import { DEFAULT_SKS_TARGET } from '@sulo/core/neosia/view';
import { useI18n } from '@sulo/ui/i18n';
import { PillButton, Toggle } from '@sulo/ui/mobile/controls';
import { Sheet, SheetTextForm } from '@sulo/ui/mobile/sheet';
import { useMobileData } from '../../shell/data';
import { useNeosia } from '../../neosia/NeosiaProvider';
import { Group, Row, ValueRow } from '../settings-rows';
import { parseSksTarget } from '../../neosia/grade-guard';

export function NeosiaSettings({ scrollTo }: { scrollTo: boolean }) {
  const { locale } = useI18n();
  const n = neosiaWords(locale);
  const w = mobileWords(locale);
  const neo = useNeosia();
  const { data, actions } = useMobileData();
  const prefs = data!.prefs;
  const [sheet, setSheet] = useState<'sks' | 'mkpk' | 'disconnect' | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Opened from Nilai's "Buka Pengaturan": this group comes into view.
  useEffect(() => {
    if (scrollTo && neo.enabled) ref.current?.scrollIntoView({ block: 'start' });
  }, [scrollTo, neo.enabled]);

  if (!neo.enabled) return null;
  const target = prefs.sksTarget || DEFAULT_SKS_TARGET;

  return (
    <div ref={ref}>
      <Group title={n.settings.cardTitle} help={n.mobile.gradesHelp}>
        <Row label={n.mobile.gradesShown}>
          <Toggle checked={prefs.gradesShown} label={n.mobile.gradesShown} onChange={(v) => void actions.setPrefs({ gradesShown: v })} />
        </Row>
        <ValueRow label={n.settings.sksTarget} value={String(target)} onPress={() => setSheet('sks')} />
        <ValueRow label={n.mkpk.settingsRow} value={prefs.mkpkLoad === null ? n.mkpk.settingsUnset : n.mkpk.choice[prefs.mkpkLoad]} onPress={() => setSheet('mkpk')} />
        <button type="button" onClick={() => setSheet('disconnect')} className="m-hit flex min-h-12 w-full items-center text-left text-m15 text-urgency-overdue outline-none focus-ring:ring-2 focus-ring:ring-focus">
          {n.mobile.disconnect}
        </button>
      </Group>

      <Sheet open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)} title={sheet === 'sks' ? n.settings.sksTarget : sheet === 'mkpk' ? n.mkpk.settingsRow : n.settings.disconnectTitle}>
        {sheet === 'sks' && (
          <SheetTextForm
            label={n.settings.sksTarget}
            initial={String(target)}
            maxLength={3}
            help={n.settings.sksTargetHelp}
            submitLabel={w.app.doneSheet}
            onSave={(text) => {
              const v = parseSksTarget(text);
              if (v !== null) void actions.setPrefs({ sksTarget: v });
            }}
          />
        )}
        {sheet === 'mkpk' && (
          <div className="space-y-2">
            <p className="text-m13 text-muted-foreground">{n.mkpk.settingsHelp}</p>
            {([20, 10, 'none'] as const).map((choice) => (
              <PillButton
                key={String(choice)}
                full
                kind={prefs.mkpkLoad === choice ? 'primary' : 'secondary'}
                onPress={() => {
                  void actions.setPrefs({ mkpkLoad: choice });
                  setSheet(null);
                }}
              >
                {n.mkpk.choice[choice]}
              </PillButton>
            ))}
          </div>
        )}
        {sheet === 'disconnect' && (
          <div className="space-y-4">
            <p className="text-m15r text-muted-foreground">{n.mobile.disconnectBody}</p>
            <PillButton
              danger
              full
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await neo.disable();
                } finally {
                  setBusy(false);
                  setSheet(null);
                }
              }}
            >
              {n.mobile.disconnect}
            </PillButton>
            <PillButton full onPress={() => setSheet(null)}>
              {n.settings.cancel}
            </PillButton>
          </div>
        )}
      </Sheet>
    </div>
  );
}
