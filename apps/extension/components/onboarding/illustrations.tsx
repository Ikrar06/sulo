import { CheckIcon, PinIcon } from '@sulo/ui/icons';
import { Mascot } from '@sulo/ui/mascot/Mascot';
import type { MascotState } from '@sulo/core/view/popup-view';

/** A small drawing of the browser toolbar: puzzle icon, then the pin. */
export function PinIllustration() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2" aria-hidden="true">
      <span className="h-2 w-16 rounded-full bg-border" />
      <span className="ml-auto flex size-8 items-center justify-center rounded-md bg-surface-raised">
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M9 4h4v2a2 2 0 1 0 4 0V4h3v5h-2a2 2 0 1 0 0 4h2v7h-5v-2a2 2 0 1 0-4 0v2H4v-5h2a2 2 0 1 0 0-4H4V4z" />
        </svg>
      </span>
      <span className="flex size-8 items-center justify-center rounded-md bg-brand-amber/25">
        <PinIcon className="size-4" />
      </span>
    </div>
  );
}


export type WireState = 'idle' | 'trying' | 'on';

/**
 * Step 2: a small SIKOLA browser window wired to the mascot. The wire is a
 * dashed line while waiting and lights up (solid, brand amber) once connected.
 */
export function ConnectIllustration({ wire, mascot }: { wire: WireState; mascot: MascotState }) {
  return (
    <div className="ob-connect" data-wire={wire} aria-hidden="true">
      <div className="ob-window">
        <div className="ob-window-bar">
          <span className="ob-window-dot" />
          <span className="ob-window-dot" />
          <span className="ob-window-dot" />
          <span className="ob-window-url">sikola-v2.unhas.ac.id</span>
        </div>
        <div className="ob-window-body">
          <p className="font-heading text-[22px] leading-none tracking-[-0.01em]">SIKOLA</p>
          <span className="ob-skeleton w-[78%]" />
          <span className="ob-skeleton w-[62%]" />
          <span className="ob-skeleton w-[70%]" />
        </div>
        {wire === 'on' && (
          <span className="ob-window-check">
            <CheckIcon className="size-3.5" />
          </span>
        )}
      </div>
      {/* Dashed and flowing toward the mascot while waiting; once connected a
          solid brand line draws in and one dot travels from SIKOLA to the
          mascot. No glow, no gradient. */}
      <svg className="ob-wire" viewBox="0 0 96 8">
        <path className="ob-wire-base" d="M2 4 H94" />
        {wire === 'on' && (
          <>
            <path className="ob-wire-lit" d="M2 4 H94" pathLength={1} />
            <circle className="ob-wire-dot" cx={2} cy={4} r={3} />
          </>
        )}
      </svg>
      <Mascot state={mascot} size={140} followCursor effects grounded />
    </div>
  );
}

/** Step 2 visuals per connection status: the wire and the mascot's mood. */
export function connectVisual(status: 'checking' | 'need_login' | 'waiting' | 'connected' | 'failed'): { wire: WireState; mascot: MascotState } {
  switch (status) {
    case 'connected':
      return { wire: 'on', mascot: 'all-done' };
    case 'checking':
    case 'waiting':
      return { wire: 'trying', mascot: 'syncing' };
    case 'failed':
      return { wire: 'idle', mascot: 'sleepy' };
    case 'need_login':
      return { wire: 'idle', mascot: 'onboarding' };
  }
}
