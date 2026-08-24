import type { ClockSource } from './clock';

export type TimerState = 'idle' | 'running' | 'paused' | 'finished';

/**
 * Which visual register the display is in. Derived, never stored: the timer
 * owns the truth about time, the views own how it looks.
 */
export type TimerPhase = 'normal' | 'warning' | 'finished';

export type WarningThreshold =
  | { type: 'seconds'; value: number }
  | { type: 'percent'; value: number };

export interface TimerSnapshot {
  state: TimerState;
  phase: TimerPhase;
  /** Milliseconds left, clamped to [0, totalMs]. */
  remainingMs: number;
  /** The configured duration of this run, in milliseconds. */
  totalMs: number;
  /** Remaining as a fraction of total, in [0, 1]. Exactly 1 at rest, exactly 0 when finished. */
  fraction: number;
}

export const MIN_DURATION_SECONDS = 5;
export const MAX_DURATION_SECONDS = 120 * 60;

/**
 * If the monotonic clock has advanced this much less than the wall clock, the
 * machine almost certainly slept. One second is comfortably above ordinary
 * scheduling jitter and comfortably below anything a human would notice.
 */
const SLEEP_DETECTION_MS = 1_000;

export function clampDurationSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return MIN_DURATION_SECONDS;
  return Math.min(MAX_DURATION_SECONDS, Math.max(MIN_DURATION_SECONDS, Math.round(seconds)));
}

/** Milliseconds remaining at which the warning state begins, for a given total. */
export function warningThresholdMs(threshold: WarningThreshold, totalMs: number): number {
  if (threshold.type === 'percent') {
    const pct = Math.min(100, Math.max(0, threshold.value));
    return (totalMs * pct) / 100;
  }
  return Math.min(totalMs, Math.max(0, threshold.value * 1000));
}

/**
 * The countdown state machine (SPEC §5.1), and the deadline arithmetic that
 * keeps it honest (SPEC §5.2).
 *
 * Pure: it touches no DOM and no globals. Its entire relationship with the
 * outside world is a `ClockSource` in and a `TimerSnapshot` out, which is what
 * makes drift, sleep and pause/resume testable without a browser.
 *
 * The central rule: **nothing is ever accumulated.** While running, the timer
 * knows only an absolute deadline, and remaining time is always recomputed as
 * `deadline - now`. A dropped frame, a throttled background tab, or a garbage
 * collection pause therefore cannot cost the timer a single millisecond.
 */
export class Timer {
  private readonly clock: ClockSource;

  private stateValue: TimerState = 'idle';
  private totalMsValue: number;

  /** Authoritative remaining time whenever the timer is *not* running. */
  private restingRemainingMs: number;

  /** Deadlines on both clocks. Only meaningful while running. */
  private monoDeadline = 0;
  private wallDeadline = 0;

  private warning: WarningThreshold = { type: 'seconds', value: 60 };

  private readonly listeners = new Set<(snapshot: TimerSnapshot) => void>();

  constructor(clock: ClockSource, durationSeconds = 300) {
    this.clock = clock;
    this.totalMsValue = clampDurationSeconds(durationSeconds) * 1000;
    this.restingRemainingMs = this.totalMsValue;
  }

  get state(): TimerState {
    return this.stateValue;
  }

  get totalMs(): number {
    return this.totalMsValue;
  }

  get durationSeconds(): number {
    return Math.round(this.totalMsValue / 1000);
  }

  setWarning(threshold: WarningThreshold): void {
    this.warning = threshold;
    this.emit();
  }

  getWarning(): WarningThreshold {
    return this.warning;
  }

  /**
   * Set the duration. Only meaningful when the timer is at rest; a running
   * timer is extended with `addTime` instead, which is what teachers actually
   * do mid-activity (SPEC §5.10).
   */
  setDurationSeconds(seconds: number): void {
    if (this.stateValue === 'running') return;
    this.totalMsValue = clampDurationSeconds(seconds) * 1000;
    this.restingRemainingMs = this.totalMsValue;
    this.stateValue = 'idle';
    this.emit();
  }

  start(): void {
    if (this.stateValue === 'running') return;
    if (this.stateValue === 'finished') {
      this.restingRemainingMs = this.totalMsValue;
    }
    if (this.restingRemainingMs <= 0) {
      this.restingRemainingMs = this.totalMsValue;
    }
    this.armDeadline(this.restingRemainingMs);
    this.stateValue = 'running';
    this.emit();
  }

  pause(): void {
    if (this.stateValue !== 'running') return;
    this.restingRemainingMs = Math.max(0, this.readRunningRemaining());
    this.stateValue = this.restingRemainingMs <= 0 ? 'finished' : 'paused';
    this.emit();
  }

  resume(): void {
    if (this.stateValue !== 'paused') return;
    this.armDeadline(this.restingRemainingMs);
    this.stateValue = 'running';
    this.emit();
  }

  /** The single affordance behind the space bar and the play/pause button. */
  toggle(): void {
    switch (this.stateValue) {
      case 'idle':
        this.start();
        break;
      case 'running':
        this.pause();
        break;
      case 'paused':
        this.resume();
        break;
      case 'finished':
        this.reset();
        break;
    }
  }

  /**
   * Reset returns to IDLE with the *same* duration, not to defaults — a teacher
   * running the same five minutes three times in a row presses reset, then
   * start (SPEC §5.1).
   */
  reset(): void {
    this.stateValue = 'idle';
    this.restingRemainingMs = this.totalMsValue;
    this.emit();
  }

