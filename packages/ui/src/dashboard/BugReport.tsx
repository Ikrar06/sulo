import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { useToast } from '../ui/toast';
import type { DashMessages } from '@sulo/core/i18n/dashboard';
import { readTechLog } from '@sulo/core/net/tech-log';
import { readSyncStatus } from '@sulo/core/storage';
import { buildBugReport } from '@sulo/core/support/bug-report';
import { readModuleState } from '@sulo/core/neosia/module';
import { readSnapshots } from '@sulo/core/neosia/store';
import { neosiaStatus } from '@sulo/core/neosia/view';
import type { KeyValueStore } from '@sulo/core/types';

/** "Salin info untuk laporan bug": the exact text is shown first; nothing leaves the device unless the user pastes it somewhere. */
export function BugReport({ d, lastSyncAt, store, version, buttonClassName }: { d: DashMessages; lastSyncAt: number | null; store: KeyValueStore; version: string; buttonClassName?: string }) {
  const t = d.pengaturan.bugReport;
  const toast = useToast();
  const [text, setText] = useState<string | null>(null);

  const open = async () => {
    const [log, status, module, snapshots] = await Promise.all([readTechLog(store), readSyncStatus(store), readModuleState(store), readSnapshots(store)]);
    // NEOSIA: only on or off and the time of the last data.
    const neosia = { enabled: module.enabled, lastSeenAt: module.enabled ? neosiaStatus(snapshots).lastSeenAt : null };
    setText(buildBugReport({ version, userAgent: navigator.userAgent, lastSyncAt, lastAttemptAt: status.lastAttemptAt, lastOutcome: status.lastOutcome, log, neosia }));
  };

  return (
    <>
      <Button variant="outline" className={buttonClassName} onClick={() => void open()}>
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
