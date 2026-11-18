// Development builds only (imported by DevDiagnostics): the NEOSIA
// observation listing for checking the allowlist (M7 part C). Paths and key
// names only; plain English like the rest of the dev panel.

import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { ENDPOINTS } from '@sulo/core/neosia/allowlist';
import { OBSERVED_KEY, observationsMarkdown, type StoredObservation } from '@/lib/dev/neosia-observe';
import { Card } from './Shell';

export function DevNeosia({ now }: { now: number }) {
  const [list, setList] = useState<StoredObservation[]>([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void browser.storage.local.get(OBSERVED_KEY).then((r) => setList((r[OBSERVED_KEY] as StoredObservation[] | undefined) ?? []));
  }, [now]);
  const listed = list.filter((o) => o.endpoint !== 'other' && o.endpoint !== 'never');
  const others = list.filter((o) => o.endpoint === 'other' || o.endpoint === 'never');
  const copy = async () => {
    await navigator.clipboard.writeText(observationsMarkdown(list, ENDPOINTS.map((e) => e.id)));
    setCopied(true);
  };
  return (
    <Card title="NEOSIA observations (dev build only)" action={<Button size="sm" variant="outline" onClick={() => void copy()} disabled={list.length === 0}>{copied ? 'Copied' : 'Copy as Markdown'}</Button>}>
      {list.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">Nothing yet. Turn on NEOSIA, open the NEOSIA pages, then come back.</p>
      ) : (
        <div className="space-y-3 text-[12px]">
          <ul className="space-y-1">
            {listed.map((o) => (
              <li key={`${o.endpoint}${o.path}`}>
                <details>
                  <summary className="cursor-pointer">
                    <span className="font-semibold">{o.endpoint}</span> <span className="text-muted-foreground">{o.path} · {o.count}× · {o.keys?.length ?? 0} keys · from {(o.pages ?? []).join(', ') || '-'}</span>
                  </summary>
                  <pre className="mt-1 max-h-48 overflow-auto rounded-md border border-border p-2 text-[12px]">{(o.keys ?? []).join('\n')}</pre>
                </details>
              </li>
            ))}
          </ul>
          <p className="font-semibold">Other NEOSIA paths (responses not read)</p>
          <ul className="text-muted-foreground">
            {others.map((o) => (
              <li key={`${o.endpoint}${o.path}`}>
                {o.path} {o.endpoint === 'never' ? '(never read)' : ''} · {o.count}×
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
