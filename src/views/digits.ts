import { activeFill, activeNumeral, formatClock, setAttrs, svg } from './types';
import type { RenderState, Visualization } from './types';

/** Exposed for the same reason `CircleVisualization.setTicks` is: a setting
 * flip should update in place, not recreate the SVG (see `setShowTenths`). */
export interface DigitsVisualization extends Visualization {
  setShowTenths(value: boolean): void;
}

/**
 * The full-screen numeric countdown (SPEC §5.3D).
 *
 * The deliberate exception to icons-not-words. Numerals are not prose; they are
 * the most compact possible encoding of an exact quantity, and there are
 * classroom situations — timed assessments, exam conditions, short sharp tasks
 * — where exactness is the requirement and felt duration is not.
 *
 * Two mechanics carry the "must not reflow, must not jump" requirements:
 *
 * 1. **Fixed character cells.** Every glyph is a `<tspan>` at a precomputed x,
 *    centred in its own cell. Layout therefore cannot depend on font metrics,
 *    and a `1` occupies exactly what an `8` does even if the chosen font has no
 *    tabular figures at all.
 * 2. **A reserved viewBox.** The box is sized for the longest string this run
 *    will produce, not the current one, so 10:00 → 9:59 does not resize the
 *    display. The SVG then scales that box to the viewport, which is how the
 *    digits get as large as the screen allows on any projector resolution.
 */

/** Cell width as a fraction of font size — wider than any digit advance in a sane face. */
const CELL_RATIO = 0.62;
const FONT_SIZE = 100;
const CELL = FONT_SIZE * CELL_RATIO;
const BASELINE = 78;

/*
 * The viewBox hugs the *numerals*, not the font's line box.
 *
 * A line box includes ascent and descent for letters that never appear here,
 * which on a full-screen countdown means a third of the display given over to
 * empty space above and below the digits. Cap height for lining figures is
 * close to 0.71em in every UI face worth shipping to, so the box is built from
 * that plus a small margin, and the digits then genuinely fill the wall.
 */
const CAP_HEIGHT = FONT_SIZE * 0.71;
const CAP_PAD = FONT_SIZE * 0.05;
const BOX_TOP = BASELINE - CAP_HEIGHT - CAP_PAD;
const BOX_HEIGHT = CAP_HEIGHT + CAP_PAD * 2;

function viewBoxFor(cellCount: number): string {
  return `0 ${BOX_TOP} ${cellCount * CELL} ${BOX_HEIGHT}`;
}

export function createDigits(root: HTMLElement, initialShowTenths = false): DigitsVisualization {
  let showTenths = initialShowTenths;
  const wrapper = document.createElement('div');
  wrapper.className = 'viz viz-digits';
  wrapper.setAttribute('aria-hidden', 'true');

  const svgEl = svg('svg', {
    viewBox: viewBoxFor(4),
    preserveAspectRatio: 'xMidYMid meet',
    class: 'viz-digits-svg',
    focusable: 'false',
  });
  const text = svg('text', {
    y: BASELINE,
    'font-size': FONT_SIZE,
    'text-anchor': 'middle',
    'font-variant-numeric': 'tabular-nums',
  });
  svgEl.append(text);

  // The subordinate proportion cue: a thin line along the bottom edge, so the
  // mode still says *roughly how much is left* and not only the exact number.
  const proportion = document.createElement('div');
  proportion.className = 'viz-digits-proportion';
  const proportionFill = document.createElement('div');
  proportionFill.className = 'viz-digits-proportion-fill';
  proportion.append(proportionFill);

  wrapper.append(svgEl, proportion);
  root.append(wrapper);

  let spans: SVGTSpanElement[] = [];
  let builtLength = -1;
  let lastString = '';
  let lastColour = '';
  let lastFraction = -1;
  let lastMix = -1;

  function buildCells(length: number): void {
    if (length === builtLength) return;
    builtLength = length;
    while (text.firstChild) text.removeChild(text.firstChild);
    spans = [];
    for (let i = 0; i < length; i += 1) {
      const span = svg('tspan', { x: i * CELL + CELL / 2 });
      text.append(span);
      spans.push(span);
    }
    svgEl.setAttribute('viewBox', viewBoxFor(length));
  }

  return {
    id: 'digits',
    // A numeric overlay on top of numerals would be redundant; the toggle is
    // hidden for this mode rather than silently ignored (SPEC §5.4).
    supportsReadout: false,
    setShowTenths(value: boolean) {
      showTenths = value;
    },
    render(state: RenderState) {
      // Under a minute, seconds only, at greater size still. The step up in
      // size lands on the same moment as the warning cross-fade, and a decisive
      // change at exactly one minute left is useful information for the room.
      const secondsOnly = state.totalMs < 60_000 || state.remainingMs < 60_000;
      const tenths = showTenths && state.remainingMs < 10_000;

      const value = tenths
        ? formatClock(state.remainingMs, true)
        : secondsOnly
          ? String(Math.ceil(Math.max(0, state.remainingMs) / 1000))
          : formatClock(state.remainingMs);

      // Reserve for the longest string this configuration can produce, so the
      // display never resizes between two consecutive seconds.
      const reserved = secondsOnly
        ? (tenths ? 3 : Math.max(2, value.length))
        : formatClock(state.totalMs).length;

      buildCells(Math.max(reserved, value.length));

      if (value !== lastString) {
        const padded = value.padStart(builtLength, ' ');
        for (let i = 0; i < spans.length; i += 1) {
          const char = padded[i] ?? ' ';
          if (spans[i].textContent !== char) spans[i].textContent = char;
        }
        lastString = value;
      }

      const colour = activeNumeral(state);
      if (colour !== lastColour) {
        text.setAttribute('fill', colour);
        proportionFill.style.background = activeFill(state);
        lastColour = colour;
      }

      // The non-colour channel for the warning state: the numerals gain weight.
      if (state.warningMix !== lastMix) {
        text.setAttribute('font-weight', String(Math.round(600 + 300 * state.warningMix)));
        lastMix = state.warningMix;
      }

      const fraction = state.reducedMotion
        ? Math.min(1, Math.ceil(state.remainingMs / 1000) * 1000 / Math.max(1, state.totalMs))
        : state.fraction;
      if (fraction !== lastFraction) {
        proportionFill.style.transform = `scaleX(${fraction})`;
        lastFraction = fraction;
      }

      setAttrs(svgEl, { role: 'presentation' });
    },
    destroy() {
      wrapper.remove();
    },
  };
}
