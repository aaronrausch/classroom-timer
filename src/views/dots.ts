import { createCircle } from './circle';
import type { CircleVisualization } from './circle';
import {
  activeFill,
  activeNumeral,
  depletionFraction,
  gradientStops,
  nextGradientId,
  setAttrs,
  svg,
} from './types';
import type { RenderState, Visualization } from './types';

/**
 * Time as a *countable* quantity (SPEC §5.3C).
 *
 * "Three dots left" is a different and often stronger statement than "a third
 * of the ring left", particularly for younger students and for anyone who
 * finds proportion hard to read. That only works if a dot is a round unit of
 * time, so the interval comes from a fixed ladder and a dot never represents
 * thirty-seven seconds.
 */
const INTERVAL_LADDER_SECONDS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900] as const;

const MAX_DOTS = 30;

export interface DotPlan {
  /** Seconds of time one dot stands for. Always a round unit. */
  intervalSeconds: number;
  /** How many dots the grid holds. */
  count: number;
}

/**
 * Choose the finest interval from the ladder that keeps the grid countable.
 *
 * Ascending intervals give descending dot counts, so the first interval at or
 * under the cap is also the one giving the most dots — the most granular grid
 * a teacher can still count at a glance.
 */
export function dotPlan(durationSeconds: number): DotPlan {
  const duration = Math.max(1, Math.round(durationSeconds));
  for (const intervalSeconds of INTERVAL_LADDER_SECONDS) {
    const count = Math.ceil(duration / intervalSeconds);
    if (count <= MAX_DOTS) return { intervalSeconds, count };
  }
  const intervalSeconds = INTERVAL_LADDER_SECONDS[INTERVAL_LADDER_SECONDS.length - 1];
  return { intervalSeconds, count: Math.min(MAX_DOTS, Math.ceil(duration / intervalSeconds)) };
}

/**
 * How the teacher will say it out loud. The interval must be discoverable when
 * choosing the mode, because it changes the narration — "one dot per minute"
 * is a sentence a teacher says to a class (SPEC §5.3C).
 */
export function dotIntervalLabel(intervalSeconds: number): string {
  if (intervalSeconds % 60 === 0) {
    const minutes = intervalSeconds / 60;
    return minutes === 1 ? 'One dot per minute' : `One dot per ${minutes} minutes`;
  }
  return intervalSeconds === 1 ? 'One dot per second' : `One dot per ${intervalSeconds} seconds`;
}

/**
 * Pick a grid shape for `count` dots.
 *
 * A complete rectangle reads as *designed*; a ragged final row reads as a
 * mistake. So this does not simply maximise per-dot size — it prefers a shape
 * with few or no leftover cells (`cols * rows - count`), and only accepts a
 * worse (more elongated, e.g. 13×1) fit when a near-rectangle would need an
 * unreasonable number of them. The few leftover cells a prime or awkward
 * count sometimes forces are not left empty; the caller fills them with a
 * permanent faint "ghost" dot, so the grid is always visually whole even
 * though a couple of positions never corresponded to real countdown time.
 *
 * The trade this makes explicit: the *drawn* grid takes precedence over
 * squeezing the maximum size out of an odd dot count.
 */
export function gridShape(count: number, aspect: number): { cols: number; rows: number } {
  let best = { cols: count, rows: 1 };
  let bestScore = Infinity;
  // How much per-dot size a single leftover (ghost) cell is worth trading
  // away. Calibrated against the actual size scale this loop computes
  // (roughly 0.05-0.5): high enough that a near-square shape with one or two
  // ghosts beats a long thin strip (13 -> 7x2, one ghost, rather than 13x1),
  // low enough that a genuinely perfect rectangle (20 = 5x4) is never passed
  // over for a padded alternative.
  const LEFTOVER_WEIGHT = 0.08;

  for (let cols = 1; cols <= count; cols += 1) {
    const rows = Math.ceil(count / cols);
    const leftover = cols * rows - count;
    // Cell size available in a box of the given aspect, in arbitrary units.
    const size = Math.min(aspect / cols, 1 / rows);
    const score = leftover * LEFTOVER_WEIGHT - size;
    if (score < bestScore - 1e-9) {
      bestScore = score;
      best = { cols, rows };
    }
  }
  return best;
}

/** A spent or filler dot fades to this fraction of the track colour's opacity. */
const GHOST_OPACITY = 0.16;

/**
 * How far dot `index` (of `count`, reading order, equal shares) has shrunk
 * toward nothing under the "shrink" smooth-motion style: 0 at full size, 1
 * fully gone. Pure and continuous — driven straight off the render loop's
 * own continuous elapsed fraction, no per-second step anywhere in it — which
 * is what lets every lit dot visibly shrink in lockstep as the whole timer
 * runs, rather than only the one dot whose turn it currently is.
 */
