import { activeFill, activeNumeral, depletionFraction, gradientStops } from './types';
import type { RenderState, Visualization } from './types';

/**
 * The most legible option at distance and on wide projectors with poor
 * contrast (SPEC §5.3B).
 *
 * It drains right to left: the filled portion is anchored at the left edge and
 * its boundary travels leftward, so the remaining quantity always sits where
 * reading begins.
 *
 * `scaleX` rather than `width`, because a transform is composited rather than
 * laid out — the difference between smooth depletion and a stuttering wall on
 * a five-year-old Chromebook (SPEC §11.3). It is also exact at both ends:
 * `scaleX(0)` occupies nothing at all, with no rounding sliver left behind.
 */
export function createBar(root: HTMLElement): Visualization {
  const wrapper = document.createElement('div');
  wrapper.className = 'viz viz-bar';
  wrapper.setAttribute('aria-hidden', 'true');

  const track = document.createElement('div');
  track.className = 'viz-bar-track';

  const fill = document.createElement('div');
  fill.className = 'viz-bar-fill';

  track.append(fill);
  wrapper.append(track);
  root.append(wrapper);

  let lastFraction = -1;
  let lastFill = '';
  let lastBgSize = '';
  let lastTrack = '';
  let lastMix = -1;

  return {
    id: 'bar',
    supportsReadout: true,
    render(state: RenderState) {
      const fraction = depletionFraction(state);
      if (fraction !== lastFraction) {
        fill.style.transform = `scaleX(${fraction})`;
        lastFraction = fraction;
      }

      const stops = gradientStops(state);
      if (stops) {
        const paint = `linear-gradient(90deg, ${stops.from}, ${stops.to})`;
        if (paint !== lastFill) {
          fill.style.backgroundColor = '';
          fill.style.backgroundImage = paint;
          lastFill = paint;
        }
        // `fill` is a "window" onto one gradient painted across the full bar
        // width, not a gradient of its own — it shrinks via scaleX, which
        // would otherwise squeeze that painting into whatever sliver is left.
        // Enlarging the background by 1/fraction as the box shrinks cancels
        // the squeeze out, so what shows through always matches the same
        // fixed point on the full-width sweep (per the gradient design: it
        // maps onto the whole view, not the shrinking element).
        const bgSize = `${(100 / Math.max(fraction, 0.001)).toFixed(2)}% 100%`;
        if (bgSize !== lastBgSize) {
          fill.style.backgroundSize = bgSize;
          fill.style.backgroundPosition = 'left';
          lastBgSize = bgSize;
        }
      } else {
        const colour = activeFill(state);
        if (colour !== lastFill) {
          fill.style.backgroundImage = '';
          fill.style.background = colour;
          lastFill = colour;
          lastBgSize = '';
        }
      }
      if (state.colors.track !== lastTrack) {
        track.style.background = state.colors.track;
        lastTrack = state.colors.track;
      }

      // The non-colour channel: the bar grows taller and stays there. Held, not
      // pulsed — a bar that throbs for the last minute is unbearable on a wall.
      if (state.warningMix !== lastMix) {
        track.style.setProperty('--bar-grow', String(state.warningMix));
        wrapper.style.color = activeNumeral(state);
        lastMix = state.warningMix;
      }
    },
    destroy() {
      wrapper.remove();
    },
  };
}
