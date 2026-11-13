import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { id } from '@/lib/i18n/id';
import type { ConnectionTestResponse, Message, StatusResponse } from '@/lib/messages';

// Temporary M0 popup: one button that asks the service worker to run the
// connection test. Never shows the userid or the sesskey.

async function send<T>(message: Message): Promise<T | null> {
  try {
    return ((await browser.runtime.sendMessage(message)) as T | null) ?? null;
  } catch {
    return null;
  }
}

export default function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void send<StatusResponse>({ type: 'status/get' }).then(setStatus);
  }, []);

  const onTest = async () => {
    setTesting(true);
    const response = await send<ConnectionTestResponse>({ type: 'connection/test' });
    setTesting(false);
    if (!response) {
      setResultText(id.unexpectedError);
      return;
    }
    setStatus(response);
    setResultText(id.result[response.result]);
  };

  return (
    <main className="w-[380px] space-y-3 p-4 text-sm">
      <header>
        <h1 className="text-base font-semibold">{id.appName}</h1>
        <p className="text-xs text-muted-foreground">{id.unofficial}</p>
      </header>

      {status && (
        <p className="text-foreground">{status.hasSesskey ? id.sesskeyAvailable : id.sesskeyMissing}</p>
      )}

      <Button onClick={onTest} disabled={testing} className="w-full">
        {testing ? id.testing : id.testConnection}
      </Button>

      {resultText && (
        <p role="status" className="rounded-md border border-border p-2">
          {resultText}
        </p>
      )}

      {status && (
        <p className="text-xs text-muted-foreground">{id.budget(status.budgetUsed, status.budgetLimit)}</p>
      )}
    </main>
  );
}
