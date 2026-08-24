import { formatDuration, parseDurationInput } from '../core/timer';
import type { TimerSnapshot } from '../core/timer';
import type { VisualizationId } from '../core/presets';
import { VISUALIZATION_IDS } from '../core/presets';
import { icon, iconButton, setButtonIcon } from './icons';
import { Modal } from './modal';

export interface ControlsCallbacks {
  onToggle(): void;
  onReset(): void;
  onAddTime(seconds: number): void;
  onSetDuration(seconds: number): void;
  onFullscreen(): void;
  onVisualization(id: VisualizationId): void;
  onToggleReadout(): void;
  onToggleTheme(): void;
  onToggleSidebar(): void;
  onEscape(): void;
}

export interface ControlsView {
  durationSeconds: number;
  visualization: VisualizationId;
  readout: boolean;
  isFullscreen: boolean;
  sidebarCollapsed: boolean;
}

const MODE_LABELS: Record<VisualizationId, string> = {
  circle: 'Circle',
  bar: 'Bar',
  dots: 'Dots',
  digits: 'Digits',
};

const MODE_ICONS: Record<VisualizationId, string> = {
  circle: 'vizCircle',
  bar: 'vizBar',
  dots: 'vizDots',
  digits: 'vizDigits',
};

/**
 * The control bar and the keyboard (SPEC §5.10).
 *
 * One row, centred as a whole beneath the stage. It holds only what a teacher
 * touches *during* a running transition — duration, transport, display, and
 * full screen. Saved timers and every setting live in the sidebar instead
 * (SPEC §5.8, §5.12), so this bar stays short enough to read as one gesture
 * rather than a wall of icons.
 *
 * Every control is an icon with a real accessible name and a hover tooltip.
 * Two placement rules from §7.3 are load-bearing rather than cosmetic: targets
 * are at least 48×48, and reset does not neighbour anything destructive. Small
 * text captions sit above the two grouped clusters — not because an icon is
 * unclear on its own, but because a *group* of five icons reads faster with a
 * three-letter label over it than by shape alone.
 */
export class Controls {
  readonly element: HTMLElement;

  private readonly toggleButton: HTMLButtonElement;
  private readonly resetButton: HTMLButtonElement;
  private readonly fullscreenButton: HTMLButtonElement;
  private readonly readoutButton: HTMLButtonElement;
  private readonly durationInput: HTMLInputElement;
  private readonly modeButtons = new Map<VisualizationId, HTMLButtonElement>();
  private readonly sidebarButton: HTMLButtonElement;
  private readonly callbacks: ControlsCallbacks;

  private state: TimerSnapshot | null = null;
  private view: ControlsView = {
    durationSeconds: 300,
    visualization: 'circle',
    readout: true,
    isFullscreen: false,
    sidebarCollapsed: false,
  };
  private editingDuration = false;
  private helpModal: Modal | null = null;

  // Last-rendered values, so `update()` can skip DOM writes for anything
  // that hasn't actually changed since the previous frame — see the doc
  // comment on `update()` itself for why this replaced a wall-clock throttle.
  private lastToggleState: TimerSnapshot['state'] | null = null;
  private lastFullscreen: boolean | null = null;
  private lastVisualization: VisualizationId | null = null;
  private lastReadout: boolean | null = null;
  private lastSupportsReadout: boolean | null = null;
  private lastSidebarCollapsed: boolean | null = null;

