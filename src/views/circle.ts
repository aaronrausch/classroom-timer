import {
  depletionFraction,
  activeFill,
  activeNumeral,
  gradientStops,
  nextGradientId,
  setAttrs,
  svg,
} from './types';
import type { RenderState, Visualization } from './types';

export type CircleStyle = 'ring' | 'disc';
export type CircleTicks = 'none' | 'clock' | 'interval';

/**
 * The circle visualization, with one extra capability beyond the generic
 * `Visualization` interface: its tick style can be changed live, without
 * tearing down and recreating the ring/track/depletion-arc. See `setTicks`.
 */
export interface CircleVisualization extends Visualization {
  setTicks(mode: CircleTicks): void;
}

/**
 * Duration-relative tick spacing for `circleTicks: 'interval'` — the same
 * "always a round unit" discipline SPEC §5.3C requires of the dots mode,
 * applied here as a ruler around the circle rather than a countdown. Capped
 * higher than the dots ladder (60, not 30): these are reference marks a
 * teacher glances at, not individually-counted objects, so a finer ruler is
 * still legible.
 */
const TICK_INTERVAL_LADDER_SECONDS = [5, 10, 15, 30, 60, 120, 300, 600, 900] as const;
const MAX_INTERVAL_TICKS = 60;
/** Every Nth interval tick is drawn longer and heavier, like a clock's hour marks. */
const ACCENT_EVERY = 5;

function intervalTickPlan(totalSeconds: number): { intervalSeconds: number; count: number } {
  const duration = Math.max(1, Math.round(totalSeconds));
  for (const intervalSeconds of TICK_INTERVAL_LADDER_SECONDS) {
    const count = Math.floor(duration / intervalSeconds);
    if (count >= 2 && count <= MAX_INTERVAL_TICKS) return { intervalSeconds, count };
  }
  const intervalSeconds = TICK_INTERVAL_LADDER_SECONDS[TICK_INTERVAL_LADDER_SECONDS.length - 1];
  return { intervalSeconds, count: Math.min(MAX_INTERVAL_TICKS, Math.floor(duration / intervalSeconds)) };
}

/**
 * The default visualization (SPEC §5.3A).
 *
 * **Depletion runs clockwise from 12 o'clock**, mirroring the analogue clock
 * face and the physical classroom timers many students already know. This
 * direction is not configurable. Inverting it is the kind of change that looks
 * like a preference and behaves like a bug in front of thirty children.
 *
 * The geometry: an SVG `<circle>` begins its path at 3 o'clock and runs
 * clockwise. The transform mirrors it (reversing direction) and then rotates it
 * a quarter turn, so the path begins at 12 o'clock and runs *anticlockwise*.
 * The drawn arc is therefore the remaining time, anchored at 12, which means
 * the gap it leaves behind opens clockwise from 12. That gap is the depletion.
 *
 * Dash arithmetic rather than arc paths, because `dashoffset` is exact at both
 * extremes — a full circle and an empty one — where a single `A` command is
 * degenerate at one end and needs a special case at the other (SPEC §5.3).
 */
