import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { DEV_WORDS } from '@/lib/i18n/dev';
import { id as idMain } from '@sulo/core/i18n/id';

const id = { ...DEV_WORDS.id, unexpectedError: idMain.unexpectedError };
import type { DevMessage } from '@/lib/dev/messages';
import type { Message, RecordResponse } from '@/lib/messages';
import '@/assets/tailwind.css';
import { installInputModality } from '@/lib/ui/input-modality';

// Dev-only page (excluded from production builds in wxt.config.ts).
// Saves sanitized fixtures with <a download>, so no "downloads" permission.

// Focus rings for keyboard users only (see assets/tailwind.css).
installInputModality(document, document.documentElement);

function saveFile(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function schemaNotes(files: { filename: string; content: string }[]): string[] {
  return files.flatMap((file) => {
    const entry = JSON.parse(file.content) as { methodname: string; schema: { valid: boolean; issues: string[] } };
    return entry.schema.valid ? [] : [id.recorder.schemaInvalid(entry.methodname, entry.schema.issues.length)];
  });
}

function Recorder() {
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<string[]>([]);

  const onRecord = async () => {
    setBusy(true);
    let response: RecordResponse | null = null;
    try {
      response = (await browser.runtime.sendMessage({ type: 'dev/record' } satisfies DevMessage)) as RecordResponse | null;
    } catch {
      response = null;
    }
    setBusy(false);

    if (!response) return setLines([id.unexpectedError]);
    if (response.kind === 'failed') return setLines([id.recorder.failed(response.reason)]);
    if (response.kind === 'leak_detected') return setLines([id.recorder.leak(response.rules.join(', '))]);
    response.files.forEach((file) => saveFile(file.filename, file.content));
    setLines([id.recorder.saved(response.files.length), ...schemaNotes(response.files)]);
  };

  return (
    <main className="mx-auto max-w-xl space-y-4 p-8 text-sm">
      <h1 className="text-lg font-semibold">{id.recorder.title}</h1>
      <p className="text-muted-foreground">{id.recorder.note}</p>
      <Button onClick={onRecord} disabled={busy}>
        {busy ? id.recorder.recording : id.recorder.start}
      </Button>
      {lines.length > 0 && (
        <ul role="status" className="space-y-1 rounded-md border border-border p-3">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Recorder root element not found');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Recorder />
  </React.StrictMode>,
);
