import { describe, expect, it } from 'vitest';
import { ManualClock } from '../src/core/clock';
import {
  MAX_DURATION_SECONDS,
  MIN_DURATION_SECONDS,
  Timer,
  clampDurationSeconds,
  formatDuration,
  parseDurationInput,
  warningThresholdMs,
} from '../src/core/timer';

describe('Timer state machine', () => {
  it('starts idle with the configured duration', () => {
    const timer = new Timer(new ManualClock(), 300);
    expect(timer.state).toBe('idle');
    expect(timer.snapshot().remainingMs).toBe(300_000);
    expect(timer.snapshot().fraction).toBe(1);
  });

  it('start -> running, counts down without accumulation error', () => {
    const clock = new ManualClock();
    const timer = new Timer(clock, 60);
    timer.start();
    expect(timer.state).toBe('running');
    clock.advance(10_000);
    expect(timer.sample().remainingMs).toBe(50_000);
  });

  it('pause freezes remaining time; resume continues from there', () => {
    const clock = new ManualClock();
    const timer = new Timer(clock, 60);
    timer.start();
    clock.advance(20_000);
    timer.pause();
    expect(timer.state).toBe('paused');
    const remainingAtPause = timer.snapshot().remainingMs;
    expect(remainingAtPause).toBe(40_000);

    // Time passing while paused must not count.
    clock.advance(15_000);
    expect(timer.snapshot().remainingMs).toBe(remainingAtPause);

    timer.resume();
    expect(timer.state).toBe('running');
    clock.advance(5_000);
    expect(timer.sample().remainingMs).toBe(35_000);
  });

  it('reaching zero transitions to finished automatically on sample()', () => {
    const clock = new ManualClock();
    const timer = new Timer(clock, 10);
    timer.start();
    clock.advance(10_000);
    const snapshot = timer.sample();
    expect(snapshot.state).toBe('finished');
    expect(snapshot.remainingMs).toBe(0);
    expect(snapshot.fraction).toBe(0);
  });

  it('pausing at exactly zero settles to finished, not paused', () => {
    const clock = new ManualClock();
    const timer = new Timer(clock, 10);
    timer.start();
    clock.advance(10_000);
    timer.pause();
    expect(timer.state).toBe('finished');
  });

  it('reset returns to idle with the SAME duration, not defaults', () => {
    const clock = new ManualClock();
    const timer = new Timer(clock, 300);
    timer.start();
    clock.advance(100_000);
    timer.reset();
    expect(timer.state).toBe('idle');
    expect(timer.snapshot().remainingMs).toBe(300_000);
    expect(timer.durationSeconds).toBe(300);
  });

  it('reset is available from every state', () => {
    const clock = new ManualClock();
    for (const drive of [
      (t: Timer) => t, // idle
      (t: Timer) => (t.start(), t), // running
      (t: Timer) => (t.start(), t.pause(), t), // paused
      (t: Timer) => (t.start(), clock.advance(300_000), t.sample(), t), // finished
    ]) {
      const timer = new Timer(clock, 300);
      drive(timer);
      timer.reset();
      expect(timer.state).toBe('idle');
      clock.advance(0); // no-op, keeps clock reusable across iterations
    }
  });

  it('toggle() behaves as start/pause/resume/reset depending on state', () => {
    const clock = new ManualClock();
    const timer = new Timer(clock, 60);
    timer.toggle();
    expect(timer.state).toBe('running');
    timer.toggle();
    expect(timer.state).toBe('paused');
    timer.toggle();
    expect(timer.state).toBe('running');
    clock.advance(60_000);
    timer.sample();
    expect(timer.state).toBe('finished');
    timer.toggle();
    expect(timer.state).toBe('idle');
  });

  it('starting from finished starts a fresh run at full duration', () => {
    const clock = new ManualClock();
    const timer = new Timer(clock, 30);
    timer.start();
    clock.advance(30_000);
    timer.sample();
    expect(timer.state).toBe('finished');
    timer.start();
    expect(timer.state).toBe('running');
    expect(timer.snapshot().remainingMs).toBe(30_000);
  });
});