export function createCircle(
  root: HTMLElement,
  style: CircleStyle = 'ring',
  initialTicksMode: CircleTicks = 'none',
): CircleVisualization {
  // Mutable: `setTicks` below is what makes changing tick style a live
  // update rather than a full recreation of the visualization.
  let ticksMode = initialTicksMode;
  // Ring: a stroked outline. Disc: the same stroke, thickened until it closes
  // into a filled pie. One code path, two appearances, no arc maths either way.
  const radius = style === 'ring' ? 42 : 21;
  const strokeWidth = style === 'ring' ? 9 : 42;
  const warningStrokeWidth = style === 'ring' ? 12 : 42;
  const circumference = 2 * Math.PI * radius;

  // Exposed for the readout overlay: on the disc style the numeral colour
  // sits directly on the fill colour, a pairing tests/palettes.test.ts never
  // promises is legible (only numeral-vs-surface is verified). The readout's
  // own CSS keys off this to give itself a surface-coloured backdrop in that
  // one case — see the `.readout` rule in app.css.
  root.dataset['circleStyle'] = style;

  const svgEl = svg('svg', {
    viewBox: '0 0 100 100',
    preserveAspectRatio: 'xMidYMid meet',
    class: 'viz viz-circle',
    'aria-hidden': 'true',
    focusable: 'false',
  });

  const track = svg('circle', {
    cx: 50,
    cy: 50,
    r: radius,
    fill: 'none',
    'stroke-width': strokeWidth,
  });

  // Reference ticks, entirely opt-in (SPEC §5.3A lists these as a `[MAY]`).
  // Positioned to cross the ring's own stroke band — the base (non-animated)
  // width, so they never judder as the warning state thickens the ring — and
  // coloured from the theme's own text colour (black in light mode, white in
  // dark mode) via a live CSS variable, rather than a palette colour: a
  // single fixed hue would either vanish against some palettes or clash with
  // all of them, and updates for free on a theme change with no render-loop
  // involvement.
  const ticks = svg('g', { class: 'viz-circle-ticks' });
  // For the ring style this reaches just inside the ring's own inner edge,
  // crossing the stroke band like a real clock's rim marks. For the disc
  // style the naive version of this formula reaches all the way to the
  // centre (there is no hollow middle to stop at), which crowds the readout
  // text sitting there — so it is floored at a fixed fraction of the radius,
  // keeping ticks a short rim decoration on both styles.
  const tickInner = Math.max(radius * 0.72, radius - strokeWidth / 2 - 1);
  const tickOuter = radius + strokeWidth / 2 + 1;
  const tickOuterAccent = radius + strokeWidth / 2 + 2.5;

  function tickLine(angleDeg: number, accent: boolean): SVGLineElement {
    return svg('line', {
      x1: 50,
      y1: 50 - tickInner,
      x2: 50,
      y2: 50 - (accent ? tickOuterAccent : tickOuter),
      transform: `rotate(${angleDeg} 50 50)`,
      stroke: 'var(--surface-text)',
      'stroke-width': accent ? 2 : 1.1,
      'stroke-linecap': 'round',
    });
  }

  let lastTotalSeconds = 0;
  // Tracks what's actually built, independent of `ticksMode`/mode-specific
  // state below, so `render()` only pays for a rebuild when something that
  // would change the drawn ticks actually changed.
  let builtFor = '';

  function rebuildTicks(): void {
    const key = `${ticksMode}:${ticksMode === 'interval' ? Math.round(lastTotalSeconds) : ''}`;
    if (key === builtFor) return;
    builtFor = key;
    while (ticks.firstChild) ticks.removeChild(ticks.firstChild);

    if (ticksMode === 'clock') {
      // Twelve fixed marks, like an analogue clock face; the four quarter
      // positions ("ticks in hour clock positions") read as the accented ones.
      for (let i = 0; i < 12; i += 1) {
        ticks.append(tickLine(i * 30, i % 3 === 0));
      }
      return;
    }

    if (ticksMode === 'interval') {
      const rounded = Math.round(lastTotalSeconds);
      if (rounded <= 0) return;
      const plan = intervalTickPlan(rounded);
      for (let i = 1; i <= plan.count; i += 1) {
        const angle = (i * plan.intervalSeconds * 360) / rounded;
        ticks.append(tickLine(angle, i % ACCENT_EVERY === 0));
      }
    }
  }

  rebuildTicks();

  const remaining = svg('circle', {
    cx: 50,
    cy: 50,
    r: radius,
    fill: 'none',
    'stroke-width': strokeWidth,
    'stroke-linecap': 'butt', // A round cap leaves a blob on the wall at zero.
    'stroke-dasharray': circumference,
    'stroke-dashoffset': 0,
    transform: 'rotate(90 50 50) matrix(-1 0 0 1 100 0)',
  });

  // One gradient, spanning the full 100x100 viewBox corner-to-corner, so the
  // depleting arc reads as a single fixed sweep across the whole face rather
  // than each drawn segment picking its own colour (per the gradient design:
  // "maps onto the whole view of the timer, not individual elements").
  const gradientId = nextGradientId('circle');
  const gradientFrom = svg('stop', { offset: '0%' });
  const gradientTo = svg('stop', { offset: '100%' });
  const gradientEl = svg('linearGradient', {
    id: gradientId,
    gradientUnits: 'userSpaceOnUse',
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 100,
  });
  gradientEl.append(gradientFrom, gradientTo);
  const defs = svg('defs', {});
  defs.append(gradientEl);

  svgEl.append(defs, track, ticks, remaining);
  root.append(svgEl);

  let lastFill = '';
  let lastTrack = '';
  let lastWidth = -1;
  let lastNumeral = '';

  return {
    id: 'circle',
    supportsReadout: true,
    setTicks(mode: CircleTicks) {
      // Deliberately does not touch track/remaining/readout at all — only
      // this group's own children change, so there is nothing to flash.
      ticksMode = mode;
      rebuildTicks();
    },
    render(state: RenderState) {
      lastTotalSeconds = state.totalMs / 1000;
      rebuildTicks();

      const fraction = depletionFraction(state);
      // dashoffset C*(1-f) leaves exactly C*f drawn: exact at 1, exact at 0.
      setAttrs(remaining, { 'stroke-dashoffset': circumference * (1 - fraction) });

      const stops = gradientStops(state);
      const fill = stops ? `url(#${gradientId})` : activeFill(state);
      if (stops) {
        setAttrs(gradientFrom, { 'stop-color': stops.from });
        setAttrs(gradientTo, { 'stop-color': stops.to });
      }
      if (fill !== lastFill) {
        remaining.setAttribute('stroke', fill);
        lastFill = fill;
      }
      if (state.colors.track !== lastTrack) {
        track.setAttribute('stroke', state.colors.track);
        lastTrack = state.colors.track;
      }

      // The second, non-colour channel for the warning state: the ring thickens
      // and holds. Sustained, not animated — never a pulse (SPEC §5.5, §8).
      const width = strokeWidth + (warningStrokeWidth - strokeWidth) * state.warningMix;
      if (width !== lastWidth) {
        remaining.setAttribute('stroke-width', String(width));
        lastWidth = width;
      }

      const numeral = activeNumeral(state);
      if (numeral !== lastNumeral) {
        svgEl.style.color = numeral;
        lastNumeral = numeral;
      }
    },
    destroy() {
      svgEl.remove();
    },
  };
}
