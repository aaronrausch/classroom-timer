import {
  addPreset,
  createId,
  movePreset,
  normalizeName,
  removePreset,
  sortPresets,
  updatePreset,
} from '../core/presets';
import type { Preset, VisualizationId } from '../core/presets';
import { clampDurationSeconds, formatDuration } from '../core/timer';
import type { WarningThreshold } from '../core/timer';
import { icon, iconButton } from './icons';
import { confirmDialog } from './modal';
import type { PaletteColors } from './palettes';

export interface PresetDraft {
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
  /** Load a saved timer into the sidebar's Current Timer panel for live editing. */
  onEdit(preset: Preset): void;
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

/**
 * The preset library (SPEC §5.8).
 *
 * This is the feature that turns a utility into a daily tool — the difference
 * between "a timer" and "*this class's* timer". Everything here is sized for a
 * finger or a whiteboard stylus rather than a mouse (SPEC §7.3).
 *
 * Editing is not a form in a modal disconnected from the stage: the pencil on
 * a tile loads that preset into the sidebar's always-visible Current Timer
 * panel (`Sidebar`), where every change is reflected live on the stage as it
 * is made. This class owns only the tiles and the pure array operations
 * (`saveAsNew`, `updateExisting`, `deleteById`, `moveById`) that the panel's
 * actions call into — see `docs/adr/0006-live-preset-editing.md`.
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

  /** Add a new preset from a draft, at the end of the order. Returns it (with its generated id). */
  saveAsNew(draft: PresetDraft): Preset {
    const id = createId();
    const clean = { id, ...sanitizedDraft(draft) };
    this.commit(addPreset(this.presets, clean));
    return this.presets.find((preset) => preset.id === id) as Preset;
  }

  /** Overwrite an existing preset's stored fields with a draft's values. */
  updateExisting(id: string, draft: PresetDraft): void {
    this.commit(updatePreset(this.presets, id, sanitizedDraft(draft)));
  }

  /** Delete after confirmation (SPEC §5.8). Resolves false if cancelled or not found. */
  async deleteById(id: string): Promise<boolean> {
    const preset = this.presets.find((candidate) => candidate.id === id);
    if (!preset) return false;
    const confirmed = await confirmDialog(`Delete "${preset.name}"?`, 'Delete');
    if (!confirmed) return false;
    this.commit(removePreset(this.presets, id));
    return true;
  }

  /** The keyboard-accessible alternative to drag-and-drop reordering (SPEC §5.8). */
  moveById(id: string, direction: 1 | -1): void {
    const index = this.presets.findIndex((preset) => preset.id === id);
    if (index === -1) return;
    this.commit(movePreset(this.presets, id, index + direction));
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
      onClick: () => this.callbacks.onEdit(preset),
    });

    item.append(launch, edit);

    // Drag to reorder; the keyboard-accessible alternative lives in the
    // Current Timer panel once a preset is loaded there (SPEC §5.8), so the
    // two paths share the same `moveById` and cannot drift apart.
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

  private commit(presets: Preset[]): void {
    this.presets = sortPresets(presets);
    this.render(this.presets);
    this.callbacks.onPresetsChanged(this.presets);
  }
}

function sanitizedDraft(draft: PresetDraft): Omit<PresetDraft, 'name' | 'durationSeconds'> & {
  name: string;
  durationSeconds: number;
} {
  return {
    name: normalizeName(draft.name),
    durationSeconds: clampDurationSeconds(draft.durationSeconds),
    visualization: draft.visualization,
    palette: draft.palette,
    readout: draft.readout,
    warning: draft.warning,
  };
}

function describeDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  if (rest > 0) parts.push(`${rest} second${rest === 1 ? '' : 's'}`);
  return parts.join(' ') || '0 seconds';
}
