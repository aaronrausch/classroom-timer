import { describe, expect, it } from 'vitest';
import { depletionFraction } from '../src/views/types';
import type { RenderState } from '../src/views/types';

/** Only the fields depletionFraction actually reads; everything else is
 * irrelevant to it, so a partial cast keeps each test to what matters. */
function state(fields: Partial<RenderState>): RenderState {
  return fields as RenderState;
}

describe('depletionFraction', () => {
  it('is the continuous fraction by default', () => {
    expect(
      depletionFraction(state({ fraction: 0.437, reducedMotion: false, smoothMotion: false })),
    ).toBe(0.437);
  });

  it('steps to the nearest whole second under reduced motion', () => {
    const result = depletionFraction(
      state({
        fraction: 0.437,
        remainingMs: 43_700,
        totalMs: 100_000,
        reducedMotion: true,
        smoothMotion: false,
      }),
    );
    // 43700ms rounds up to 44000ms of the 100000ms total.
    expect(result).toBeCloseTo(0.44);
  });

  it('smoothMotion overrides reduced motion back to continuous', () => {
    expect(
      depletionFraction(
        state({
          fraction: 0.437,
          remainingMs: 43_700,
          totalMs: 100_000,
          reducedMotion: true,
          smoothMotion: true,
        }),
      ),
    ).toBe(0.437);
  });

  it('is exact at both ends regardless of motion settings', () => {
    for (const reducedMotion of [true, false]) {
      for (const smoothMotion of [true, false]) {
        expect(
          depletionFraction(
            state({ fraction: 1, remainingMs: 100_000, totalMs: 100_000, reducedMotion, smoothMotion }),
          ),
        ).toBe(1);
        expect(
          depletionFraction(
            state({ fraction: 0, remainingMs: 0, totalMs: 100_000, reducedMotion, smoothMotion }),
          ),
        ).toBe(0);
      }
    }
  });
});
