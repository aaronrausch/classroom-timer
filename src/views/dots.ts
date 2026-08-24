import { activeFill, activeNumeral, setAttrs, svg } from './types';
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

export function createDots(root: HTMLElement): Visualization {
  const svgEl = svg('svg', {
    viewBox: '0 0 10 10',
    preserveAspectRatio: 'xMidYMid meet',
    class: 'viz viz-dots',
    'aria-hidden': 'true',
    focusable: 'false',
  });
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

    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
    cells = [];

    const cell = 10;
    const r = cell * 0.4;
    svgEl.setAttribute('viewBox', `0 0 ${cols * cell} ${rows * cell}`);

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

  let lastFill = '';
  let lastTrack = '';

  return {
    id: 'dots',
    supportsReadout: true,
    render(state: RenderState) {
      const plan = dotPlan(Math.round(state.totalMs / 1000));
      build(plan.count);

      const intervalMs = plan.intervalSeconds * 1000;
      const remainingDots = state.remainingMs / intervalMs;
      // Guard against floating point leaving a hairline dot lit at exactly zero.
      const litCount = Math.max(0, Math.min(plan.count, Math.ceil(remainingDots - 1e-9)));
      const firstLit = plan.count - litCount;
      const partial = litCount > 0 ? remainingDots - (litCount - 1) : 0;

      const fill = activeFill(state);
      const track = state.colors.track;
      const changedColours = fill !== lastFill || track !== lastTrack;
      lastFill = fill;
      lastTrack = track;

      // The non-colour channel for the warning state: the dots swell slightly.
      const grow = 1 + 0.08 * state.warningMix;

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

      if (changedColours) svgEl.style.color = activeNumeral(state);
    },
    destroy() {
      observer?.disconnect();
      svgEl.remove();
    },
  };
}