  constructor(callbacks: ControlsCallbacks) {
    this.callbacks = callbacks;

    this.element = document.createElement('section');
    this.element.className = 'controls';
    this.element.setAttribute('aria-label', 'Timer controls');

    const bar = document.createElement('div');
    bar.className = 'controls-bar';

    // ------------------------------------------------------------- duration
    const durationGroup = labelledGroup('Duration', 'controls-duration');
    const minusFive = iconButtonWithBadge('minus', '5m', 'Subtract five minutes', () =>
      this.callbacks.onAddTime(-300),
    );
    const minusOne = iconButtonWithBadge('minus', '1m', 'Subtract one minute', () =>
      this.callbacks.onAddTime(-60),
    );
    const plusOne = iconButtonWithBadge('plus', '1m', 'Add one minute', () =>
      this.callbacks.onAddTime(60),
    );
    const plusFive = iconButtonWithBadge('plus', '5m', 'Add five minutes', () =>
      this.callbacks.onAddTime(300),
    );

    this.durationInput = document.createElement('input');
    this.durationInput.type = 'text';
    this.durationInput.inputMode = 'numeric';
    this.durationInput.className = 'duration-input';
    this.durationInput.setAttribute('aria-label', 'Duration, minutes and seconds');
    this.durationInput.value = formatDuration(this.view.durationSeconds);
    this.durationInput.addEventListener('focus', () => {
      this.editingDuration = true;
      this.durationInput.select();
    });
    this.durationInput.addEventListener('blur', () => {
      this.editingDuration = false;
      this.commitDuration();
    });
    this.durationInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.durationInput.blur();
      }
    });

    durationGroup.row.append(minusFive, minusOne, this.durationInput, plusOne, plusFive);

    // ------------------------------------------------------------- transport
    const transportGroup = labelledGroup('Run', 'controls-transport');

    this.resetButton = iconButton({
      label: 'Reset',
      name: 'reset',
      className: 'icon-button-large',
      size: 30,
      onClick: () => this.callbacks.onReset(),
    });

    this.toggleButton = iconButton({
      label: 'Start',
      name: 'play',
      className: 'icon-button-primary',
      size: 44,
      onClick: () => this.callbacks.onToggle(),
    });

    this.fullscreenButton = iconButton({
      label: 'Full screen',
      name: 'expand',
      className: 'icon-button-large',
      size: 30,
      onClick: () => this.callbacks.onFullscreen(),
    });

    // Deliberate gap around Start: reset sits left of it, not touching, so a
    // hurried tap cannot land on reset by mistake (SPEC §7.3).
    transportGroup.row.append(this.resetButton, this.toggleButton, this.fullscreenButton);

    // ----------------------------------------------------------------- modes
    const displayGroup = labelledGroup('Display', 'controls-modes');
    displayGroup.row.setAttribute('role', 'group');
    displayGroup.row.setAttribute('aria-label', 'Visualization');

    for (const id of VISUALIZATION_IDS) {
      const button = iconButton({
        label: MODE_LABELS[id],
        name: MODE_ICONS[id],
        className: 'icon-button-mode',
        onClick: () => this.callbacks.onVisualization(id),
      });
      button.setAttribute('aria-pressed', 'false');
      this.modeButtons.set(id, button);
      displayGroup.row.append(button);
    }

    this.readoutButton = iconButton({
      label: 'Show numbers',
      name: 'readoutNumbers',
      // A distinct sub-group, not a fifth mode: this toggles an overlay on
      // top of whichever mode is active, rather than selecting one. The
      // divider (and its own icon, above) is what stops it from reading as a
      // duplicate of the Digits mode button beside it.
      className: 'icon-button-mode controls-readout-toggle',
      onClick: () => this.callbacks.onToggleReadout(),
    });
    this.readoutButton.setAttribute('aria-pressed', 'true');
    displayGroup.row.append(this.readoutButton);

    // -------------------------------------------------------------- utility
    this.sidebarButton = iconButton({
      label: 'Hide saved timers and settings',
      name: 'sidebar',
      className: 'icon-button-mode',
      onClick: () => this.callbacks.onToggleSidebar(),
    });

    const help = iconButton({
      label: 'Keyboard shortcuts',
      name: 'keyboard',
      className: 'icon-button-mode',
      onClick: () => this.showHelp(),
    });

    const utilityGroup = labelledGroup('More', 'controls-utility');
    utilityGroup.row.append(this.sidebarButton, help);

    bar.append(
      durationGroup.element,
      divider(),
      transportGroup.element,
      divider(),
      displayGroup.element,
      divider(),
      utilityGroup.element,
    );
    this.element.append(bar);
  }

  /**
   * Called every animation frame — not throttled. It used to run on a 200ms
   * wall-clock gate to limit DOM churn, but that meant the play/pause icon,
   * the duration readout, and everything else here could lag up to 200ms
   * behind the state it is supposed to reflect: a state change or a click
   * could sit unacknowledged for a fifth of a second, which read as the
   * controls "jumping" or "glitching". Calling this every frame instead and
   * diffing against the last-rendered value (below) costs nothing when
   * nothing changed, and costs a handful of attribute writes on the frame
   * something did.
   */
  update(state: TimerSnapshot, view: ControlsView, supportsReadout: boolean): void {
    this.state = state;
    this.view = view;

    if (state.state !== this.lastToggleState) {
      this.lastToggleState = state.state;
      switch (state.state) {
        case 'running':
          setButtonIcon(this.toggleButton, 'pause', 'Pause', 44);
          break;
        case 'paused':
          setButtonIcon(this.toggleButton, 'play', 'Resume', 44);
          break;
        case 'finished':
          setButtonIcon(this.toggleButton, 'reset', 'Start again', 44);
          break;
        default:
          setButtonIcon(this.toggleButton, 'play', 'Start', 44);
      }
      this.durationInput.readOnly = state.state !== 'idle';
    }

    if (view.isFullscreen !== this.lastFullscreen) {
      this.lastFullscreen = view.isFullscreen;
      setButtonIcon(
        this.fullscreenButton,
        view.isFullscreen ? 'collapse' : 'expand',
        view.isFullscreen ? 'Leave full screen' : 'Full screen',
        30,
      );
    }

    if (!this.editingDuration) {
      const shown = state.state === 'idle' ? view.durationSeconds : Math.ceil(state.remainingMs / 1000);
      const text = formatDuration(shown);
      // formatDuration is cheap; the DOM write it guards is what matters, and
      // this check already skips it when the second hasn't changed.
      if (this.durationInput.value !== text) this.durationInput.value = text;
    }

    if (view.visualization !== this.lastVisualization) {
      this.lastVisualization = view.visualization;
      for (const [id, button] of this.modeButtons) {
        button.setAttribute('aria-pressed', String(id === view.visualization));
        button.classList.toggle('is-active', id === view.visualization);
      }
    }

    // Hidden rather than silently ignored where it does not apply (SPEC §5.4).
    if (view.readout !== this.lastReadout || supportsReadout !== this.lastSupportsReadout) {
      this.lastReadout = view.readout;
      this.lastSupportsReadout = supportsReadout;
      this.readoutButton.hidden = !supportsReadout;
      this.readoutButton.setAttribute('aria-pressed', String(view.readout));
      this.readoutButton.classList.toggle('is-active', view.readout);
      this.readoutButton.title = view.readout ? 'Hide numbers' : 'Show numbers';
      this.readoutButton.setAttribute('aria-label', this.readoutButton.title);
    }

    if (view.sidebarCollapsed !== this.lastSidebarCollapsed) {
      this.lastSidebarCollapsed = view.sidebarCollapsed;
      this.sidebarButton.setAttribute('aria-pressed', String(!view.sidebarCollapsed));
      this.sidebarButton.classList.toggle('is-active', !view.sidebarCollapsed);
      this.sidebarButton.title = view.sidebarCollapsed
        ? 'Show saved timers and settings'
        : 'Hide saved timers and settings';
      this.sidebarButton.setAttribute('aria-label', this.sidebarButton.title);
    }
  }

  /** ↑ / ↓ adjust duration when idle, in whole minutes above a minute. */
  nudgeDuration(direction: 1 | -1): void {
    if (this.state && this.state.state !== 'idle') return;
    const current = this.view.durationSeconds;
    const step = current >= 60 ? 60 : 15;
    this.callbacks.onSetDuration(current + direction * step);
  }

  private commitDuration(): void {
    const parsed = parseDurationInput(this.durationInput.value);
    if (parsed === null) {
      // Unreadable input leaves the configuration alone rather than guessing.
      this.durationInput.value = formatDuration(this.view.durationSeconds);
      return;
    }
    this.callbacks.onSetDuration(parsed);
  }

  showHelp(): void {
    if (!this.helpModal) {
      this.helpModal = new Modal('Keyboard shortcuts');
      const list = document.createElement('dl');
      list.className = 'shortcut-list';
      const shortcuts: Array<[string, string]> = [
        ['Space', 'Start, pause, resume'],
        ['R', 'Reset'],
        ['F', 'Full screen'],
        ['Esc', 'Leave full screen'],
        ['T', 'Show or hide the numbers'],
        ['D', 'Light or dark'],
        ['1 2 3 4', 'Circle, bar, dots, digits'],
        ['↑ ↓', 'Adjust the duration'],
      ];
      for (const [key, description] of shortcuts) {
        const term = document.createElement('dt');
        for (const part of key.split(' ')) {
          const kbd = document.createElement('kbd');
          kbd.textContent = part;
          term.append(kbd);
        }
        const definition = document.createElement('dd');
        definition.textContent = description;
        list.append(term, definition);
      }
      this.helpModal.body.append(list);
    }
    this.helpModal.show();
  }

  /**
   * Shortcuts are suppressed while a text field has focus (SPEC §5.10) — a
   * teacher typing "Silent reading" must not toggle four visualizations and
   * start the timer on the way through.
   */
  bindKeyboard(): void {
    document.addEventListener('keydown', (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true;

      if (event.key === 'Escape') {
        if (!typing) this.callbacks.onEscape();
        return;
      }
      if (typing) return;

      const modalOpen = document.querySelector('dialog[open]') !== null;
      if (modalOpen) return;

      switch (event.key) {
        case ' ':
        case 'Spacebar': {
          // Leave Space alone when a button has focus, or it would fire the
          // focused control and the transport toggle at the same time.
          if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return;
          event.preventDefault();
          this.callbacks.onToggle();
          return;
        }
        case 'r':
        case 'R':
          this.callbacks.onReset();
          return;
        case 'f':
        case 'F':
          this.callbacks.onFullscreen();
          return;
        case 't':
        case 'T':
          this.callbacks.onToggleReadout();
          return;
        case 'd':
        case 'D':
          this.callbacks.onToggleTheme();
          return;
        case '1':
        case '2':
        case '3':
        case '4': {
          const id = VISUALIZATION_IDS[Number(event.key) - 1];
          if (id) this.callbacks.onVisualization(id);
          return;
        }
        case 'ArrowUp':
          event.preventDefault();
          this.nudgeDuration(1);
          return;
        case 'ArrowDown':
          event.preventDefault();
          this.nudgeDuration(-1);
          return;
        default:
      }
    });
  }
}

