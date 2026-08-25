import { CHIMES } from '../core/audio';
import type { AppData, Settings, ThemeChoice } from '../core/presets';
import { SCHEMA_VERSION, sanitizeAppData, serializeAppData } from '../core/storage';
import type { WarningThreshold } from '../core/timer';
import { icon, iconButton } from './icons';
import {
  decodeCustomPalette,
  encodeCustomPalette,
  isCustomPaletteId,
} from './palettes';
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

/** A handful of starting points for gradient mode, not a fixed palette of
 * their own — picking one just fills in the two hex fields, which stay
 * freely editable afterward like any other custom colour. */
const GRADIENT_PRESETS: ReadonlyArray<{ label: string; from: string; to: string }> = [
  { label: 'Sunset', from: '#fb923c', to: '#ec4899' },
  { label: 'Ocean', from: '#0ea5e9', to: '#6366f1' },
  { label: 'Forest', from: '#22c55e', to: '#0d9488' },
  { label: 'Fire', from: '#f59e0b', to: '#dc2626' },
  { label: 'Dusk', from: '#6366f1', to: '#d946ef' },
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
  private appearanceSectionRefresh: (() => void) | null = null;

  private nameInput!: HTMLInputElement;
  private paletteButtons = new Map<string, HTMLButtonElement>();
  private warningSelect!: HTMLSelectElement;
  private actionsContainer!: HTMLElement;

  private customSwatchButton!: HTMLButtonElement;
  private customTriggerSwatch!: HTMLElement;
  private customTriggerChevron!: SVGSVGElement;
  private customPanel!: HTMLElement;
  private customPanelOpen = false;
  private customMode: 'solid' | 'gradient' = 'solid';
  private customModeButtons = new Map<'solid' | 'gradient', HTMLButtonElement>();
  private customFromHex = '#3366cc';
  private customToHex = '#cc3366';
  private customFromInput!: HTMLInputElement;
  private customFromHexInput!: HTMLInputElement;
  private customToInput!: HTMLInputElement;
  private customToHexInput!: HTMLInputElement;
  private customToRow!: HTMLElement;
  private customPresetsRow!: HTMLElement;

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
      presetsSection,
      this.buildCurrentTimerSection(),
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
    this.appearanceSectionRefresh?.();
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

    const paletteField = document.createElement('div');
    paletteField.className = 'field settings-row-stacked';
    const paletteLabel = document.createElement('span');
    paletteLabel.className = 'field-label';
    paletteLabel.textContent = 'Color';

    const swatchGroup = document.createElement('div');
    swatchGroup.className = 'chip-row chip-row-colors';
    swatchGroup.setAttribute('role', 'group');
    swatchGroup.setAttribute('aria-label', 'Color');
    for (const option of paletteOptions()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip chip-swatch';
      button.setAttribute('aria-label', option.label);
      button.title = option.label;
      button.style.setProperty('--swatch-fill', this.callbacks.colorsFor(option.id).fill);
      button.addEventListener('click', () => {
        this.callbacks.onCurrentTimerChange({ palette: option.id });
        this.customPanelOpen = false;
        this.syncPaletteButtons();
      });
      this.paletteButtons.set(option.id, button);
      swatchGroup.append(button);
    }

    // A separate, full-width row rather than one more grid cell: sixteen
    // items in a five-per-row grid always leaves this one stranded alone on
    // its own near-empty row (16 = 3 rows of 5, plus one). It also is not
    // really "one more colour" the way the curated fifteen are — it opens a
    // whole picker — so a labelled row of its own is the honest affordance.
    this.customSwatchButton = document.createElement('button');
    this.customSwatchButton.type = 'button';
    this.customSwatchButton.className = 'custom-color-trigger';
    // Explicit rather than relying on the visible text content: every other
    // icon-bearing control in this file names itself the same way (see
    // iconButton in icons.ts), and this button mixes an aria-hidden swatch
    // and chevron in with that text — safer to say so directly.
    this.customSwatchButton.setAttribute('aria-label', 'Custom color');
    this.customSwatchButton.setAttribute('aria-expanded', 'false');
    this.customTriggerSwatch = document.createElement('span');
    this.customTriggerSwatch.className = 'custom-color-trigger-swatch';
    this.customTriggerSwatch.setAttribute('aria-hidden', 'true');
    const triggerLabel = document.createElement('span');
    triggerLabel.className = 'custom-color-trigger-label';
    triggerLabel.textContent = 'Custom color';
    this.customTriggerChevron = icon('chevronDown', 16);
    this.customTriggerChevron.classList.add('custom-color-trigger-chevron');
    this.customSwatchButton.append(this.customTriggerSwatch, triggerLabel, this.customTriggerChevron);
    this.customSwatchButton.addEventListener('click', () => {
      this.customPanelOpen = !this.customPanelOpen;
      // Opening it is also choosing it — a picker you can open without it
      // applying anything would show a colour on the stage that does not
      // match the panel the moment it appears. Collapsing it again, once a
      // custom colour is already the live selection, is purely visual —
      // syncPaletteButtons keeps it open regardless, since the colour it
      // would be hiding is still the one actually in use.
      if (this.customPanelOpen) this.applyCustomColor();
      this.syncPaletteButtons();
    });

    paletteField.append(paletteLabel, swatchGroup);

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

    section.append(
      heading,
      nameField,
      paletteField,
      this.customSwatchButton,
      this.buildCustomColorPanel(),
      warningField,
      this.actionsContainer,
    );
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
    const currentIsCustom = isCustomPaletteId(current);
    for (const [id, button] of this.paletteButtons) {
      const active = id === current;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }

    // A saved preset can carry a custom colour of its own; reflect it in the
    // panel's inputs so re-opening the picker shows what is actually applied,
    // not whatever the last teacher happened to type.
    if (currentIsCustom) {
      const decoded = decodeCustomPalette(current);
      if (decoded) {
        this.customMode = decoded.to ? 'gradient' : 'solid';
        this.customFromHex = decoded.from;
        if (decoded.to) this.customToHex = decoded.to;
        if (document.activeElement !== this.customFromHexInput) {
          this.customFromInput.value = decoded.from;
          this.customFromHexInput.value = decoded.from;
        }
        if (decoded.to && document.activeElement !== this.customToHexInput) {
          this.customToInput.value = decoded.to;
          this.customToHexInput.value = decoded.to;
        }
        this.customToRow.hidden = !decoded.to;
        this.customPresetsRow.hidden = !decoded.to;
        this.syncCustomModeButtons();
      }
    }

    // The trigger's own swatch previews the raw hex(es) currently dialled in
    // — not the contrast-corrected `fill` colorsFor would return — since this
    // is direct feedback on what was typed, the same way the native <input
    // type=color> swatch beside each hex field is.
    this.customTriggerSwatch.style.background =
      this.customMode === 'gradient'
        ? `linear-gradient(135deg, ${this.customFromHex}, ${this.customToHex})`
        : this.customFromHex;

    const shouldShowPanel = this.customPanelOpen || currentIsCustom;
    this.customSwatchButton.classList.toggle('is-active', shouldShowPanel);
    this.customSwatchButton.setAttribute('aria-expanded', String(shouldShowPanel));
    if (this.customPanel.hidden === shouldShowPanel) this.customPanel.hidden = !shouldShowPanel;
  }

  private syncCustomModeButtons(): void {
    for (const [mode, button] of this.customModeButtons) {
      const active = mode === this.customMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }

  private buildCustomColorPanel(): HTMLElement {
    this.customPanel = document.createElement('div');
    this.customPanel.className = 'custom-color-panel';
    this.customPanel.hidden = true;

    const modeRow = document.createElement('div');
    modeRow.className = 'chip-row';
    modeRow.setAttribute('role', 'group');
    modeRow.setAttribute('aria-label', 'Custom color style');
    for (const mode of ['solid', 'gradient'] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip chip-wide';
      button.textContent = mode === 'solid' ? 'Solid' : 'Gradient';
      button.addEventListener('click', () => {
        this.customMode = mode;
        this.customToRow.hidden = mode !== 'gradient';
        this.customPresetsRow.hidden = mode !== 'gradient';
        this.syncCustomModeButtons();
        this.applyCustomColor();
      });
      this.customModeButtons.set(mode, button);
      modeRow.append(button);
    }

    const fromRow = this.buildCustomColorRow(
      'From',
      this.customFromHex,
      (input, hexInput) => {
        this.customFromInput = input;
        this.customFromHexInput = hexInput;
      },
      (hex) => {
        this.customFromHex = hex;
        this.applyCustomColor();
      },
    );

    this.customToRow = this.buildCustomColorRow(
      'To',
      this.customToHex,
      (input, hexInput) => {
        this.customToInput = input;
        this.customToHexInput = hexInput;
      },
      (hex) => {
        this.customToHex = hex;
        this.applyCustomColor();
      },
    );
    this.customToRow.hidden = this.customMode !== 'gradient';

    this.customPresetsRow = document.createElement('div');
    this.customPresetsRow.className = 'custom-color-presets';
    this.customPresetsRow.setAttribute('role', 'group');
    this.customPresetsRow.setAttribute('aria-label', 'Gradient presets');
    this.customPresetsRow.hidden = this.customMode !== 'gradient';
    for (const preset of GRADIENT_PRESETS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'custom-color-preset';
      button.setAttribute('aria-label', preset.label);
      button.title = preset.label;
      button.style.background = `linear-gradient(135deg, ${preset.from}, ${preset.to})`;
      button.addEventListener('click', () => {
        this.customFromHex = preset.from;
        this.customToHex = preset.to;
        this.customFromInput.value = preset.from;
        this.customFromHexInput.value = preset.from;
        this.customToInput.value = preset.to;
        this.customToHexInput.value = preset.to;
        this.applyCustomColor();
      });
      this.customPresetsRow.append(button);
    }

    this.customPanel.append(modeRow, fromRow, this.customToRow, this.customPresetsRow);
    this.syncCustomModeButtons();
    return this.customPanel;
  }

  private buildCustomColorRow(
    label: string,
    initialHex: string,
    capture: (colorInput: HTMLInputElement, hexInput: HTMLInputElement) => void,
    onChange: (hex: string) => void,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'settings-row custom-color-row';

    const text = document.createElement('span');
    text.className = 'settings-label';
    text.textContent = label;

    const controls = document.createElement('div');
    controls.className = 'custom-color-controls';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'color-input';
    colorInput.value = initialHex;
    colorInput.setAttribute('aria-label', `${label} color`);

    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'text-input hex-input';
    hexInput.value = initialHex;
    hexInput.maxLength = 7;
    hexInput.setAttribute('aria-label', `${label} color, hex code`);
    hexInput.autocomplete = 'off';
    hexInput.spellcheck = false;

    const commit = (raw: string) => {
      const normalized = normalizeHexInput(raw);
      if (!normalized) return; // Not a readable hex yet — leave the field alone rather than reject a half-typed value.
      colorInput.value = normalized;
      hexInput.value = normalized;
      onChange(normalized);
    };

    colorInput.addEventListener('input', () => commit(colorInput.value));
    hexInput.addEventListener('change', () => commit(hexInput.value));
    hexInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        hexInput.blur();
      }
    });

    controls.append(colorInput, hexInput);
    row.append(text, controls);
    capture(colorInput, hexInput);
    return row;
  }

  private applyCustomColor(): void {
    const id =
      this.customMode === 'gradient'
        ? encodeCustomPalette(this.customFromHex, this.customToHex)
        : encodeCustomPalette(this.customFromHex);
    this.callbacks.onCurrentTimerChange({ palette: id });
    this.syncPaletteButtons();
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

    const nameRow = document.createElement('div');
    nameRow.className = 'settings-row';
    const nameLabel = document.createElement('span');
    nameLabel.className = 'settings-label';
    nameLabel.textContent = 'Show timer name';
    nameRow.append(
      nameLabel,
      toggleButton(
        this.callbacks.getData().settings.showTimerName,
        'check',
        'close',
        'Name shown',
        'Name hidden',
        (next) => this.patch({ showTimerName: next }),
      ),
    );
    section.append(nameRow);

    const smoothRow = document.createElement('div');
    smoothRow.className = 'settings-row';
    const smoothLabel = document.createElement('span');
    smoothLabel.className = 'settings-label';
    smoothLabel.textContent = 'Smooth motion';
    smoothRow.append(
      smoothLabel,
      toggleButton(
        this.callbacks.getData().settings.smoothMotion,
        'check',
        'close',
        'Smooth motion on',
        'Smooth motion off',
        (next) => {
          this.patch({ smoothMotion: next });
          sync();
        },
      ),
    );

    // Only meaningful once Smooth motion is actually on — hidden rather than
    // just left inert, so a teacher isn't left guessing why picking a dots
    // style did nothing, the same "hidden rather than silently ignored"
    // reasoning the readout toggle already uses for digits mode.
    const dotsStyleGroup = choiceRow<'ring' | 'shrink'>(
      'Dots style',
      [
        { value: 'ring', label: 'Smooth ring, like Circle', iconName: 'vizCircle' },
        { value: 'shrink', label: 'Shrink and disappear', iconName: 'dotsShrink' },
      ],
      () => this.callbacks.getData().settings.dotsSmoothStyle,
      (value) => this.patch({ dotsSmoothStyle: value }),
    );

    const sync = (): void => {
      dotsStyleGroup.hidden = !this.callbacks.getData().settings.smoothMotion;
    };
    this.appearanceSectionRefresh = sync;
    sync();

    section.append(smoothRow, dotsStyleGroup);

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
  return index === -1
    ? WARNING_OPTIONS.findIndex((option) => option.value.type === 'percent' && option.value.value === 10)
    : index;
}

/** Accepts `#3366cc`, `3366cc`, or the 3-digit shorthand; rejects anything else. */
function normalizeHexInput(raw: string): string | null {
  const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(raw.trim());
  if (!match) return null;
  const hex = match[1];
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  return `#${full.toLowerCase()}`;
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
  // Stacked, not label-left/control-right: a 2-3 choice icon group next to a
  // label sometimes fits on one line (right-aligned by the row's own
  // space-between) and sometimes doesn't (wraps below, left-aligned) — which
  // one depends on the label's own length and the current chip count, so
  // rows ended up inconsistently aligned with no visual logic tying them
  // together. Giving the group its own full-width row below the label always
  // fits, so it stays put and left-aligned regardless of chip count.
  const row = document.createElement('div');
  row.className = 'settings-row settings-row-stacked';

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
