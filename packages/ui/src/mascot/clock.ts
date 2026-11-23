// The rig's clock: seconds that can run faster or slower, pause, and be
// stepped by hand, and timers on those seconds. Between events it costs
// nothing: one plain timeout waits for the next timer; no animation frame is
// asked for. No DOM.

interface Timer {
  readonly id: number;
  readonly due: number;
  readonly fn: () => void;
}

export class Clock {
  rate = 1;
  paused = false;
  private running = false;
  /** Clock seconds at `anchor` (a performance.now() reading). */
  private base = 0;
  private anchor = 0;
  private timers: Timer[] = [];
  private serial = 0;
  private handle: ReturnType<typeof setTimeout> | null = null;
  /** While a timer runs, "now" is the moment it was due: what it starts or schedules is timed from there, however late it ran. */
  private firing: number | null = null;

  constructor(private readonly wall: () => number = () => performance.now()) {}

  now(): number {
    if (this.firing !== null) return this.firing;
    return !this.running || this.paused ? this.base : this.base + ((this.wall() - this.anchor) / 1000) * this.rate;
  }

  get pending(): number {
    return this.timers.length;
  }

  start() {
    this.base = 0;
    this.anchor = this.wall();
    this.running = true;
    this.arm();
  }

  /** Stops and forgets every timer. */
  stop() {
    this.base = this.now();
    this.running = false;
    this.timers = [];
    this.disarm();
  }

  private rebase() {
    this.base = this.now();
    this.anchor = this.wall();
  }

  setRate(rate: number) {
    this.rebase();
    this.rate = Math.max(0.01, rate);
    this.arm();
  }

  setPaused(paused: boolean) {
    if (paused === this.paused) return;
    this.rebase();
    this.paused = paused;
    this.anchor = this.wall();
    this.arm();
  }

  /** Moves a paused clock on by `seconds`, running what came due on the way, in order. */
  step(seconds: number) {
    this.base += seconds;
    this.anchor = this.wall();
    this.fire();
  }

  after(seconds: number, fn: () => void): number {
    this.serial += 1;
    const timer = { id: this.serial, due: this.now() + Math.max(0, seconds), fn };
    this.timers.push(timer);
    this.arm();
    return timer.id;
  }

  cancel(id: number) {
    const before = this.timers.length;
    this.timers = this.timers.filter((t) => t.id !== id);
    if (this.timers.length !== before) this.arm();
  }

  private disarm() {
    if (this.handle !== null) clearTimeout(this.handle);
    this.handle = null;
  }

  private arm() {
    this.disarm();
    if (!this.running || this.paused || this.timers.length === 0) return;
    const next = Math.min(...this.timers.map((t) => t.due));
    this.handle = setTimeout(() => this.fire(), Math.max(0, ((next - this.now()) / this.rate) * 1000));
  }

  private fire() {
    this.disarm();
    // A timer may add timers; ones that come due at once run in this same pass, in order of time.
    for (let guard = 0; guard < 1000; guard += 1) {
      this.firing = null;
      const now = this.now() + 1e-6;
      const due = this.timers.filter((t) => t.due <= now).sort((a, b) => a.due - b.due || a.id - b.id)[0];
      if (!due) break;
      this.timers = this.timers.filter((t) => t !== due);
      // Stepped by hand, a timer runs exactly at its time. Running, one that fires very late (a stalled page) does not
      // pretend it is still back then: what it schedules would all be overdue and run in a burst.
      this.firing = this.paused ? due.due : Math.max(due.due, now - 0.1);
      try {
        due.fn();
      } finally {
        this.firing = null;
      }
    }
    this.arm();
  }
}
