import {
  addPreset,
  movePreset,
  normalizeName,
  removePreset,
  sortPresets,
  updatePreset,
  VISUALIZATION_IDS,
} from '../core/presets';
import type { Preset, VisualizationId } from '../core/presets';
import { clampDurationSeconds, formatDuration, parseDurationInput } from '../core/timer';
import type { WarningThreshold } from '../core/timer';
import { dotIntervalLabel, dotPlan } from '../views/dots';
import { icon, iconButton } from './icons';
import { Modal, confirmDialog } from './modal';
import { paletteOptions } from './theme';
import type { PaletteColors } from './palettes';

export interface PresetDraft {
  id?: string;
  name: string;
  durationSeconds: number;
  visualization: VisualizationId;
  palette: string;
  readout: boolean;
  warning: WarningThreshold;
}

export interface PresetListCallbacks {
  /** One click, straight to a running full-screen timer (SPEC §4.2, §13.2). */
  onLaunch(preset: Preset): void;
  onPresetsChanged(presets: Preset[]): void;
  colorsFor(paletteId: string): PaletteColors;
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

const WARNING_OPTIONS: Array<{ label: string; value: WarningThreshold }> = [
  { label: 'No warning', value: { type: 'seconds', value: 0 } },
  { label: '10 seconds left', value: { type: 'seconds', value: 10 } },
  { label: '15 seconds left', value: { type: 'seconds', value: 15 } },
  { label: '30 seconds left', value: { type: 'seconds', value: 30 } },
  { label: '1 minute left', value: { type: 'seconds', value: 60 } },
  { label: '2 minutes left', value: { type: 'seconds', value: 120 } },
  { label: '5 minutes left', value: { type: 'seconds', value: 300 } },
  { label: 'Last 10%', value: { type: 'percent', value: 10 } },
  { label: 'Last 25%', value: { type: 'percent', value: 25 } },
];

/**
 * The preset library (SPEC §5.8).
 *
 * This is the feature that turns a utility into a daily tool — the difference
 * between "a timer" and "*this class's* timer". Everything here is sized for a
 * finger or a whiteboard stylus rather than a mouse (SPEC §7.3).
 */
export class PresetList {
  readonly element: HTMLElement;

  private readonly list: HTMLUListElement;
  private presets: Preset[] = [];
  private dragId: string | null = null;

  constructor(private readonly callbacks: PresetListCallbacks) {
    this.element = document.createElement('section');
    this.element.className = 'presets';
    this.element.setAttribute('aria-label', 'Saved timers');

    this.list = document.createElement('ul');
    this.list.className = 'preset-grid';
    this.element.append(this.list);
  }

  render(presets: readonly Preset[]): void {
    this.presets = sortPresets(presets);
    this.list.replaceChildren();

    for (const preset of this.presets) {
      this.list.append(this.tile(preset));
    }
  }

