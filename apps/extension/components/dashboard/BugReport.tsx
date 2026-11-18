import { useState } from 'react';
import { browser } from 'wxt/browser';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@sulo/ui/ui/alert-dialog';
import { Button } from '@sulo/ui/ui/button';
import { useToast } from '@sulo/ui/ui/toast';
import type { DashMessages } from '@sulo/core/i18n/dashboard';
import { readTechLog } from '@sulo/core/net/tech-log';
import { readSyncStatus } from '@sulo/core/storage';
import { buildBugReport } from '@sulo/core/support/bug-report';
import { readModuleState } from '@sulo/core/neosia/module';
import { readSnapshots } from '@sulo/core/neosia/store';
import { neosiaStatus } from '@sulo/core/neosia/view';
import { local } from './data';

/** "Salin info untuk laporan bug": the exact text is shown first; nothing leaves the browser unless the user pastes it somewhere. */
export function BugReport({ d, lastSyncAt }: { d: DashMessages; lastSyncAt: number | null }) {
  const t = d.pengaturan.bugReport;
  const toast = useToast();
  const [text, setText] = useState<string | null>(null);

  const open = async () => {
    const [log, status, module, snapshots] = await Promise.all([readTechLog(local), readSyncStatus(local), readModuleState(local), readSnapshots(local)]);
    // NEOSIA: only on or off and the time of the last data.
    const neosia = { enabled: module.enabled, lastSeenAt: module.enabled ? neosiaStatus(snapshots).lastSeenAt : null };
    setText(buildBugReport({ version: browser.runtime.getManifest().version, userAgent: navigator.userAgent, lastSyncAt, lastAttemptAt: status.lastAttemptAt, lastOutcome: status.lastOutcome, log, neosia }));
  };

  return (
    <>
      <Button variant="outline" onClick={() => void open()}>
        {t.button}
      </Button>
      <AlertDialog open={text !== null} onOpenChange={(o) => !o && setText(null)}>
        <AlertDialogContent className="max-w-xl">
          <AlertDialogTitle>{t.title}</AlertDialogTitle>
          <AlertDialogDescription>{t.body}</AlertDialogDescription>
          <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-background p-3 text-[12px] leading-normal whitespace-pre-wrap">{text}</pre>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel asChild>
              <Button variant="outline">{d.common.cancel}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                onClick={() => {
                  if (text) void navigator.clipboard.writeText(text).then(() => toast.show({ message: t.copied, duration: 2000 }));
                }}
              >
                {t.copy}
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
