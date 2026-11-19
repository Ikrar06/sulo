// Debug build only: what happened to the SIKOLA session on this phone (native
// Diag): when the app started, when the vault was saved, ended and why, and
// reads that could not be done yet. Times and event codes only.
import { useEffect, useState } from 'react';
import { Card } from '@sulo/ui/mobile/cards';
import { PillButton } from '@sulo/ui/mobile/controls';
import { SuloSession } from '../session';

const time = (at: number) => new Date(at * 1000).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' });

export function SessionDiagDev() {
  const [events, setEvents] = useState<{ at: number; e: string }[] | null>(null);
  const load = () =>
    SuloSession.diagLog()
      .then((r) => setEvents([...r.events].reverse()))
      .catch(() => setEvents([]));
  useEffect(() => void load(), []);
  return (
    <Card className="space-y-2">
      <h2 className="text-m15 font-semibold">Riwayat sesi (terbaru di atas)</h2>
      {events === null || events.length === 0 ? (
        <p className="text-muted-foreground">Belum ada catatan.</p>
      ) : (
        <ul>
          {events.slice(0, 30).map((x, i) => (
            <li key={`${x.at}-${i}`}>
              {time(x.at)} · {x.e}
            </li>
          ))}
        </ul>
      )}
      <PillButton onPress={() => void load()}>Muat ulang</PillButton>
    </Card>
  );
}
