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
  /**
   * Present only for gradient palettes. When set, a view draws a single
   * gradient spanning its *whole* viewBox/box and lets each element (each
   * dot, the ring's arc, the bar's fill) sample its own position from that
   * one fixed gradient — not each element gradient-filled independently,
   * which would look like a busy repeat rather than one image (SPEC-adjacent
   * design; see docs/adr/0007-gradient-themes.md). `fill` above still holds
   * a representative solid colour for anything that cannot render a gradient
   * (a preset tile's accent stripe, a swatch preview at small size).
   */
  gradient?: { from: string; to: string };
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
  {
    id: 'crimson',
    label: 'Crimson',
    light: {
      fill: '#c0293d',
      track: '#ecd2d7',
      warning: '#c04d29',
      numeral: '#c0293d',
      warningNumeral: '#c04d29',
      finishedBg: '#c0293d',
      finishedFg: '#ffffff',
    },
    dark: {
      fill: '#c0293d',
      track: '#20161b',
      warning: '#c04d29',
      numeral: '#d94d60',
      warningNumeral: '#d5613c',
      finishedBg: '#d94d60',
      finishedFg: '#000000',
    },
  },
  {
    id: 'coral',
    label: 'Coral',
    light: {
      fill: '#e2622a',
      track: '#f5eeed',
      warning: '#e2612a',
      numeral: '#b64919',
      warningNumeral: '#b64819',
      finishedBg: '#b64919',
      finishedFg: '#ffffff',
    },
    dark: {
      fill: '#e2622a',
      track: '#36221b',
      warning: '#e2612a',
      numeral: '#e2622a',
      warningNumeral: '#e2612a',
      finishedBg: '#e2622a',
      finishedFg: '#000000',
    },
  },
  {
    id: 'mustard',
    label: 'Mustard',
    light: {
      fill: '#a3821c',
      track: '#efece5',
      warning: '#a34e1c',
      numeral: '#806616',
      warningNumeral: '#a34e1c',
      finishedBg: '#806616',
      finishedFg: '#ffffff',
    },
    dark: {
      fill: '#a3821c',
      track: '#2a2819',
      warning: '#b4561f',
      numeral: '#a3821c',
      warningNumeral: '#d76725',
      finishedBg: '#a3821c',
      finishedFg: '#000000',
    },
  },
  {
    id: 'lime',
    label: 'Lime',
    light: {
      fill: '#5e8f1f',
      track: '#dfe7d8',
      warning: '#8f541f',
      numeral: '#486d18',
      warningNumeral: '#8f541f',
      finishedBg: '#486d18',
      finishedFg: '#ffffff',
    },
    dark: {
      fill: '#5e8f1f',
      track: '#1e2a19',
      warning: '#b16826',
      numeral: '#5e8f1f',
      warningNumeral: '#c1722a',
      finishedBg: '#5e8f1f',
      finishedFg: '#000000',
    },
  },
  {
    id: 'jade',
    label: 'Jade',
    light: {
      fill: '#1f8f6b',
      track: '#cfe4df',
      warning: '#8f691f',
      numeral: '#1b7e5e',
      warningNumeral: '#8f691f',
      finishedBg: '#1b7e5e',
      finishedFg: '#ffffff',
    },
    dark: {
      fill: '#1f8f6b',
      track: '#132a27',
      warning: '#8f691f',
      numeral: '#1f8f6b',
      warningNumeral: '#b18226',
      finishedBg: '#1f8f6b',
      finishedFg: '#000000',
    },
  },
  {
    id: 'sky',
    label: 'Sky',
    light: {
      fill: '#1f7fa8',
      track: '#cfe1ea',
      warning: '#97781c',
      numeral: '#1c7297',
      warningNumeral: '#866b19',
      finishedBg: '#1c7297',
      finishedFg: '#ffffff',
    },
    dark: {
      fill: '#1f7fa8',
      track: '#132732',
      warning: '#a8861f',
      numeral: '#228cb9',
      warningNumeral: '#a8861f',
      finishedBg: '#228cb9',
      finishedFg: '#000000',
    },
  },
  {
    id: 'cobalt',
    label: 'Cobalt',
    light: {
      fill: '#2d4fb0',
      track: '#d2d9ec',
      warning: '#b02d38',
      numeral: '#2d4fb0',
      warningNumeral: '#b02d38',
      finishedBg: '#2d4fb0',
      finishedFg: '#ffffff',
    },
    dark: {
      fill: '#3960cc',
      track: '#141b28',
      warning: '#c0313d',
      numeral: '#5a7ad5',
      warningNumeral: '#d55a64',
      finishedBg: '#5a7ad5',
      finishedFg: '#000000',
    },
  },
  {
    id: 'plum',
    label: 'Plum',
    light: {
      fill: '#8a3a9e',
      track: '#e3d5e9',
      warning: '#a73a31',
      numeral: '#8a3a9e',
      warningNumeral: '#a73a31',
      finishedBg: '#8a3a9e',
      finishedFg: '#ffffff',
    },
    dark: {
      fill: '#973fad',
      track: '#1c1825',
      warning: '#b73f36',
      numeral: '#b264c6',
      warningNumeral: '#cf645b',
      finishedBg: '#b264c6',
      finishedFg: '#000000',
    },
  },
  {
    id: 'magenta',
    label: 'Magenta',
    light: {
      fill: '#c22d8a',
      track: '#edd3e5',
      warning: '#c2452d',
      numeral: '#c22d8a',
      warningNumeral: '#c2452d',
      finishedBg: '#c22d8a',
      finishedFg: '#ffffff',
    },
    dark: {
      fill: '#c22d8a',
      track: '#30192d',
      warning: '#c2452d',
      numeral: '#d4449e',
      warningNumeral: '#d45b44',
      finishedBg: '#d4449e',
      finishedFg: '#000000',
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

// ------------------------------------------------------------ custom colour
//
// A curated palette is authored by hand and every pairing is verified by
// tests/palettes.test.ts. A teacher's own hex — a school colour, say — has no
// such guarantee, so every role below is *derived* with a contrast floor
// built into the derivation itself, rather than trusting the raw input and
// merely warning if it fails (SPEC §5.12's "[SHOULD] ... a live contrast
// warning if the chosen colour fails" — a floor that makes the failure
// impossible is stronger than a warning the teacher can dismiss without
// reading, so the fill itself is corrected in dark mode / light mode too,
// not just the numerals). See docs/adr/0007-gradient-themes.md.

function toHex2(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0');
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
}

/** Blend two hex colours in linear sRGB channel space. `t=0` is `a`, `t=1` is `b`. */
export function mixHexColors(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = parseHex(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return [h * 60, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const S = Math.min(100, Math.max(0, s)) / 100;
  const L = Math.min(100, Math.max(0, l)) / 100;
  const H = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = L - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (H < 60) [r, g, b] = [c, x, 0];
  else if (H < 120) [r, g, b] = [x, c, 0];
  else if (H < 180) [r, g, b] = [0, c, x];
  else if (H < 240) [r, g, b] = [0, x, c];
  else if (H < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * Push `hex` toward black or toward white — whichever `direction` says —
 * until it reaches `minRatio` contrast against `against`. Hue and saturation
 * are preserved as long as possible; only lightness moves. Guaranteed to
 * terminate at pure black/white, which always clears any WCAG ratio against
 * a real colour.
 */
function withMinContrast(
  hex: string,
  against: string,
  minRatio: number,
  direction: 'darken' | 'lighten',
): string {
  if (contrastRatio(hex, against) >= minRatio) return hex;
  const [h, s, l] = hexToHsl(hex);
  let lightness = l;
  let candidate = hex;
  for (let i = 0; i < 24; i += 1) {
    lightness = direction === 'darken' ? lightness - 4 : lightness + 4;
    candidate = hslToHex(h, s, lightness);
    if (contrastRatio(candidate, against) >= minRatio) return candidate;
    if (lightness <= 0 || lightness >= 100) break;
  }
  return direction === 'darken' ? '#000000' : '#ffffff';
}

/**
 * A faint tint of `fill` toward `bg` — close enough to read as "the room's
 * own background, barely touched" while staying far enough from `fill` to
 * clear the graphical contrast floor between them. A fixed mix ratio (e.g.
 * "82% background") is not enough on its own: contrast is not linear in the
 * mix amount, so for some fill/bg pairs an 82% tint is still too close to
 * fill. Walking the ratio toward 100% (pure `bg`) is guaranteed to succeed,
 * since `fill` is already contrast-corrected against `bg` itself.
 */
function trackFor(fill: string, bg: string): string {
  let ratio = 0.82;
  let track = mixHexColors(fill, bg, ratio);
  for (let i = 0; i < 12 && contrastRatio(fill, track) < CONTRAST_GRAPHICAL; i += 1) {
    ratio = Math.min(1, ratio + 0.03);
    track = mixHexColors(fill, bg, ratio);
  }
  return track;
}

/**
 * Rotate most of the way toward an alert orange-red (~18°), along the
 * shortest arc. A gentler rotation (originally tried at 55%) leaves hues
 * near the *antipode* of 18° — roughly 198°, a cool sky-blue — landing
 * nowhere near warm: half of a ~180° arc is still ~90° short, which reads as
 * an arbitrary green rather than anything alert-coloured. 85% keeps every
 * input recognisably warm without fully discarding its original hue.
 */
function towardAlertHue(h: number): number {
  const target = 18;
  let delta = target - h;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return h + delta * 0.85;
}

export function isCustomPaletteId(id: string): boolean {
  return id.startsWith('custom:') || id.startsWith('customgrad:');
}

/** `"custom:#3366cc"` for a solid colour, `"customgrad:#3366cc:#cc3366"` for a gradient. */
export function encodeCustomPalette(from: string, to?: string): string {
  return to ? `customgrad:${from}:${to}` : `custom:${from}`;
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Returns null if `id` is not a well-formed custom colour, so callers can fall back cleanly. */
export function decodeCustomPalette(id: string): { from: string; to: string | null } | null {
  if (id.startsWith('customgrad:')) {
    const [, from, to] = id.split(':');
    if (from && to && HEX_RE.test(from) && HEX_RE.test(to)) return { from, to };
    return null;
  }
  if (id.startsWith('custom:')) {
    const from = id.slice('custom:'.length);
    if (HEX_RE.test(from)) return { from, to: null };
    return null;
  }
  return null;
}

/**
 * Derive a full role set from one teacher-chosen hex. `fill` is
 * contrast-corrected against the room background (so a dark navy still shows
 * up on a dark projector, and a pale yellow still shows up on a lit wall);
 * `numeral`/`warningNumeral` are corrected to the stricter text ratio;
 * `warning` is the fill hue-rotated toward alert orange-red, corrected the
 * same way as fill; `track` is a faint tint of fill against the background;
 * `finishedBg` reuses `numeral` (the pairing every curated palette already
 * uses) and `finishedFg` is whichever of black/white contrasts better.
 */
export function deriveCustomPalette(hex: string, mode: ThemeMode): PaletteColors {
  const surface = SURFACES[mode];
  const direction = mode === 'light' ? 'darken' : 'lighten';

  const fill = withMinContrast(hex, surface.bg, CONTRAST_GRAPHICAL, direction);
  const track = trackFor(fill, surface.bg);
  const numeral = withMinContrast(hex, surface.bg, CONTRAST_TEXT, direction);

  const [h, s, l] = hexToHsl(hex);
  const warningBase = hslToHex(towardAlertHue(h), Math.max(55, s), l);
  let warning = withMinContrast(warningBase, surface.bg, CONTRAST_GRAPHICAL, direction);
  // withMinContrast only checks against `surface.bg`; a warning colour close
  // in lightness to its own track (the same failure mode fill/track just had)
  // needs the same explicit push, this time away from track specifically.
  warning = withMinContrast(warning, track, CONTRAST_GRAPHICAL, direction);
  const warningNumeral = withMinContrast(warningBase, surface.bg, CONTRAST_TEXT, direction);

  const finishedBg = numeral;
  const finishedFg = contrastRatio('#ffffff', finishedBg) >= contrastRatio('#000000', finishedBg)
    ? '#ffffff'
    : '#000000';

  return { fill, track, warning, numeral, warningNumeral, finishedBg, finishedFg };
}

/**
 * The gradient variant: two chosen hues become the gradient's stops. Every
 * solid role (numeral, warning, track, finished state) is derived from the
 * midpoint blend of the two, which is a more representative stand-in for
 * "this palette's colour" than picking one stop arbitrarily.
 */
export function deriveCustomGradientPalette(
  fromHex: string,
  toHex: string,
  mode: ThemeMode,
): PaletteColors {
  const midpoint = mixHexColors(fromHex, toHex, 0.5);
  const base = deriveCustomPalette(midpoint, mode);
  const surface = SURFACES[mode];
  const direction = mode === 'light' ? 'darken' : 'lighten';
  return {
    ...base,
    fill: withMinContrast(midpoint, surface.bg, CONTRAST_GRAPHICAL, direction),
    gradient: {
      from: withMinContrast(fromHex, surface.bg, CONTRAST_GRAPHICAL, direction),
      to: withMinContrast(toHex, surface.bg, CONTRAST_GRAPHICAL, direction),
    },
  };
}

/**
 * The one entry point views and UI should use to go from a preset's
 * `palette` id to real colours — curated, custom solid, or custom gradient,
 * indistinguishably. `theme.colorsFor()` is a thin wrapper over this.
 */
export function resolvePaletteOrCustom(id: string, mode: ThemeMode): PaletteColors {
  const custom = decodeCustomPalette(id);
  if (custom) {
    return custom.to
      ? deriveCustomGradientPalette(custom.from, custom.to, mode)
      : deriveCustomPalette(custom.from, mode);
  }
  return resolvePalette(id, mode);
}
