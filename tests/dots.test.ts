import { describe, expect, it } from 'vitest';
import { dotIntervalLabel, dotPlan, dotShrinkProgress, gridShape } from '../src/views/dots';

describe('dotPlan', () => {
  it('never represents time in a non-round unit', () => {
    for (let seconds = 1; seconds <= 7200; seconds += 37) {
      const plan = dotPlan(seconds);
      expect([1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900]).toContain(plan.intervalSeconds);
    }
  });

  it('picks the finest interval that keeps the count at or under 30', () => {
    // 300s: interval 5 -> 60 dots (too many); interval 10 -> 30 dots (fits).
    expect(dotPlan(300)).toEqual({ intervalSeconds: 10, count: 30 });
  });

  it('a short duration gets a fine-grained, mostly 1:1 grid', () => {
    expect(dotPlan(20)).toEqual({ intervalSeconds: 1, count: 20 });
  });

  it('is capped at 30 dots even for very long durations', () => {
    const plan = dotPlan(2 * 60 * 60); // two hours
    expect(plan.count).toBeLessThanOrEqual(30);
  });

  it('rounds the duration to the nearest second before planning', () => {
    expect(dotPlan(19.6)).toEqual(dotPlan(20));
  });
});

describe('dotIntervalLabel', () => {
  it('narrates minutes when the interval is a whole number of minutes', () => {
    expect(dotIntervalLabel(60)).toBe('One dot per minute');
    expect(dotIntervalLabel(300)).toBe('One dot per 5 minutes');
  });

  it('narrates seconds otherwise', () => {
    expect(dotIntervalLabel(1)).toBe('One dot per second');
    expect(dotIntervalLabel(30)).toBe('One dot per 30 seconds');
  });
});

describe('gridShape', () => {
  const ASPECT_16_9 = 16 / 9;

  it('is always large enough to hold every dot', () => {
    for (let count = 1; count <= 30; count += 1) {
      const { cols, rows } = gridShape(count, ASPECT_16_9);
      expect(cols * rows).toBeGreaterThanOrEqual(count);
    }
  });

  it('is an exact rectangle whenever a reasonable one exists', () => {
    // 20 factors as 5x4, a shape squarish enough that it should win outright.
    const { cols, rows } = gridShape(20, ASPECT_16_9);
    expect(cols * rows).toBe(20);
  });

  it('never leaves more than a small handful of leftover (ghost) cells', () => {
    for (let count = 1; count <= 30; count += 1) {
      const { cols, rows } = gridShape(count, ASPECT_16_9);
      const leftover = cols * rows - count;
      // A full extra row/column is never worth it just to avoid one ghost dot.
      expect(leftover).toBeLessThan(Math.max(cols, rows));
    }
  });

  it('prefers a squarer rectangle over a one-row strip for an awkward count', () => {
    // 13 is prime; a 13x1 strip has zero leftover but a terrible aspect. A
    // near-square shape with one ghost cell should win instead.
    const { cols, rows } = gridShape(13, ASPECT_16_9);
    expect(Math.max(cols, rows)).toBeLessThan(13);
  });

  it('respects the viewport aspect ratio: a tall box prefers more rows than columns', () => {
    const wide = gridShape(12, 16 / 9);
    const tall = gridShape(12, 9 / 16);
    expect(wide.cols).toBeGreaterThan(wide.rows);
    expect(tall.rows).toBeGreaterThan(tall.cols);
  });
});

describe('dotShrinkProgress — the "shrink" smooth-motion style', () => {
  it('is 0 (full size) for every dot at the very start', () => {
    for (let i = 0; i < 5; i += 1) {
      expect(dotShrinkProgress(0, i, 5)).toBe(0);
    }
  });

  it('is 1 (fully gone) for every dot at the very end', () => {
    for (let i = 0; i < 5; i += 1) {
      expect(dotShrinkProgress(1, i, 5)).toBe(1);
    }
  });

  it('dots finish in reading order, earlier index first', () => {
    // Halfway through a 4-dot timer, dot 0 is long gone, dot 1 just finished,
    // and dots 2-3 have not started shrinking yet.
    expect(dotShrinkProgress(0.5, 0, 4)).toBe(1);
    expect(dotShrinkProgress(0.5, 1, 4)).toBe(1);
    expect(dotShrinkProgress(0.5, 2, 4)).toBe(0);
    expect(dotShrinkProgress(0.5, 3, 4)).toBe(0);
  });

  it('shrinks continuously across its own equal share, not in a jump', () => {
    // Dot 1 of 4 owns the [0.25, 0.5] window; at its midpoint it should be
    // exactly half shrunk, not still full size or already gone.
    expect(dotShrinkProgress(0.375, 1, 4)).toBeCloseTo(0.5);
  });

  it('never goes below 0 or above 1', () => {
    expect(dotShrinkProgress(-0.2, 0, 4)).toBe(0);
    expect(dotShrinkProgress(1.2, 3, 4)).toBe(1);
  });

  it('treats a zero-count grid as already gone rather than dividing oddly', () => {
    expect(dotShrinkProgress(0.5, 0, 0)).toBe(1);
  });
});