  private tile(preset: Preset): HTMLLIElement {
    const item = document.createElement('li');
    item.className = 'preset-tile';
    item.draggable = true;
    item.dataset['id'] = preset.id;

    const colors = this.callbacks.colorsFor(preset.palette);

    const launch = document.createElement('button');
    launch.type = 'button';
    launch.className = 'preset-launch';
    launch.style.setProperty('--preset-accent', colors.fill);

    const badge = document.createElement('span');
    badge.className = 'preset-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.append(icon(MODE_ICONS[preset.visualization], 22));

    // The one place text is unapologetically present: the teacher's own words.
    const name = document.createElement('span');
    name.className = 'preset-name';
    name.textContent = preset.name;

    const duration = document.createElement('span');
    duration.className = 'preset-duration';
    duration.textContent = formatDuration(preset.durationSeconds);

    launch.append(badge, name, duration);
    launch.setAttribute(
      'aria-label',
      `Start ${preset.name}, ${describeDuration(preset.durationSeconds)}, ${MODE_LABELS[preset.visualization]}`,
    );
    launch.addEventListener('click', () => this.callbacks.onLaunch(preset));

    const edit = iconButton({
      label: `Edit ${preset.name}`,
      name: 'edit',
      className: 'preset-edit',
      size: 20,
      onClick: () => this.openEditor(preset),
    });

    item.append(launch, edit);

    // Drag to reorder, with the keyboard alternative living in the editor so
    // the two paths cannot drift apart (SPEC §5.8).
    item.addEventListener('dragstart', (event) => {
      this.dragId = preset.id;
      item.classList.add('is-dragging');
      event.dataTransfer?.setData('text/plain', preset.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      this.dragId = null;
      item.classList.remove('is-dragging');
      this.list.querySelectorAll('.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
    });
    item.addEventListener('dragover', (event) => {
      if (!this.dragId || this.dragId === preset.id) return;
      event.preventDefault();
      item.classList.add('is-drop-target');
    });
    item.addEventListener('dragleave', () => item.classList.remove('is-drop-target'));
    item.addEventListener('drop', (event) => {
      event.preventDefault();
      item.classList.remove('is-drop-target');
      const sourceId = this.dragId ?? event.dataTransfer?.getData('text/plain');
      if (!sourceId || sourceId === preset.id) return;
      const target = this.presets.findIndex((candidate) => candidate.id === preset.id);
      this.commit(movePreset(this.presets, sourceId, target));
    });

    return item;
  }

  /** Open the editor on an existing preset, or on a draft of the current setup. */
  openEditor(source: Preset | PresetDraft): void {
    const isExisting = 'id' in source && typeof source.id === 'string' && this.has(source.id);
    const draft: PresetDraft = {
      id: isExisting ? (source.id as string) : undefined,
      name: source.name,
      durationSeconds: source.durationSeconds,
      visualization: source.visualization,
      palette: source.palette,
      readout: source.readout,
      warning: source.warning,
    };

    const modal = new Modal(isExisting ? 'Edit timer' : 'Save timer');
    const form = document.createElement('form');
    form.className = 'preset-form';
    form.addEventListener('submit', (event) => event.preventDefault());

    const hint = document.createElement('p');
    hint.className = 'field-hint';

    // ---------------------------------------------------------------- name
    const nameField = labelledField('Name', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'text-input';
      input.value = draft.name;
      input.maxLength = 48;
      input.autocomplete = 'off';
      input.addEventListener('input', () => {
        draft.name = input.value;
      });
      return input;
    });

    // ------------------------------------------------------------ duration
    const durationField = labelledField('Length', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.className = 'text-input';
      input.value = formatDuration(draft.durationSeconds);
      input.addEventListener('change', () => {
        const parsed = parseDurationInput(input.value);
        draft.durationSeconds = parsed ?? draft.durationSeconds;
        input.value = formatDuration(draft.durationSeconds);
        updateHint();
      });
      return input;
    });

    // ------------------------------------------------------- visualization
    const modeButtons = new Map<VisualizationId, HTMLButtonElement>();
    const modeField = labelledField('Display', () => {
      const group = document.createElement('div');
      group.className = 'chip-row';
      group.setAttribute('role', 'group');
      for (const id of VISUALIZATION_IDS) {
        const button = iconButton({
          label: MODE_LABELS[id],
          name: MODE_ICONS[id],
          className: 'chip',
          onClick: () => {
            draft.visualization = id;
            syncModes();
            updateHint();
          },
        });
        modeButtons.set(id, button);
        group.append(button);
      }
      return group;
    });

    // ------------------------------------------------------------- palette
    const paletteButtons = new Map<string, HTMLButtonElement>();
    const paletteField = labelledField('Colour', () => {
      const group = document.createElement('div');
      group.className = 'chip-row';
      group.setAttribute('role', 'group');
      for (const option of paletteOptions()) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip chip-swatch';
        button.setAttribute('aria-label', option.label);
        button.title = option.label;
        const colors = this.callbacks.colorsFor(option.id);
        button.style.setProperty('--swatch-fill', colors.fill);
        button.style.setProperty('--swatch-track', colors.track);
        button.addEventListener('click', () => {
          draft.palette = option.id;
          syncPalettes();
        });
        paletteButtons.set(option.id, button);
        group.append(button);
      }
      return group;
    });

    // ------------------------------------------------------------- readout
    const readoutButton = document.createElement('button');
    readoutButton.type = 'button';
    readoutButton.className = 'chip chip-wide';
    readoutButton.addEventListener('click', () => {
      draft.readout = !draft.readout;
      syncReadout();
    });
    const readoutField = labelledField('Numbers', () => readoutButton);

    // ------------------------------------------------------------- warning
    const warningSelect = document.createElement('select');
    warningSelect.className = 'select-input';
    for (const [index, option] of WARNING_OPTIONS.entries()) {
      const element = document.createElement('option');
      element.value = String(index);
      element.textContent = option.label;
      warningSelect.append(element);
    }
    warningSelect.value = String(warningOptionIndex(draft.warning));
    warningSelect.addEventListener('change', () => {
      draft.warning = WARNING_OPTIONS[Number(warningSelect.value)].value;
    });
    const warningField = labelledField('Warn at', () => warningSelect);

    form.append(nameField, durationField, modeField, paletteField, readoutField, warningField, hint);