export function dotShrinkProgress(elapsedFraction: number, index: number, count: number): number {
  if (count <= 0) return 1;
  return Math.min(1, Math.max(0, elapsedFraction * count - index));
}

export function createDots(root: HTMLElement): Visualization {
  const svgEl = svg('svg', {
    viewBox: '0 0 10 10',
    preserveAspectRatio: 'xMidYMid meet',
    class: 'viz viz-dots',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  // One gradient shared by every lit dot, spanning the grid's own viewBox
  // corner-to-corner — each dot's fill just references it and samples its own
  // position, rather than each dot computing an independent colour (per the
  // gradient design: "maps onto the whole view of the timer, not individual
  // elements"). Its coordinates are re-anchored in `build()` whenever the grid
  // is reshaped, since the viewBox itself changes with the dot count.
  const gradientId = nextGradientId('dots');
  const gradientFrom = svg('stop', { offset: '0%' });
  const gradientTo = svg('stop', { offset: '100%' });
  const gradientEl = svg('linearGradient', {
    id: gradientId,
    gradientUnits: 'userSpaceOnUse',
    x1: 0,
    y1: 0,
    x2: 10,
    y2: 10,
  });
  gradientEl.append(gradientFrom, gradientTo);
  const defs = svg('defs', {});
  defs.append(gradientEl);
  svgEl.append(defs);

  root.append(svgEl);

  interface Cell {
    base: SVGCircleElement;
    /** The pie overlay used only by the one dot that is currently draining. */
    pie: SVGCircleElement;
    cx: number;
    cy: number;
    r: number;
    /**
     * A grid-completion cell beyond the real dot count (see `gridShape`). It
     * never lights, never drains — it is a permanent faint shadow so the grid
     * reads as a designed rectangle rather than a ragged countdown artefact.
     */
    isPadding: boolean;
  }

  let cells: Cell[] = [];
  let builtCount = -1;
  let builtCols = -1;
  let aspect = 16 / 9;

  const observer =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver((entries) => {
          const box = entries[0]?.contentRect;
          if (!box || box.height <= 0) return;
          const next = box.width / box.height;
          if (Math.abs(next - aspect) > 0.02) {
            aspect = next;
            builtCols = -1; // force a relayout on the next frame
          }
        })
      : null;
  observer?.observe(root);

  function build(count: number): void {
    const { cols, rows } = gridShape(count, aspect);
    if (count === builtCount && cols === builtCols) return;
    builtCount = count;
    builtCols = cols;

    // `defs` (holding the shared gradient) is excluded from the wipe — it is
    // not a dot and must survive a reshape, just re-anchored to the new span.
    while (svgEl.lastChild && svgEl.lastChild !== defs) svgEl.removeChild(svgEl.lastChild);
    cells = [];

    const cell = 10;
    const r = cell * 0.4;
    svgEl.setAttribute('viewBox', `0 0 ${cols * cell} ${rows * cell}`);
    setAttrs(gradientEl, { x2: cols * cell, y2: rows * cell });

    // The grid is always the full cols×rows rectangle. Positions at or beyond
    // `count` are padding: real screen position, never a real countdown unit.
    const total = cols * rows;
    for (let i = 0; i < total; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = col * cell + cell / 2;
      const cy = row * cell + cell / 2;

      const base = svg('circle', { cx, cy, r });
      // The draining dot is a miniature of the circle mode: same clockwise-from
      // -twelve geometry, same dash arithmetic, so the last interval is never a
      // dead zone where nothing appears to happen.
      const pie = svg('circle', {
        cx,
        cy,
        r: r / 2,
        fill: 'none',
        'stroke-width': r,
        'stroke-linecap': 'butt',
        'stroke-dasharray': Math.PI * r,
        'stroke-dashoffset': 0,
        transform: `rotate(90 ${cx} ${cy}) matrix(-1 0 0 1 ${2 * cx} 0)`,
        opacity: 0,
      });
      svgEl.append(base, pie);
      cells.push({ base, pie, cx, cy, r, isPadding: i >= count });
    }
  }

  // The "ring" smooth-motion style does not draw dots at all — it borrows
  // circle mode's own renderer wholesale rather than reimplementing its dash
  // arithmetic, and is only ever constructed while that style is actually
  // selected, so choosing it never pays for an SVG tree nothing is showing.
  let ringDelegate: CircleVisualization | null = null;
  let activeMode: 'grid' | 'ring' = 'grid';

  function ensureGridMode(): void {
    if (activeMode === 'grid') return;
    activeMode = 'grid';
    ringDelegate?.destroy();
    ringDelegate = null;
    svgEl.removeAttribute('hidden');
  }

  function ensureRingMode(): void {
    if (activeMode === 'ring') return;
    activeMode = 'ring';
    svgEl.setAttribute('hidden', '');
    ringDelegate = createCircle(root, 'ring', 'none');
  }

  let lastNumeral = '';

  return {
    id: 'dots',
    supportsReadout: true,
    render(state: RenderState) {
      if (state.smoothMotion && state.dotsSmoothStyle === 'ring') {
        ensureRingMode();
        ringDelegate?.render(state);
        return;
      }
      ensureGridMode();

      const plan = dotPlan(Math.round(state.totalMs / 1000));
      build(plan.count);

      const stops = gradientStops(state);
      const fill = stops ? `url(#${gradientId})` : activeFill(state);
      if (stops) {
        setAttrs(gradientFrom, { 'stop-color': stops.from });
        setAttrs(gradientTo, { 'stop-color': stops.to });
      }
      const track = state.colors.track;

      // The non-colour channel for the warning state: the dots swell slightly.
      const grow = 1 + 0.08 * state.warningMix;

      if (state.smoothMotion && state.dotsSmoothStyle === 'shrink') {
        // Every lit dot's own size is a direct, continuous function of how
        // much of its own equal share of the timer has elapsed — nothing
        // here steps once per second, and nothing here waits for a "turn"
        // the way the countable style's single draining dot does.
        const elapsed = 1 - depletionFraction(state);
        for (let i = 0; i < cells.length; i += 1) {
          const cellRef = cells[i];
          if (cellRef.isPadding) {
            setAttrs(cellRef.base, { r: cellRef.r, fill: track, opacity: GHOST_OPACITY });
            setAttrs(cellRef.pie, { opacity: 0 });
            continue;
          }
          const progress = dotShrinkProgress(elapsed, i, plan.count);
          const radius = cellRef.r * grow * (1 - progress);
          setAttrs(cellRef.base, { r: Math.max(0, radius), fill, opacity: 1 });
          setAttrs(cellRef.pie, { opacity: 0 });
        }
      } else {
        const intervalMs = plan.intervalSeconds * 1000;
        const remainingDots = state.remainingMs / intervalMs;
        // Guard against floating point leaving a hairline dot lit at exactly zero.
        const litCount = Math.max(0, Math.min(plan.count, Math.ceil(remainingDots - 1e-9)));
        const firstLit = plan.count - litCount;
        const partial = litCount > 0 ? remainingDots - (litCount - 1) : 0;

        for (let i = 0; i < cells.length; i += 1) {
          const cellRef = cells[i];
          const radius = cellRef.r * grow;

          if (cellRef.isPadding) {
            // Never lights, never drains: a permanent faint shadow that
            // completes the rectangle (see `gridShape`).
            setAttrs(cellRef.base, { r: cellRef.r, fill: track, opacity: GHOST_OPACITY });
            setAttrs(cellRef.pie, { opacity: 0 });
            continue;
          }

          if (i < firstLit) {
            // Spent — left as a faint shadow of itself, not a solid disc, so
            // the eye reads "used up" without it competing with what remains.
            setAttrs(cellRef.base, { r: cellRef.r, fill: track, opacity: GHOST_OPACITY });
            setAttrs(cellRef.pie, { opacity: 0 });
            continue;
          }

          if (i > firstLit) {
            setAttrs(cellRef.base, { r: radius, fill, opacity: 1 });
            setAttrs(cellRef.pie, { opacity: 0 });
            continue;
          }

          // The draining dot.
          if (state.reducedMotion) {
            setAttrs(cellRef.base, { r: radius, fill, opacity: 1 });
            setAttrs(cellRef.pie, { opacity: 0 });
          } else {
            setAttrs(cellRef.base, { r: radius, fill: track, opacity: GHOST_OPACITY });
            setAttrs(cellRef.pie, {
              opacity: 1,
              stroke: fill,
              r: radius / 2,
              'stroke-width': radius,
              'stroke-dasharray': Math.PI * radius,
              'stroke-dashoffset': Math.PI * radius * (1 - Math.min(1, Math.max(0, partial))),
            });
          }
        }
      }

      // Tracked separately from `changedColours`: in gradient mode `fill` stays
      // a stable `url(#id)` through a warning cross-fade (only the referenced
      // stops move), so gating this on the same flag would freeze the numeral
      // mid-fade instead of following `warningMix` like every other view.
      const numeral = activeNumeral(state);
      if (numeral !== lastNumeral) {
        svgEl.style.color = numeral;
        lastNumeral = numeral;
      }
    },
    destroy() {
      observer?.disconnect();
      ringDelegate?.destroy();
      svgEl.remove();
    },
  };
}
