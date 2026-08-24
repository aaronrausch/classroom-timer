import { describe, expect, it } from 'vitest';
import {
  CONTRAST_GRAPHICAL,
  CONTRAST_TEXT,
  PALETTES,
  SURFACES,
  contrastRatio,
  decodeCustomPalette,
  deriveCustomGradientPalette,
  deriveCustomPalette,
  encodeCustomPalette,
  isCustomPaletteId,
  mixHexColors,
  resolvePaletteOrCustom,
} from '../src/ui/palettes';
import type { PaletteColors, ThemeMode } from '../src/ui/palettes';

/**
 * The same compliance check applies to every set of derived colours,
 * curated or custom — factored out so the custom-colour tests below hold it
 * to exactly the standard the curated palettes are held to (SPEC §5.12, §8).
 */
function expectContrastCompliance(colors: PaletteColors, mode: ThemeMode): void {
  const surface = SURFACES[mode];
  expect(contrastRatio(colors.fill, surface.bg)).toBeGreaterThanOrEqual(CONTRAST_GRAPHICAL);
  expect(contrastRatio(colors.fill, colors.track)).toBeGreaterThanOrEqual(CONTRAST_GRAPHICAL);
  expect(contrastRatio(colors.warning, surface.bg)).toBeGreaterThanOrEqual(CONTRAST_GRAPHICAL);
  expect(contrastRatio(colors.warning, colors.track)).toBeGreaterThanOrEqual(CONTRAST_GRAPHICAL);
  expect(contrastRatio(colors.numeral, surface.bg)).toBeGreaterThanOrEqual(CONTRAST_TEXT);
  expect(contrastRatio(colors.warningNumeral, surface.bg)).toBeGreaterThanOrEqual(CONTRAST_TEXT);
  expect(contrastRatio(colors.finishedFg, colors.finishedBg)).toBeGreaterThanOrEqual(CONTRAST_TEXT);
  expect(contrastRatio(colors.finishedBg, surface.bg)).toBeGreaterThanOrEqual(CONTRAST_GRAPHICAL);
}

describe('palette contrast', () => {
  for (const palette of PALETTES) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${palette.id} / ${mode} clears every contrast floor`, () => {
        expectContrastCompliance(palette[mode], mode);
      });
    }
  }

  it('every palette id is unique', () => {
    const ids = PALETTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ships at least fifteen curated palettes (SPEC-adjacent; see docs/adr)', () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(15);
  });
});

/**
 * A custom colour has no author checking it by hand, so the *derivation*
 * itself has to guarantee the floor — this is what makes that guarantee
 * real: a wide, adversarial spread of inputs (pure black/white, fully
 * saturated primaries, pale pastels, colours already near the alert hue),
 * every one run through both themes.
 */
describe('deriveCustomPalette', () => {
  const sampleHexes = [
    '#000000',
    '#ffffff',
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#ffff00',
    '#00ffff',
    '#ff00ff',
    '#ffcc99', // pale pastel
    '#1a1a2e', // near-black navy
    '#f5f5f0', // near-white cream
    '#e67e22', // already orange, near the alert hue
    '#7f8c8d', // desaturated grey
    '#3b2a1a', // dark brown
    '#c9302c', // already a red/alert-ish hue
    '#123456', // arbitrary
  ];

  for (const hex of sampleHexes) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${hex} / ${mode} clears every contrast floor`, () => {
        expectContrastCompliance(deriveCustomPalette(hex, mode), mode);
      });
    }
  }

  it('is deterministic — the same input always derives the same output', () => {
    const a = deriveCustomPalette('#3366cc', 'dark');
    const b = deriveCustomPalette('#3366cc', 'dark');
    expect(a).toEqual(b);
  });

  it('finishedBg reuses numeral, matching the curated palettes’ own pairing', () => {
    const colors = deriveCustomPalette('#3366cc', 'light');
    expect(colors.finishedBg).toBe(colors.numeral);
  });
});

describe('deriveCustomGradientPalette', () => {
  const pairs: Array<[string, string]> = [
    ['#3366cc', '#cc3366'],
    ['#000000', '#ffffff'],
    ['#ffcc00', '#0033aa'],
    ['#123456', '#123456'], // degenerate: identical stops
  ];

  for (const [from, to] of pairs) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${from}→${to} / ${mode} clears every contrast floor, both stops included`, () => {
        const colors = deriveCustomGradientPalette(from, to, mode);
        expectContrastCompliance(colors, mode);
        expect(colors.gradient).toBeDefined();
        const surface = SURFACES[mode];
        // The gradient stops themselves are graphical objects too — a stop
        // that failed contrast would mean part of the sweep is invisible.
        expect(contrastRatio(colors.gradient!.from, surface.bg)).toBeGreaterThanOrEqual(
          CONTRAST_GRAPHICAL,
        );
        expect(contrastRatio(colors.gradient!.to, surface.bg)).toBeGreaterThanOrEqual(
          CONTRAST_GRAPHICAL,
        );
      });
    }
  }
});

describe('mixHexColors', () => {
  it('returns the first colour at t=0 and the second at t=1', () => {
    expect(mixHexColors('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHexColors('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  it('splits the difference at t=0.5', () => {
    expect(mixHexColors('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('custom palette id encoding', () => {
  it('round-trips a solid custom colour', () => {
    const id = encodeCustomPalette('#3366cc');
    expect(isCustomPaletteId(id)).toBe(true);
    expect(decodeCustomPalette(id)).toEqual({ from: '#3366cc', to: null });
  });

  it('round-trips a gradient custom colour', () => {
    const id = encodeCustomPalette('#3366cc', '#cc3366');
    expect(isCustomPaletteId(id)).toBe(true);
    expect(decodeCustomPalette(id)).toEqual({ from: '#3366cc', to: '#cc3366' });
  });

  it('does not mistake a curated id for a custom one', () => {
    expect(isCustomPaletteId('teal')).toBe(false);
    expect(decodeCustomPalette('teal')).toBeNull();
  });

  it('rejects a malformed custom id rather than crashing', () => {
    expect(decodeCustomPalette('custom:not-a-hex')).toBeNull();
    expect(decodeCustomPalette('customgrad:#abc')).toBeNull();
  });

  it('resolvePaletteOrCustom dispatches correctly for all three id shapes', () => {
    const curated = resolvePaletteOrCustom('teal', 'light');
    expect(curated.gradient).toBeUndefined();

    const solid = resolvePaletteOrCustom(encodeCustomPalette('#3366cc'), 'light');
    expect(solid.gradient).toBeUndefined();

    const gradient = resolvePaletteOrCustom(encodeCustomPalette('#3366cc', '#cc3366'), 'light');
    expect(gradient.gradient).toBeDefined();
  });

  it('falls back to the default palette for an unknown id', () => {
    const fallback = resolvePaletteOrCustom('not-a-real-id', 'light');
    const teal = resolvePaletteOrCustom('teal', 'light');
    expect(fallback).toEqual(teal);
  });
});