describe('Timer deadline arithmetic across pause/resume', () => {
  it('never drifts over a long simulated run with many pause/resume cycles', () => {
    const clock = new ManualClock();
    const timer = new Timer(clock, 3600); // one hour
    let expectedRemaining = 3_600_000;

    timer.start();
    for (let i = 0; i < 200; i += 1) {
      const runMs = 5_000;
      clock.advance(runMs);
      expectedRemaining -= runMs;
      expect(timer.sample().remainingMs).toBe(expectedRemaining);

      timer.pause();
      const pauseMs = 1_500;
      clock.advance(pauseMs); // must not count
      expect(timer.snapshot().remainingMs).toBe(expectedRemaining);
      timer.resume();
    }

    expect(timer.snapshot().remainingMs).toBe(expectedRemaining);
  });

  it('addTime while running extends both remaining and total proportionally', () => {
    const clock = new ManualClock();
    const timer = new Timer(clock, 300);
    timer.start();
    clock.advance(60_000); // 4:00 left, total 5:00
    timer.addTime(60); // +1 minute
    const snapshot = timer.sample();
    expect(snapshot.remainingMs).toBe(300_000); // 5:00 left
    expect(snapshot.totalMs).toBe(360_000); // 6:00 total
  });

  it('addTime while paused updates the resting remaining time', () => {
    const clock = new ManualClock();
    const timer = new Timer(clock, 120);
    timer.start();
    clock.advance(30_000);
    timer.pause();
    timer.addTime(30);
    expect(timer.snapshot().remainingMs).toBe(120_000);
    timer.resume();
    clock.advance(10_000);
    expect(timer.sample().remainingMs).toBe(110_000);
  });

  it('addTime cannot push remaining below zero or total past the max', () => {
    const clock = new ManualClock();
    const timer = new Timer(clock, 30);
    timer.start();
    timer.addTime(-1000);
    expect(timer.sample().remainingMs).toBe(0);

    const long = new Timer(clock, MAX_DURATION_SECONDS);
    long.addTime(10_000);
    expect(long.durationSeconds).toBe(MAX_DURATION_SECONDS);
  });

  it('a sleeping machine (mono frozen, wall advances) resolves on the next sample', () => {
    const clock = new ManualClock();
    const timer = new Timer(clock, 300);
    timer.start();
    // Machine sleeps for ten minutes; performance.now() does not advance,
    // Date.now() does. This is exactly what SPEC §5.2 requires detecting.
    clock.sleep(600_000, 0);
    const snapshot = timer.sample();
    expect(snapshot.state).toBe('finished');
    expect(snapshot.remainingMs).toBe(0);
  });

  it('a machine that slept for less than the remaining time resumes correctly', () => {
    const clock = new ManualClock();
    const timer = new Timer(clock, 300);
    timer.start();
    clock.sleep(100_000, 0); // slept 100s of a 300s timer
    const snapshot = timer.sample();
    expect(snapshot.state).toBe('running');
    expect(snapshot.remainingMs).toBe(200_000);
    // Subsequent frames should continue smoothly from the reconciled deadline.
    clock.advance(10_000);
    expect(timer.sample().remainingMs).toBe(190_000);
  });

  it('an NTP correction that moves the wall clock backwards is ignored', () => {
    const clock = new ManualClock();
    const timer = new Timer(clock, 300);
    timer.start();
    clock.advance(10_000);
    clock.skewWall(-5_000); // wall clock corrected backwards
    // The monotonic clock is authoritative here; remaining should still
    // reflect real elapsed time, not the corrected wall clock.
    expect(timer.sample().remainingMs).toBe(290_000);
  });
});

describe('warning phase', () => {
  it('is "normal" above the threshold and "warning" at or below it', () => {
    const clock = new ManualClock();
    const timer = new Timer(clock, 300);
    timer.setWarning({ type: 'seconds', value: 60 });
    timer.start();
    clock.advance(230_000); // 70s left
    expect(timer.sample().phase).toBe('normal');
    clock.advance(15_000); // 55s left
    expect(timer.sample().phase).toBe('warning');
  });

  it('supports a percentage-based threshold', () => {
    expect(warningThresholdMs({ type: 'percent', value: 25 }, 400_000)).toBe(100_000);
  });

  it('is "finished" once the timer completes, regardless of threshold', () => {
    const clock = new ManualClock();
    const timer = new Timer(clock, 10);
    timer.setWarning({ type: 'seconds', value: 0 });
    timer.start();
    clock.advance(10_000);
    expect(timer.sample().phase).toBe('finished');
  });
});

describe('clampDurationSeconds', () => {
  it('clamps to the documented range', () => {
    expect(clampDurationSeconds(0)).toBe(MIN_DURATION_SECONDS);
    expect(clampDurationSeconds(-50)).toBe(MIN_DURATION_SECONDS);
    expect(clampDurationSeconds(999_999)).toBe(MAX_DURATION_SECONDS);
    expect(clampDurationSeconds(NaN)).toBe(MIN_DURATION_SECONDS);
  });

  it('rounds fractional seconds', () => {
    expect(clampDurationSeconds(90.6)).toBe(91);
  });
});

describe('parseDurationInput', () => {
  it('reads a bare number as minutes', () => {
    expect(parseDurationInput('5')).toBe(300);
  });

  it('reads MM:SS', () => {
    expect(parseDurationInput('5:30')).toBe(330);
    expect(parseDurationInput('0:45')).toBe(45);
  });

  it('reads explicit unit suffixes', () => {
    expect(parseDurationInput('90s')).toBe(90);
    expect(parseDurationInput('1h')).toBe(3600);
    expect(parseDurationInput('2 min')).toBe(120);
  });

  it('returns null for unreadable input', () => {
    expect(parseDurationInput('')).toBeNull();
    expect(parseDurationInput('abc')).toBeNull();
    expect(parseDurationInput('5:99')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats as M:SS with zero-padded seconds', () => {
    expect(formatDuration(300)).toBe('5:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(5)).toBe('0:05');
  });
});
