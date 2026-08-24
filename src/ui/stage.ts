import type { VisualizationId } from '../core/presets';
import { createBar } from '../views/bar';
import { createCircle } from '../views/circle';
import type { CircleStyle, CircleTicks, CircleVisualization } from '../views/circle';
import { createDigits } from '../views/digits';
import { createDots } from '../views/dots';
import { Readout } from '../views/readout';
import type { RenderState, Visualization } from '../views/types';
import { icon } from './icons';

export interface StageOptions {
  circleStyle: CircleStyle;
  circleTicks: CircleTicks;
  showTenths: boolean;
}

/**
 * The wall. Everything a student sees from the back row lives here: the
 * visualization, the optional readout, the paused indicator and the completion
 * field. Nothing else may be added to it without a very good reason — this
 * surface is the product (SPEC §7.1).
 */
export class Stage {
  readonly element: HTMLElement;

  private readonly vizHost: HTMLElement;
  private readonly readout: Readout;
  private readonly nameLabel: HTMLElement;
  private readonly pausedIndicator: HTMLElement;
  private readonly finished: HTMLButtonElement;
  private readonly live: HTMLElement;
  private lastLabelText = '';

  private visualization: Visualization | null = null;
  private visualizationId: VisualizationId | null = null;
  private options: StageOptions;
  private lastAnnouncement = '';
  private onDismissFinished: (() => void) | null = null;

  constructor(options: StageOptions) {
    this.options = options;

    this.element = document.createElement('main');
    this.element.className = 'stage';

    this.vizHost = document.createElement('div');
    this.vizHost.className = 'stage-viz';

    this.readout = new Readout(this.vizHost);

    // Optional, off by default (SPEC §1.2 — text is justified here because a
    // teacher running back-to-back activities on one screen, or a student
    // walking in mid-lesson, may genuinely need to know *which* timer this
    // is, and the preset name is the only thing that says so). Deliberately
    // outside `vizHost` and never touched by the projector chrome fade below
    // — unlike the controls, this is not something to get out of the way of
    // the visualization; it is a small, permanent part of it.
    this.nameLabel = document.createElement('p');
    this.nameLabel.className = 'stage-name';
    this.nameLabel.hidden = true;

    // Persistent and unambiguous: a teacher who walked away must be able to
    // tell at a glance that time is not moving (SPEC §5.1).
    this.pausedIndicator = document.createElement('div');
    this.pausedIndicator.className = 'paused-indicator';
    this.pausedIndicator.setAttribute('aria-hidden', 'true');
    this.pausedIndicator.hidden = true;
    this.pausedIndicator.append(icon('pause', 96));

    // The completion state commits the whole screen and stays until dismissed.
    // It never auto-clears: a teacher facing the class needs to be able to turn
    // around and still see it (SPEC §5.6).
    this.finished = document.createElement('button');
    this.finished.type = 'button';
    this.finished.className = 'finished-field';
    this.finished.hidden = true;
    this.finished.setAttribute('aria-label', 'Time is up. Dismiss and reset.');
    this.finished.append(icon('check', 200));
    this.finished.addEventListener('click', () => this.onDismissFinished?.());

    // Polite, and only on state changes. Announcing every second would make
    // the tool unusable with a screen reader rather than accessible (SPEC §8).
    this.live = document.createElement('p');
    this.live.className = 'visually-hidden';
    this.live.setAttribute('role', 'status');
    this.live.setAttribute('aria-live', 'polite');

    this.element.append(this.vizHost, this.nameLabel, this.pausedIndicator, this.finished, this.live);
  }

  setDismissHandler(handler: () => void): void {
    this.onDismissFinished = handler;
  }

  setOptions(options: StageOptions): void {
    const ticksChanged = options.circleTicks !== this.options.circleTicks;
    const needsRecreate =
      options.circleStyle !== this.options.circleStyle || options.showTenths !== this.options.showTenths;
    this.options = options;

    if (needsRecreate && this.visualizationId) {
      const current = this.visualizationId;
      this.visualizationId = null;
      this.setVisualization(current);
      return;
    }

    // A tick-style change updates in place — see CircleVisualization.setTicks.
    // Recreating the whole circle for this (as every other option change
    // does) meant one frame painted a brand-new SVG at its default, full-ring
    // state before the next render() call corrected it: a visible flash,
    // worse than the decorative ticks it was meant to change.
    if (ticksChanged && this.visualizationId === 'circle' && this.visualization) {
      (this.visualization as CircleVisualization).setTicks(options.circleTicks);
    }
  }

  /** Swapping a visualization is a file swap, nothing more (SPEC §9.2). */
  setVisualization(id: VisualizationId): void {
    if (this.visualizationId === id) return;
    this.visualization?.destroy();
    this.visualizationId = id;
    this.vizHost.dataset['viz'] = id;
    switch (id) {
      case 'bar':
        this.visualization = createBar(this.vizHost);
        break;
      case 'dots':
        this.visualization = createDots(this.vizHost);
        break;
      case 'digits':
        this.visualization = createDigits(this.vizHost, this.options.showTenths);
        break;
      default:
        this.visualization = createCircle(
          this.vizHost,
          this.options.circleStyle,
          this.options.circleTicks,
        );
    }
  }

  get supportsReadout(): boolean {
    return this.visualization?.supportsReadout ?? false;
  }

  render(state: RenderState): void {
    if (this.nameLabel.hidden === state.showName) this.nameLabel.hidden = !state.showName;
    if (state.showName && state.name !== this.lastLabelText) {
      this.lastLabelText = state.name;
      this.nameLabel.textContent = state.name;
    }

    this.visualization?.render(state);
    const showReadout = state.readout && this.supportsReadout;
    this.readout.render(state, showReadout);
    // The layout reserves room for the readout rather than laying it over the
    // depletion boundary, which is the one edge the room is actually reading.
    const readoutFlag = showReadout ? 'on' : 'off';
    if (this.vizHost.dataset['readout'] !== readoutFlag) this.vizHost.dataset['readout'] = readoutFlag;

    const paused = state.state === 'paused';
    if (this.pausedIndicator.hidden === paused) this.pausedIndicator.hidden = !paused;

    const finished = state.state === 'finished';
    if (this.finished.hidden === finished) {
      this.finished.hidden = !finished;
      if (finished) {
        this.finished.style.background = state.colors.finishedBg;
        this.finished.style.color = state.colors.finishedFg;
        // One bounded settle, then static. Nothing here loops, and nothing
        // here flashes (SPEC §5.6, §8).
        this.finished.classList.remove('is-settling');
        void this.finished.offsetWidth;
        if (!state.reducedMotion) this.finished.classList.add('is-settling');
        this.finished.focus({ preventScroll: true });
      }
    }
  }

  announce(message: string): void {
    if (message === this.lastAnnouncement) return;
    this.lastAnnouncement = message;
    this.live.textContent = message;
  }
}
