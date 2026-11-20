// The one updating line every screen shows (owner's rules, 20 Nov 2026):
// in place of the session, offline or stale line while a sync runs, then
// "Sudah terbaru" for 2 seconds, or the failure with a retry. Old data stays
// on screen under it; nothing jumps (the same 36 px pill as the other lines).
import { createContext, useContext } from 'react';
import type { MobileWords } from '@sulo/core/i18n/mobile';
import { statusLine, type SyncUi, IDLE } from './sync-status';

/** The current updating state, for screens that react to it (the mascot on Ringkasan). */
export const SyncUiContext = createContext<SyncUi>(IDLE);
export const useSyncUi = () => useContext(SyncUiContext);

export function SyncStatusLine({ ui, w, onRetry }: { ui: SyncUi; w: MobileWords; onRetry: () => void }) {
  const s = w.connected.sync;
  const text = statusLine(ui, { updating: s.updating, stages: s.stages, upToDate: s.upToDate });
  return (
    // The failure line carries a button: it may wrap to two lines (large text) instead of being cut.
    <p role="status" aria-live="polite" className={`mb-3 flex min-h-9 items-center gap-2 bg-m-inset px-4 text-m13 ${ui.phase === 'failed' ? 'rounded-2xl py-2' : 'rounded-full'}`}>
      {ui.phase === 'running' && <span aria-hidden="true" className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent opacity-70 motion-reduce:animate-none" />}
      <span className={`min-w-0 flex-1 ${ui.phase === 'failed' ? '' : 'truncate'}`}>{text}</span>
      {ui.phase === 'failed' && (
        <button type="button" onClick={onRetry} className="m-press -mr-2 shrink-0 rounded-full px-2 py-1 font-semibold text-m-accent outline-none focus-ring:ring-2 focus-ring:ring-focus">
          {s.retry}
        </button>
      )}
    </p>
  );
}
