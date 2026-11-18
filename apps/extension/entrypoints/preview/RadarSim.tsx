import { useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import type { DevMessage } from '@/lib/dev/messages';

// Dev-only: adds sample updates to your real change log, so the background
// notifies through the real engine (settings and quiet hours apply). Works
// only in the dev build loaded as an extension (chrome-extension://.../preview.html?radar).

const KINDS = [
  ['material', 'Materi baru (2, satu mata kuliah)'],
  ['due', 'Tenggat diundur 2 hari (tugas pertamamu)'],
  ['grade', 'Nilai atau feedback baru'],
  ['forum', 'Pengumuman forum'],
  ['many', 'Materi baru di 4 mata kuliah (jadi ringkasan)'],
] as const;

export function RadarSim() {
  const [note, setNote] = useState('');
  const send = async (message: DevMessage) => {
    try {
      setNote(JSON.stringify(await browser.runtime.sendMessage(message)));
    } catch {
      setNote('Hanya jalan di build dev yang dimuat sebagai ekstensi (chrome-extension://.../preview.html?radar).');
    }
  };
  return (
    <main className="mx-auto max-w-[640px] space-y-5 p-6 text-foreground">
      <header className="space-y-1">
        <h1 className="text-xl">Simulasi kabar terbaru</h1>
        <p className="text-sm text-muted-foreground">
          Menambah kabar contoh ke log milikmu. Notifikasinya lewat mesin yang sama dengan aslinya, jadi pengaturan dan jam tenang berlaku. Buka popup
          untuk melihat panel "Kabar terbaru".
        </p>
      </header>
      <div className="flex flex-col items-start gap-2">
        {KINDS.map(([kind, label]) => (
          <Button key={kind} variant="outline" onClick={() => void send({ type: 'dev/radar/inject', kind })}>
            {label}
          </Button>
        ))}
        <Button variant="ghost" onClick={() => void send({ type: 'dev/notify/reset' })}>
          Lupakan notifikasi terkirim
        </Button>
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </main>
  );
}
