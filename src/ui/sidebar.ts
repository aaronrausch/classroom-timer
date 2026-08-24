import { CHIMES } from '../core/audio';
import type { AppData, Settings, ThemeChoice } from '../core/presets';
import { SCHEMA_VERSION, sanitizeAppData, serializeAppData } from '../core/storage';
import type { WarningThreshold } from '../core/timer';
import { icon, iconButton } from './icons';
import type { PaletteColors } from './palettes';
import type { PresetList } from './presetList';
import { paletteOptions } from './theme';

/** Nought, one and two arcs: gentle, neutral, assertive. */
const CHIME_ICONS: Record<string, string> = {
  gentle: 'soundLow',
  neutral: 'soundMed',
  assertive: 'soundHigh',
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
 * The three preset fields that had no live home before this panel existed —
 * duration, visualization and the numeric readout are already live-editable
 * from the main toolbar, so they are deliberately *not* duplicated here; a
 * second place to change the same value would only invite the two going out
 * of sync. Name, colour and warning threshold had no such home, which is
 * exactly why editing a preset used to mean a disconnected modal form.
 */
export interface CurrentTimerFields {
  name: string;
  palette: string;
  warning: WarningThreshold;
}

export interface SidebarCallbacks {
  onSettingsChange(settings: Settings): void;
  onPreviewChime(soundId: string): void;
  onImport(data: AppData): void;
  onCollapse(): void;
  getData(): AppData;
  colorsFor(paletteId: string): PaletteColors;
  /** Set when persistence is not working, so it can be said once, quietly. */
  storageNotice(): string | null;

  // ------------------------------------------------------- current timer
  getCurrentTimer(): CurrentTimerFields;
  onCurrentTimerChange(patch: Partial<CurrentTimerFields>): void;
  /** The id of the saved preset currently loaded for editing, or null for an unsaved, ad-hoc timer. */
  getLoadedPresetId(): string | null;
  onSaveAsNew(): void;
  onUpdateLoaded(): void;
  /** Returns once the delete flow (including the confirm dialog) has settled. */
  onDeleteLoaded(): Promise<void>;
  onMoveLoaded(direction: 1 | -1): void;
  /** Reset to a blank, unsaved timer. */
  onStartFresh(): void;
}

/**
 * The sidebar: the current timer, saved timers, and every setting, in one
 * collapsible panel (SPEC §5.8, §5.12).
 *
 * The Current Timer section is what makes editing *live*: it is not a form
 * that commits on save, it is the actual configuration driving the stage,
 * with three fields wired directly to it (see `CurrentTimerFields`). Loading
 * a saved preset here (the pencil on a tile) or launching one (SPEC §4.2)
 * both populate it; the only difference is whether the timer also starts.
 * See `docs/adr/0006-live-preset-editing.md`.
 *
 * This is also the one place in the app that trades the icons-not-words
 * principle (§1.2) for a few words of section heading. That principle is
 * about the *stage* — what a student reads from the back of the room — and
 * none of this panel is ever visible to a student; it is the teacher's own
 * setup surface, open only before or between activities.
 */
export class Sidebar {
  readonly element: HTMLElement;

  private readonly body: HTMLElement;
  private readonly notice: HTMLElement;
  private readonly privacy: HTMLElement;
  private soundSectionRefresh: (() => void) | null = null;

  private nameInput!: HTMLInputElement;
  private paletteButtons = new Map<string, HTMLButtonElement>();
  private warningSelect!: HTMLSelectElement;
  private actionsContainer!: HTMLElement;

  constructor(
    private readonly presetList: PresetList,
    private readonly callbacks: SidebarCallbacks,
  ) {
    this.element = document.createElement('aside');
    this.element.className = 'sidebar';
    this.element.setAttribute('aria-label', 'Saved timers and settings');

    const header = document.createElement('div');
    header.className = 'sidebar-header';
    const title = document.createElement('h2');
    title.className = 'sidebar-title';
    title.textContent = 'Classroom Timer';
    // A right-pointing chevron, matching the sidebar's position on the right
    // edge of the screen — it points the direction the panel collapses to.
    const collapse = iconButton({
      label: 'Hide sidebar',
      name: 'forward',
      className: 'icon-button-quiet sidebar-collapse',
      size: 20,
      onClick: () => this.callbacks.onCollapse(),
    });
    header.append(title, collapse);

    const bodyCell = document.createElement('div');
    bodyCell.className = 'sidebar-body-cell';

    this.body = document.createElement('div');
    this.body.className = 'sidebar-body';
    bodyCell.append(this.body);

    const presetsSection = document.createElement('section');
    presetsSection.className = 'sidebar-section';
    presetsSection.append(sectionHeading('Saved timers'), this.presetList.element);

    this.notice = document.createElement('p');
    this.notice.className = 'settings-notice';
    this.notice.hidden = true;

    this.privacy = document.createElement('p');
    this.privacy.className = 'settings-privacy';
    this.privacy.textContent =
      'This timer sends nothing anywhere. No accounts, no analytics, no network. Your timers are stored only in this browser.';

    this.body.append(
      this.buildCurrentTimerSection(),
      presetsSection,
      this.buildAppearanceSection(),
      this.buildSoundSection(),
      this.buildDisplaySection(),
      this.buildDataSection(),
      this.notice,
      this.privacy,
    );

    this.element.append(header, bodyCell);
    this.refreshCurrentTimer();
  }

  /** Called whenever the underlying settings, presets, or current timer may have changed. */
  refresh(): void {
    const notice = this.callbacks.storageNotice();
    this.notice.hidden = !notice;
    this.notice.textContent = notice ?? '';
    this.soundSectionRefresh?.();
    this.refreshCurrentTimer();
  }

  // ------------------------------------------------------ current timer

  private buildCurrentTimerSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'sidebar-section';

    const heading = sectionHeading('Current timer');
    const startFresh = iconButton({
      label: 'Start a new timer',
      name: 'plus',
      className: 'icon-button-quiet',
      size: 18,
      onClick: () => this.callbacks.onStartFresh(),
    });
    heading.append(startFresh);

    const nameField = labelledField('Name', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'text-input';
      input.maxLength = 48;
      input.autocomplete = 'off';
      input.addEventListener('input', () => {
        this.callbacks.onCurrentTimerChange({ name: input.value });
      });
      this.nameInput = input;
      return input;
    });

    const paletteField = labelledField('Colour', () => {
      const group = document.createElement('div');
      group.className = 'chip-row';
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
          this.callbacks.onCurrentTimerChange({ palette: option.id });
          this.syncPaletteButtons();
        });
        this.paletteButtons.set(option.id, button);
        group.append(button);
      }
      return group;
    });

    const warningField = labelledField('Warn at', () => {
      const select = document.createElement('select');
      select.className = 'select-input';
      for (const [index, option] of WARNING_OPTIONS.entries()) {
        const element = document.createElement('option');
        element.value = String(index);
        element.textContent = option.label;
        select.append(element);
      }
      select.addEventListener('change', () => {
        this.callbacks.onCurrentTimerChange({ warning: WARNING_OPTIONS[Number(select.value)].value });
      });
      this.warningSelect = select;
      return select;
    });

    this.actionsContainer = document.createElement('div');
    this.actionsContainer.className = 'current-timer-actions';

    section.append(heading, nameField, paletteField, warningField, this.actionsContainer);
    return section;
  }

  private refreshCurrentTimer(): void {
    if (!this.nameInput) return; // Called once from the constructor before fields exist.

    const current = this.callbacks.getCurrentTimer();
    // Never clobber a name mid-keystroke (the same guard the duration input
    // uses in Controls) — this can be called from a settings refresh that has
    // nothing to do with what the teacher is currently typing.
    if (document.activeElement !== this.nameInput && this.nameInput.value !== current.name) {
      this.nameInput.value = current.name;
    }
    this.syncPaletteButtons();
    const warningIndex = warningOptionIndex(current.warning);
    if (this.warningSelect.value !== String(warningIndex)) {
      this.warningSelect.value = String(warningIndex);
    }

    this.renderActions();
  }

  private syncPaletteButtons(): void {
    const current = this.callbacks.getCurrentTimer().palette;
    for (const [id, button] of this.paletteButtons) {
      const active = id === current;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }

  private renderActions(): void {
    const loadedId = this.callbacks.getLoadedPresetId();
    this.actionsContainer.replaceChildren();

    if (loadedId === null) {
      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'button button-primary';
      save.textContent = 'Save as timer';
      save.addEventListener('click', () => this.callbacks.onSaveAsNew());
      this.actionsContainer.append(save);
      return;
    }

    // Reuses the modal action-row styling — the layout (wrap, gap, spacing)
    // is what's wanted here too, even though this row is no longer in a modal.
    const saveRow = document.createElement('div');
    saveRow.className = 'modal-actions';

    const update = document.createElement('button');
    update.type = 'button';
    update.className = 'button button-primary';
    update.textContent = 'Update';
    update.addEventListener('click', () => this.callbacks.onUpdateLoaded());

    const saveAsNew = document.createElement('button');
    saveAsNew.type = 'button';
    saveAsNew.className = 'button';
    saveAsNew.textContent = 'Save as new';
    saveAsNew.addEventListener('click', () => this.callbacks.onSaveAsNew());

    saveRow.append(update, saveAsNew);

    const manageRow = document.createElement('div');
    manageRow.className = 'modal-actions';

    // The keyboard-accessible alternative to dragging a tile (SPEC §5.8),
    // reachable once a preset is loaded here.
    const reorder = document.createElement('div');
    reorder.className = 'reorder-group';
    reorder.append(
      iconButton({
        label: 'Move earlier in the list',
        name: 'chevronUp',
        className: 'icon-button-quiet',
        onClick: () => this.callbacks.onMoveLoaded(-1),
      }),
      iconButton({
        label: 'Move later in the list',
        name: 'chevronDown',
        className: 'icon-button-quiet',
        onClick: () => this.callbacks.onMoveLoaded(1),
      }),
    );

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button button-danger';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => {
      // A confirm dialog means a real gap between click and effect — without
      // this, a fast double-click opens two stacked "Delete X?" dialogs.
      if (remove.disabled) return;
      remove.disabled = true;
      void this.callbacks.onDeleteLoaded().finally(() => {
        remove.disabled = false;
      });
    });

    manageRow.append(reorder, remove);
    this.actionsContainer.append(saveRow, manageRow);
  }

  // ------------------------------------------------------------ sections

  private buildAppearanceSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'sidebar-section';
    section.append(sectionHeading('Appearance'));

    section.append(
      choiceRow<ThemeChoice>(
        'Theme',
        [
          { value: 'system', label: 'Match the computer', iconName: 'settings' },
          { value: 'light', label: 'Light', iconName: 'sun' },
          { value: 'dark', label: 'Dark', iconName: 'moon' },
        ],
        () => this.callbacks.getData().settings.theme,
        (value) => this.patch({ theme: value }),
      ),
    );

    section.append(
      choiceRow<'ring' | 'disc'>(
        'Circle style',
        [
          { value: 'ring', label: 'Ring', iconName: 'vizCircle' },
          { value: 'disc', label: 'Filled', iconName: 'circleFilled' },
        ],
        () => this.callbacks.getData().settings.circleStyle,
        (value) => this.patch({ circleStyle: value }),
      ),
    );

    section.append(
      choiceRow<'none' | 'clock' | 'interval'>(
        'Circle ticks',
        [
          { value: 'none', label: 'No ticks', iconName: 'ticksNone' },
          { value: 'clock', label: 'Clock positions', iconName: 'ticksClock' },
          { value: 'interval', label: 'This timer’s intervals', iconName: 'ticksInterval' },
        ],
        () => this.callbacks.getData().settings.circleTicks,
        (value) => this.patch({ circleTicks: value }),
      ),
    );

    return section;
  }

  private buildSoundSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'sidebar-section';
    section.append(sectionHeading('Sound'));

    const enabledRow = document.createElement('div');
    enabledRow.className = 'settings-row';
    const enabledLabel = document.createElement('span');
    enabledLabel.className = 'settings-label';
    enabledLabel.textContent = 'Chime when finished';
    const enabledToggle = toggleButton(
      this.callbacks.getData().settings.soundEnabled,
      'soundOn',
      'soundOff',
      'Chime on',
      'Chime off',
      (next) => {
        this.patch({ soundEnabled: next });
        sync();
      },
    );
    enabledRow.append(enabledLabel, enabledToggle);

    const chimeGroup = choiceRow<string>(
      'Chime',
      CHIMES.map((chime) => ({
        value: chime.id,
        label: chime.label,
        iconName: CHIME_ICONS[chime.id] ?? 'soundOn',
      })),
      () => this.callbacks.getData().settings.soundId,
      (value) => {
        this.patch({ soundId: value });
        // Preview, because "gentle" and "assertive" are not words that mean
        // anything until you have heard them in the room they will be used in.
        this.callbacks.onPreviewChime(value);
      },
    );

    const volumeRow = document.createElement('div');
    volumeRow.className = 'settings-row';
    const volumeLabel = document.createElement('label');
    volumeLabel.className = 'settings-label';
    volumeLabel.textContent = 'Volume';
    volumeLabel.htmlFor = 'sidebar-volume';
    const volume = document.createElement('input');
    volume.type = 'range';
    volume.id = 'sidebar-volume';
    volume.min = '0';
    volume.max = '1';
    volume.step = '0.05';
    volume.addEventListener('input', () => this.patch({ volume: Number(volume.value) }));
    volume.addEventListener('change', () =>
      this.callbacks.onPreviewChime(this.callbacks.getData().settings.soundId),
    );
    volumeRow.append(volumeLabel, volume);

    const sync = (): void => {
      const enabled = this.callbacks.getData().settings.soundEnabled;
      chimeGroup.hidden = !enabled;
      volumeRow.hidden = !enabled;
      volume.value = String(this.callbacks.getData().settings.volume);
    };
    this.soundSectionRefresh = sync;
    sync();

    section.append(enabledRow, chimeGroup, volumeRow);
    return section;
  }

  private buildDisplaySection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'sidebar-section';
    section.append(sectionHeading('Digits mode'));

    const row = document.createElement('div');
    row.className = 'settings-row';
    const label = document.createElement('span');
    label.className = 'settings-label';
    label.textContent = 'Tenths under ten seconds';
    row.append(
      label,
      toggleButton(
        this.callbacks.getData().settings.showTenths,
        'check',
        'close',
        'Tenths shown',
        'Tenths hidden',
        (next) => this.patch({ showTenths: next }),
      ),
    );
    section.append(row);
    return section;
  }

  private buildDataSection(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'sidebar-section';
    section.append(sectionHeading('Your data'));

    const actions = document.createElement('div');
    actions.className = 'chip-row';

    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.className = 'button';
    exportButton.textContent = 'Export';
    exportButton.addEventListener('click', () => this.exportData());

    const importLabel = document.createElement('label');
    importLabel.className = 'button';
    importLabel.textContent = 'Import';
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = 'application/json,.json';
    importInput.className = 'visually-hidden';
    importInput.addEventListener('change', () => void this.importData(importInput));
    importLabel.append(importInput);

    actions.append(exportButton, importLabel);
    section.append(actions);
    return section;
  }

  private patch(partial: Partial<Settings>): void {
    this.callbacks.onSettingsChange({ ...this.callbacks.getData().settings, ...partial });
  }

  private exportData(): void {
    try {
      const payload = JSON.stringify(serializeAppData(this.callbacks.getData()), null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'classroom-timer.json';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      // Nothing to recover; the teacher still has their timers.
    }
  }

  private async importData(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null) return;
      const version = (parsed as Record<string, unknown>)['schemaVersion'];
      if (typeof version !== 'number' || version > SCHEMA_VERSION) return;
      this.callbacks.onImport(sanitizeAppData(parsed as Record<string, unknown>));
    } catch {
      // A file that is not an export of this app is simply ignored.
    }
  }
}