  /**
   * Add time, including while running. The total grows with the addition so the
   * visualization stays proportionally honest: adding a minute to a five-minute
   * timer should not make a two-thirds-empty ring jump back to full.
   */
  addTime(seconds: number): void {
    const deltaMs = seconds * 1000;
    const maxTotal = MAX_DURATION_SECONDS * 1000;

    if (this.stateValue === 'running') {
      const remaining = Math.max(0, this.readRunningRemaining());
      const nextRemaining = Math.max(0, remaining + deltaMs);
      const nextTotal = Math.min(maxTotal, this.totalMsValue + (nextRemaining - remaining));
      this.totalMsValue = nextTotal;
      this.armDeadline(Math.min(nextRemaining, nextTotal));
      this.emit();
      return;
    }

    if (this.stateValue === 'paused') {
      const remaining = this.restingRemainingMs;
      const nextRemaining = Math.max(0, remaining + deltaMs);
      this.totalMsValue = Math.min(maxTotal, this.totalMsValue + (nextRemaining - remaining));
      this.restingRemainingMs = Math.min(nextRemaining, this.totalMsValue);
      this.emit();
      return;
    }

    // Idle or finished: adding time is just choosing a new duration.
    this.setDurationSeconds(this.durationSeconds + seconds);
  }

  /**
   * Recompute from the deadline and settle the state. Called every animation
   * frame while running, and on every visibility change or wake, where a timer
   * that ran past its end while backgrounded resolves to FINISHED at once
   * (SPEC §5.2).
   */
  sample(): TimerSnapshot {
    if (this.stateValue === 'running') {
      const remaining = this.readRunningRemaining();
      if (remaining <= 0) {
        this.restingRemainingMs = 0;
        this.stateValue = 'finished';
        this.emit();
      }
    }
    return this.snapshot();
  }

  snapshot(): TimerSnapshot {
    const remainingMs = this.currentRemainingMs();
    const totalMs = this.totalMsValue;
    const fraction = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
    return {
      state: this.stateValue,
      phase: this.phaseFor(this.stateValue, remainingMs, totalMs),
      remainingMs,
      totalMs,
      fraction,
    };
  }

  subscribe(listener: (snapshot: TimerSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---------------------------------------------------------------- internals

  private armDeadline(remainingMs: number): void {
    this.restingRemainingMs = remainingMs;
    this.monoDeadline = this.clock.mono() + remainingMs;
    this.wallDeadline = this.clock.wall() + remainingMs;
  }

  /**
   * Remaining time while running, reconciling the two clocks.
   *
   * The monotonic clock is trusted by default. If it has fallen *behind* the
   * wall clock by more than the sleep threshold, the machine slept with
   * `performance.now()` frozen, and the wall clock is the one telling the
   * truth; the monotonic deadline is re-armed to match so subsequent frames are
   * cheap and consistent.
   *
   * The asymmetry is deliberate. A wall clock that has run *ahead* is sleep; a
   * wall clock that has run *behind*, or leapt forward, is an NTP correction or
   * a user editing the system clock, and is ignored.
   */
  private readRunningRemaining(): number {
    const monoRemaining = this.monoDeadline - this.clock.mono();
    const wallRemaining = this.wallDeadline - this.clock.wall();

    if (monoRemaining - wallRemaining > SLEEP_DETECTION_MS) {
      this.monoDeadline = this.clock.mono() + wallRemaining;
      return wallRemaining;
    }

    // Keep the wall deadline aligned so a single sleep cannot be counted twice.
    this.wallDeadline = this.clock.wall() + monoRemaining;
    return monoRemaining;
  }

  private currentRemainingMs(): number {
    if (this.stateValue !== 'running') {
      return Math.min(this.totalMsValue, Math.max(0, this.restingRemainingMs));
    }
    return Math.min(this.totalMsValue, Math.max(0, this.monoDeadline - this.clock.mono()));
  }

  private phaseFor(state: TimerState, remainingMs: number, totalMs: number): TimerPhase {
    if (state === 'finished') return 'finished';
    if (state === 'idle') return 'normal';
    const threshold = warningThresholdMs(this.warning, totalMs);
    return remainingMs <= threshold ? 'warning' : 'normal';
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

/**
 * Parse a teacher-typed duration. Deliberately forgiving, because this is the
 * precise-entry path and someone is standing at a lectern with a class waiting:
 *
 *   "5"      → 5 minutes      (the overwhelmingly common case)
 *   "5:30"   → 5 min 30 sec
 *   "90s"    → 90 seconds
 *   "1h"     → 60 minutes
 *   "0:45"   → 45 seconds
 *
 * Returns null for anything it cannot read, so the caller can leave the field
 * alone rather than guess.
 */
export function parseDurationInput(text: string): number | null {
  const value = text.trim().toLowerCase();
  if (!value) return null;

  const clock = /^(\d{1,3}):([0-5]?\d)$/.exec(value);
  if (clock) {
    return clampDurationSeconds(Number(clock[1]) * 60 + Number(clock[2]));
  }

  const suffixed = /^(\d+(?:\.\d+)?)\s*(h|m|min|mins|s|sec|secs)?$/.exec(value);
  if (suffixed) {
    const amount = Number(suffixed[1]);
    switch (suffixed[2]) {
      case 'h':
        return clampDurationSeconds(amount * 3600);
      case 's':
      case 'sec':
      case 'secs':
        return clampDurationSeconds(amount);
      default:
        // Bare numbers are minutes. A teacher typing "5" means five minutes.
        return clampDurationSeconds(amount * 60);
    }
  }

  return null;
}

/** `M:SS`, the form used by the readout, the digits mode and the duration field. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
