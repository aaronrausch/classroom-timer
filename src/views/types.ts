import type { TimerPhase, TimerState } from '../core/timer';
import type { VisualizationId } from '../core/presets';
import type { PaletteColors } from '../ui/palettes';

/**
 * Everything a visualization is allowed to know. Views are dumb renderers:
 * they receive state and draw it, and they never read a clock, a store or a
 * setting (SPEC §9.2). All four implement this one interface, so adding a
 * fifth is a single new file — that is the extension point and it stays cheap.
 */
export interface RenderState {
  remainingMs: number;
  totalMs: number;
  /** Remaining as a fraction of total. Exactly 1 at rest, exactly 0 at zero. */
  fraction: number;
  state: TimerState;
  phase: TimerPhase;
  colors: PaletteColors;
  /** Overlay readout requested. Ignored by views that do not support it. */
  readout: boolean;
  /** The current preset/timer's own name, for the optional corner label (SPEC-adjacent; see Stage). */
  name: string;
  /** Whether that corner label should be shown at all. */
  showName: boolean;
  reducedMotion: boolean;
  /**
   * How far into the warning appearance the display is, 0..1. The app ramps
   * this over ~600 ms so the change is a cross-fade and never a jump or a
   * flash (SPEC §5.5); under reduced motion it is 0 or 1 and nothing else.
   */
  warningMix: number;
}

export interface Visualization {
  readonly id: VisualizationId;
  /** False for digits, where a numeric overlay on numerals would be absurd (SPEC §5.4). */
  readonly supportsReadout: boolean;
  render(state: RenderState): void;
  destroy(): void;
}

export type VisualizationFactory = (root: HTMLElement) => Visualization;

export const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

export function setAttrs(element: Element, attrs: Record<string, string | number>): void {
  for (const [key, value] of Object.entries(attrs)) {
    const next = String(value);
    // Avoid touching the DOM when nothing changed: this runs 60 times a second
    // on hardware that has none to spare (SPEC §11.3).
    if (element.getAttribute(key) !== next) element.setAttribute(key, next);
  }
}

/** Linear sRGB-space blend, adequate for a 600 ms cross-fade between two authored colours. */
export function mixHex(from: string, to: string, t: number): string {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const a = hexChannels(from);
  const b = hexChannels(to);
  const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `#${[channel(0), channel(1), channel(2)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

function hexChannels(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** The colour the depleting quantity is drawn in, mid-cross-fade. */
export function activeFill(state: RenderState): string {
  return mixHex(state.colors.fill, state.colors.warning, state.warningMix);
}

/**
 * The two stop colours for a gradient palette, mid-cross-fade — each stop
 * blends toward the *same* solid warning colour independently, so the warning
 * state still reads as "the whole sweep is now alarmed", not a jump to flat
 * colour. `null` for a non-gradient palette, so callers can `if` on it once.
 */
export function gradientStops(state: RenderState): { from: string; to: string } | null {
  const gradient = state.colors.gradient;
  if (!gradient) return null;
  return {
    from: mixHex(gradient.from, state.colors.warning, state.warningMix),
    to: mixHex(gradient.to, state.colors.warning, state.warningMix),
  };
}

let gradientIdCounter = 0;

/** A DOM-unique id for a view's own `<linearGradient>` def. */
export function nextGradientId(prefix: string): string {
  gradientIdCounter += 1;
  return `${prefix}-gradient-${gradientIdCounter}`;
}

/** The colour numerals are drawn in, held to the stricter text contrast ratio. */
export function activeNumeral(state: RenderState): string {
  return mixHex(state.colors.numeral, state.colors.warningNumeral, state.warningMix);
}

export function formatClock(remainingMs: number, showTenths = false): string {
  // Ceiling, not floor: a timer showing 0:00 with time left on it is a lie the
  // whole room can see. 1 ms remaining reads as 0:01.
  const totalSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (showTenths) {
    const tenths = Math.floor((Math.max(0, remainingMs) % 1000) / 100);
    return `${Math.floor(Math.max(0, remainingMs) / 1000)}.${tenths}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The fraction the graphical views actually draw.
 *
 * Normally this is the continuous fraction, because stepped depletion reads as
 * a stutter on a wall. Under `prefers-reduced-motion` it steps once per second
 * instead (SPEC §8) — still exact at both ends, still fully functional, just
 * without the continuous movement that some people cannot tolerate.
 */
export function depletionFraction(state: RenderState): number {
  if (!state.reducedMotion) return state.fraction;
  if (state.totalMs <= 0) return 0;
  const stepped = Math.ceil(state.remainingMs / 1000) * 1000;
  return Math.min(1, Math.max(0, stepped / state.totalMs));
}
