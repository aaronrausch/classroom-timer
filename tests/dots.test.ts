import { describe, expect, it } from 'vitest';
import { dotIntervalLabel, dotPlan, gridShape } from '../src/views/dots';

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
