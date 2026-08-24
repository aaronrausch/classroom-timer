import { describe, expect, it } from 'vitest';
import {
  CONTRAST_GRAPHICAL,
  CONTRAST_TEXT,
  PALETTES,
  SURFACES,
  contrastRatio,
} from '../src/ui/palettes';

/**
 * Contrast is verified, not assumed (SPEC §5.12, §8). Every shipped palette,
 * in both themes, must clear WCAG 2.2 AA: 3:1 for large graphical objects,
 * 4.5:1 for any text.
 */
describe('palette contrast', () => {
  for (const palette of PALETTES) {
    for (const mode of ['light', 'dark'] as const) {
      const colors = palette[mode];
      const surface = SURFACES[mode];

      describe(`${palette.id} / ${mode}`, () => {
        it('fill is distinguishable from the surface background', () => {
          expect(contrastRatio(colors.fill, surface.bg)).toBeGreaterThanOrEqual(CONTRAST_GRAPHICAL);
        });

        it('fill is distinguishable from its own track', () => {
          expect(contrastRatio(colors.fill, colors.track)).toBeGreaterThanOrEqual(CONTRAST_GRAPHICAL);
        });

        it('warning colour is distinguishable from the background and the track', () => {
          expect(contrastRatio(colors.warning, surface.bg)).toBeGreaterThanOrEqual(CONTRAST_GRAPHICAL);
          expect(contrastRatio(colors.warning, colors.track)).toBeGreaterThanOrEqual(CONTRAST_GRAPHICAL);
        });

        it('numerals meet the stricter text contrast ratio', () => {
          expect(contrastRatio(colors.numeral, surface.bg)).toBeGreaterThanOrEqual(CONTRAST_TEXT);
          expect(contrastRatio(colors.warningNumeral, surface.bg)).toBeGreaterThanOrEqual(CONTRAST_TEXT);
        });

        it('the finished glyph is readable on the finished field', () => {
          expect(contrastRatio(colors.finishedFg, colors.finishedBg)).toBeGreaterThanOrEqual(
            CONTRAST_TEXT,
          );
        });

        it('the finished field itself reads clearly against the room, not just its glyph', () => {
          expect(contrastRatio(colors.finishedBg, surface.bg)).toBeGreaterThanOrEqual(
            CONTRAST_GRAPHICAL,
          );
        });
      });
    }
  }

  it('every palette id is unique', () => {
    const ids = PALETTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
