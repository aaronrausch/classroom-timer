import { activeNumeral, formatClock } from './types';
import type { RenderState } from './types';

/**
 * The optional numeric overlay for the three graphical modes (SPEC §5.4).
 *
 * Distinct from the Digits *mode*: this is for the teacher who wants the felt
 * sense of depletion and the exact number at once. Two constraints keep it from
 * quietly becoming Digits with decoration:
 *
 * - It is clearly subordinate in size. If it competed with the visualization,
 *   the teacher should simply have picked Digits.
 * - It is positioned away from the depletion boundary of whichever mode is
 *   showing — the centre of the ring, above the bar, below the dot grid — so it
 *   never sits on the one edge the room is actually reading.
 */
export class Readout {
  private readonly element: HTMLElement;
  private lastText = '';
  private lastColour = '';

  constructor(root: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'readout';
    this.element.setAttribute('aria-hidden', 'true');
    this.element.hidden = true;
    root.append(this.element);
  }

  render(state: RenderState, visible: boolean): void {
    if (!visible) {
      if (!this.element.hidden) this.element.hidden = true;
      return;
    }
    if (this.element.hidden) this.element.hidden = false;

    const text = formatClock(state.remainingMs);
    if (text !== this.lastText) {
      this.element.textContent = text;
      this.lastText = text;
    }
    const colour = activeNumeral(state);
    if (colour !== this.lastColour) {
      this.element.style.color = colour;
      this.lastColour = colour;
    }
  }

  destroy(): void {
    this.element.remove();
  }
}