let fieldSequence = 0;

/**
 * A labelled row. Form controls get a real `<label for>`; rows of buttons get
 * a group with an accessible name instead, because a `<label>` wrapping
 * several buttons names none of them (SPEC §8).
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
    control.setAttribute('role', 'group');
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

function sectionHeading(label: string): HTMLElement {
  const heading = document.createElement('div');
  heading.className = 'sidebar-section-heading';
  const text = document.createElement('h3');
  text.className = 'sidebar-section-title';
  text.textContent = label;
  heading.append(text);
  return heading;
}

interface Choice<T> {
  value: T;
  label: string;
  iconName: string;
}

function choiceRow<T extends string>(
  label: string,
  choices: ReadonlyArray<Choice<T>>,
  get: () => T,
  set: (value: T) => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'settings-row';

  const text = document.createElement('span');
  text.className = 'settings-label';
  text.textContent = label;

  const group = document.createElement('div');
  group.className = 'chip-row';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', label);

  const buttons = new Map<T, HTMLButtonElement>();
  const sync = (): void => {
    const current = get();
    for (const [value, button] of buttons) {
      const active = value === current;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  };

  for (const choice of choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.setAttribute('aria-label', choice.label);
    button.title = choice.label;
    button.append(icon(choice.iconName, 18));
    button.addEventListener('click', () => {
      set(choice.value);
      sync();
    });
    buttons.set(choice.value, button);
    group.append(button);
  }

  sync();
  row.append(text, group);
  return row;
}

function toggleButton(
  initial: boolean,
  onIcon: string,
  offIcon: string,
  onLabel: string,
  offLabel: string,
  onToggle: (next: boolean) => void,
): HTMLButtonElement {
  let value = initial;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chip chip-wide';
  const sync = (): void => {
    button.classList.toggle('is-active', value);
    button.setAttribute('aria-pressed', String(value));
    button.setAttribute('aria-label', value ? onLabel : offLabel);
    button.title = value ? onLabel : offLabel;
    button.replaceChildren(icon(value ? onIcon : offIcon, 18));
  };
  button.addEventListener('click', () => {
    value = !value;
    sync();
    onToggle(value);
  });
  sync();
  return button;
}