interface LabelledGroup {
  element: HTMLElement;
  row: HTMLElement;
}

/**
 * A named cluster of controls: a small caption over a row of icon buttons.
 * The caption is not there because any one icon is ambiguous — it is there so
 * a group of several reads as one decision ("Display") rather than an
 * undifferentiated strip, which is what actually made the bar feel cluttered.
 */
function labelledGroup(label: string, rowClassName: string): LabelledGroup {
  const element = document.createElement('div');
  element.className = 'controls-group';

  const caption = document.createElement('span');
  caption.className = 'controls-group-label';
  caption.textContent = label;

  const row = document.createElement('div');
  row.className = `controls-group-row ${rowClassName}`;

  element.append(caption, row);
  return { element, row };
}

function divider(): HTMLElement {
  const element = document.createElement('div');
  element.className = 'controls-divider';
  element.setAttribute('aria-hidden', 'true');
  return element;
}

function iconButtonWithBadge(
  name: string,
  badge: string,
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-button icon-button-step';
  button.setAttribute('aria-label', label);
  button.title = label;
  const span = document.createElement('span');
  span.className = 'step-badge';
  span.setAttribute('aria-hidden', 'true');
  span.textContent = badge;
  button.append(icon(name, 20), span);
  button.addEventListener('click', onClick);
  return button;
}
