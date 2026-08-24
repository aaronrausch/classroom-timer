/**
 * The only place in the app where time is read (SPEC §9.2).
 *
 * Two clocks are exposed deliberately:
 *
 *  - `mono()` is monotonic and immune to the user changing the system clock or
 *    to NTP corrections. It is the authority for countdown arithmetic.
 *  - `wall()` is the wall clock. It is used *only* as a cross-check, because on
 *    some platforms `performance.now()` stops advancing while the machine is
 *    asleep. Without the cross-check a laptop closed mid-timer would wake up
 *    believing almost no time had passed (SPEC §5.2).
 */
export interface ClockSource {
  /** Monotonic milliseconds since an arbitrary origin. */
  mono(): number;
  /** Wall-clock milliseconds since the Unix epoch. */
  wall(): number;
}

export const systemClock: ClockSource = {
  mono: () => performance.now(),
  wall: () => Date.now(),
};

/**
 * A clock driven by hand. Used by the unit tests, which must be able to
 * simulate a forty-minute timer, a machine sleeping, and a wall clock that
 * jumps, without any of it taking forty minutes.
 */
export class ManualClock implements ClockSource {
  private monoMs: number;
  private wallMs: number;

  constructor(monoMs = 0, wallMs = 1_700_000_000_000) {
    this.monoMs = monoMs;
    this.wallMs = wallMs;
  }

  mono(): number {
    return this.monoMs;
  }

  wall(): number {
    return this.wallMs;
  }

  /** Advance both clocks together, as normal running time does. */
  advance(ms: number): void {
    this.monoMs += ms;
    this.wallMs += ms;
  }

  /**
   * Simulate the machine sleeping: wall time passes, the monotonic clock is
   * frozen or lags behind. `monoMs` defaults to 0, the worst case.
   */
  sleep(wallMs: number, monoMs = 0): void {
    this.wallMs += wallMs;
    this.monoMs += monoMs;
  }

  /** Simulate an NTP correction or a user editing the system clock. */
  skewWall(ms: number): void {
    this.wallMs += ms;
  }
}
