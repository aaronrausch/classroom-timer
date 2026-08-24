/**
 * Curated palettes (SPEC §5.12, §7.2).
 *
 * These are authored, not derived. A single hue with automatic light/dark
 * derivation produces confident-looking colours that vanish on a weak projector
 * in a lit room, so every colour below is hand-picked for its theme and every
 * pair is checked by `tests/palettes.test.ts` rather than trusted.
 *
 * The colours are chosen to differ in **luminance**, not only hue. A design
 * separable only by hue disappears on a washed-out projector and to a
 * colour-blind student at the same time, which is the same failure twice.
 *
 * Roles:
 *   fill           the depleting quantity — the primary graphical object
 *   track          the space it has already vacated
 *   warning        the fill colour once the warning threshold is crossed
 *   numeral        digits and readout text: held to the stricter text ratio
 *   warningNumeral the same, in the warning state
 *   finishedBg/Fg  the full-viewport completion field and its glyph
 */

export interface PaletteColors {
  fill: string;
  track: string;
  warning: string;
  numeral: string;
  warningNumeral: string;
  finishedBg: string;
  finishedFg: string;
}

export interface Palette {
  id: string;
  label: string;
  light: PaletteColors;
  dark: PaletteColors;
}

export type ThemeMode = 'light' | 'dark';

/** Theme-level surfaces. Not part of a palette: the room decides these, not the activity. */
export const SURFACES: Record<ThemeMode, { bg: string; text: string; muted: string; panel: string; border: string }> = {
  light: { bg: '#f6f7f9', text: '#14181d', muted: '#4a5560', panel: '#ffffff', border: '#c9d1d9' },
  dark: { bg: '#101418', text: '#f2f5f8', muted: '#aab6c2', panel: '#191f26', border: '#3a444f' },
};

export const PALETTES: readonly Palette[] = [
  {
    id: 'teal',
    label: 'Teal',
    light: {
      fill: '#0f7d72',
      track: '#dfe5e9',
      warning: '#a03c06',
      numeral: '#0b5f57',
      warningNumeral: '#8c3405',
      finishedBg: '#0b5f57',
      finishedFg: '#ffffff',
    },
    dark: {
      fill: '#3ddbc4',
      track: '#2a3038',
      warning: '#ff8a5c',
      numeral: '#6fe8d4',
      warningNumeral: '#ffbe7d',
      finishedBg: '#3ddbc4',
      finishedFg: '#062821',
    },
  },
  {
    id: 'amber',
    label: 'Amber',
    light: {
      fill: '#b25c06',
      track: '#e6e2da',
      warning: '#b3200f',
      numeral: '#8f4a05',
      warningNumeral: '#a01c0d',
      finishedBg: '#8f4a05',
      finishedFg: '#ffffff',
    },
    dark: {
      fill: '#ffb454',
      track: '#332c25',
      warning: '#ff7048',
      numeral: '#ffc978',
      warningNumeral: '#ffa88c',
      finishedBg: '#ffb454',
      finishedFg: '#301c02',
    },
  },
  {
    id: 'indigo',
    label: 'Indigo',
    light: {
      fill: '#3b4fd8',
      track: '#dfe1ea',
      warning: '#8e1f0c',
      numeral: '#2f40b5',
      warningNumeral: '#8f2b19',
      finishedBg: '#2f40b5',
      finishedFg: '#ffffff',
    },
    dark: {
      fill: '#7d90f2',
      track: '#282d3a',
      warning: '#ffa571',
      numeral: '#adbcff',
      warningNumeral: '#ffb69a',
      finishedBg: '#7d90f2',
      finishedFg: '#111634',
    },
  },
  {
    id: 'rose',
    label: 'Rose',
    light: {
      fill: '#c02a63',
      track: '#ece0e5',
      warning: '#9c2f10',
      numeral: '#9c2251',
      warningNumeral: '#87280e',
      finishedBg: '#9c2251',
      finishedFg: '#ffffff',
    },
    dark: {
      fill: '#f77ba4',
      track: '#332a2e',
      warning: '#ffb877',
      numeral: '#ffa8c5',
      warningNumeral: '#ffc189',
      finishedBg: '#f77ba4',
      finishedFg: '#3a0a1e',
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    light: {
      fill: '#2f7a1f',
      track: '#e0e6dd',
      warning: '#8a2c04',
      numeral: '#255f19',
      warningNumeral: '#8e3205',
      finishedBg: '#255f19',
      finishedFg: '#ffffff',
    },
    dark: {
      fill: '#5cc23e',
      track: '#28312a',
      warning: '#ffbb7a',
      numeral: '#96e57d',
      warningNumeral: '#ffbe7d',
      finishedBg: '#5cc23e',
      finishedFg: '#0d2807',
    },
  },
  {
    id: 'violet',
    label: 'Violet',
    light: {
      fill: '#7a37c9',
      track: '#e6e1ec',
      warning: '#8e1f10',
      numeral: '#642ba6',
      warningNumeral: '#8e2a1b',
      finishedBg: '#642ba6',
      finishedFg: '#ffffff',
    },
    dark: {
      fill: '#b489f5',
      track: '#2e2a38',
      warning: '#ffa781',
      numeral: '#d6b3ff',
      warningNumeral: '#ffb69a',
      finishedBg: '#b489f5',
      finishedFg: '#26103f',
    },
  },
];

export const DEFAULT_PALETTE_ID = 'teal';

export function paletteById(id: string): Palette {
  return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0];
}

export function resolvePalette(id: string, mode: ThemeMode): PaletteColors {
  return paletteById(id)[mode];
}

// ------------------------------------------------------- contrast arithmetic
//
// Exported so the palette test, the custom-colour picker and the docs all use
// one implementation. WCAG 2.2 relative luminance and contrast ratio.

export function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const value = Number.parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(value)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

export function relativeLuminance(hex: string): number {
  const channels = parseHex(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

/** Graphical objects: 3:1. Text: 4.5:1. The two numbers this project cares about. */
export const CONTRAST_GRAPHICAL = 3;
export const CONTRAST_TEXT = 4.5;
