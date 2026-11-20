// Screens without any data yet (after a new account or Hapus data): skeletons
// shaped like the screen they stand for, so nothing jumps when the data comes
// (owner's rules, 20 Nov 2026). A slow sheen sweeps left to right by transform
// only; it is a flat translucent band (no gradient, the visual rules), and it
// stops under reduced motion and in lite mode (plain blocks).
import type { ReactNode } from 'react';

function Block({ className }: { className: string }) {
  return (
    <span className={`m-skel relative block overflow-hidden bg-m-inset ${className}`}>
      <span className="m-skel-sheen absolute inset-y-0 left-0 w-1/3 bg-m-screen opacity-40" />
    </span>
  );
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-m-card p-4 ${className}`}>{children}</div>;
}

function Rows({ n }: { n: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }, (_, i) => (
        <Card key={i} className="flex items-center gap-3">
          <Block className="size-8 shrink-0 rounded-[10px]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Block className="h-3.5 w-2/3 rounded" />
            <Block className="h-3 w-1/3 rounded" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Ringkasan: the greeting and mascot, three stat cards, then the list. */
function RingkasanSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between pt-2">
        <div className="w-3/5 space-y-2">
          <Block className="h-7 w-full rounded-lg" />
          <Block className="h-7 w-3/4 rounded-lg" />
          <Block className="h-3.5 w-1/2 rounded" />
        </div>
        <Block className="size-24 rounded-full" />
      </div>
      <Card>
        <Block className="h-4 w-3/4 rounded" />
      </Card>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="space-y-3">
            <Block className="h-3 w-2/3 rounded" />
            <Block className="h-6 w-1/3 rounded" />
          </Card>
        ))}
      </div>
      <Rows n={3} />
    </div>
  );
}

/** Tugas, Presensi, Kabar: a title line, then rows like theirs. */
function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-4 pt-2">
      <Block className="h-9 w-full rounded-full" />
      <Rows n={rows} />
    </div>
  );
}

export function NoDataSkeleton({ screen, label }: { screen: string; label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      {screen === 'ringkasan' ? <RingkasanSkeleton /> : <ListSkeleton rows={screen === 'presensi' ? 4 : 5} />}
    </div>
  );
}
