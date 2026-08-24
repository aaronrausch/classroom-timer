import { activeFill, activeNumeral, depletionFraction } from './types';
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

      const colour = activeFill(state);
      if (colour !== lastFill) {
        fill.style.background = colour;
        lastFill = colour;
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