    // ------------------------------------------------------------- actions
    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    if (isExisting) {
      // The keyboard-accessible reordering path.
      const reorder = document.createElement('div');
      reorder.className = 'reorder-group';
      reorder.append(
        iconButton({
          label: 'Move earlier',
          name: 'chevronUp',
          className: 'icon-button-quiet',
          onClick: () => {
            const index = this.presets.findIndex((preset) => preset.id === draft.id);
            this.commit(movePreset(this.presets, draft.id as string, index - 1));
          },
        }),
        iconButton({
          label: 'Move later',
          name: 'chevronDown',
          className: 'icon-button-quiet',
          onClick: () => {
            const index = this.presets.findIndex((preset) => preset.id === draft.id);
            this.commit(movePreset(this.presets, draft.id as string, index + 1));
          },
        }),
      );

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'button button-danger';
      remove.textContent = 'Delete';
      remove.addEventListener('click', async () => {
        const confirmed = await confirmDialog(`Delete “${draft.name}”?`, 'Delete');
        if (!confirmed) return;
        this.commit(removePreset(this.presets, draft.id as string));
        modal.close();
        modal.destroy();
      });

      actions.append(reorder, remove);
    }

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'button';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => {
      modal.close();
      modal.destroy();
    });

    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'button button-primary';
    save.textContent = 'Save';
    save.addEventListener('click', () => {
      const clean = {
        name: normalizeName(draft.name),
        durationSeconds: clampDurationSeconds(draft.durationSeconds),
        visualization: draft.visualization,
        palette: draft.palette,
        readout: draft.readout,
        warning: draft.warning,
      };
      this.commit(
        draft.id
          ? updatePreset(this.presets, draft.id, clean)
          : addPreset(this.presets, { ...clean }),
      );
      modal.close();
      modal.destroy();
    });

    actions.append(cancel, save);
    form.append(actions);
    modal.body.append(form);

    function syncModes(): void {
      for (const [id, button] of modeButtons) {
        const active = id === draft.visualization;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      }
      // A numeric overlay on the digits mode is meaningless, so the control is
      // removed rather than left to be pressed with no effect (SPEC §5.4).
      readoutField.hidden = draft.visualization === 'digits';
    }

    function syncPalettes(): void {
      for (const [id, button] of paletteButtons) {
        const active = id === draft.palette;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      }
    }

    function syncReadout(): void {
      readoutButton.classList.toggle('is-active', draft.readout);
      readoutButton.setAttribute('aria-pressed', String(draft.readout));
      readoutButton.replaceChildren(icon(draft.readout ? 'check' : 'close', 20));
      readoutButton.setAttribute('aria-label', draft.readout ? 'Numbers shown' : 'Numbers hidden');
      readoutButton.title = readoutButton.getAttribute('aria-label') as string;
    }

    function updateHint(): void {
      if (draft.visualization === 'dots') {
        const plan = dotPlan(draft.durationSeconds);
        hint.textContent = `${dotIntervalLabel(plan.intervalSeconds)} · ${plan.count} dots`;
        hint.hidden = false;
      } else {
        hint.hidden = true;
      }
    }

    syncModes();
    syncPalettes();
    syncReadout();
    updateHint();
    modal.show();
  }

  private has(id: string): boolean {
    return this.presets.some((preset) => preset.id === id);
  }

  private commit(presets: Preset[]): void {
    this.presets = sortPresets(presets);
    this.render(this.presets);
    this.callbacks.onPresetsChanged(this.presets);
  }
}

let fieldSequence = 0;

/**
 * A labelled row. Form controls get a real `<label for>`; rows of buttons get
 * a group with an accessible name instead, because a `<label>` wrapping four
 * buttons names none of them (SPEC §8).
 */
function labelledField(label: string, build: () => HTMLElement): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';
  const control = build();
  const isFormControl =
    control instanceof HTMLInputElement ||
    control instanceof HTMLSelectElement ||
    control instanceof HTMLTextAreaElement;

  const text = document.createElement(isFormControl ? 'label' : 'span');
  text.className = 'field-label';
  text.textContent = label;

  if (isFormControl) {
    const id = `field-${(fieldSequence += 1)}`;
    control.id = id;
    (text as HTMLLabelElement).htmlFor = id;
  } else {
    control.setAttribute('aria-label', label);
  }

  wrapper.append(text, control);
  return wrapper;
}

function warningOptionIndex(warning: WarningThreshold): number {
  const index = WARNING_OPTIONS.findIndex(
    (option) => option.value.type === warning.type && option.value.value === warning.value,
  );
  return index === -1 ? WARNING_OPTIONS.findIndex((option) => option.value.value === 60) : index;
}

function describeDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  if (rest > 0) parts.push(`${rest} second${rest === 1 ? '' : 's'}`);
  return parts.join(' ') || '0 seconds';
}
