import { CHIMES } from '../core/audio';
import type { AppData, Settings, ThemeChoice } from '../core/presets';
import { SCHEMA_VERSION, sanitizeAppData, serializeAppData } from '../core/storage';
import { icon, iconButton } from './icons';
import type { PresetList } from './presetList';

/** Nought, one and two arcs: gentle, neutral, assertive. */
const CHIME_ICONS: Record<string, string> = {
  gentle: 'soundLow',
  neutral: 'soundMed',
  assertive: 'soundHigh',
};

export interface SidebarCallbacks {
  onSettingsChange(settings: Settings): void;
  onPreviewChime(soundId: string): void;
  onImport(data: AppData): void;
  onCreatePreset(): void;
  onCollapse(): void;
  getData(): AppData;
  /** Set when persistence is not working, so it can be said once, quietly. */
  storageNotice(): string | null;
}

/**
 * The sidebar: saved timers and every setting, in one collapsible panel
 * (SPEC §5.8, §5.12).
 *
 * This is the one place in the app that trades the icons-not-words principle
 * (§1.2) for a few words of section heading. That principle is about the
 * *stage* — what a student reads from the back of the room — and none of this
 * panel is ever visible to a student; it is the teacher's own setup surface,
 * open only before or between activities. A "Sound" heading over the chime
 * controls costs nothing there and saves a guess.
 */
export class Sidebar {
  readonly element: HTMLElement;

  private readonly body: HTMLElement;
  private readonly presetsSection: HTMLElement;
  private readonly notice: HTMLElement;
  private readonly privacy: HTMLElement;
  private soundSectionRefresh: (() => void) | null = null;

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

    this.presetsSection = document.createElement('section');
    this.presetsSection.className = 'sidebar-section';
    this.presetsSection.append(this.buildPresetsSection());

    this.notice = document.createElement('p');
    this.notice.className = 'settings-notice';
    this.notice.hidden = true;

    this.privacy = document.createElement('p');
    this.privacy.className = 'settings-privacy';
    this.privacy.textContent =
      'This timer sends nothing anywhere. No accounts, no analytics, no network. Your timers are stored only in this browser.';

    this.body.append(
      this.presetsSection,
      this.buildAppearanceSection(),
      this.buildSoundSection(),
      this.buildDisplaySection(),
      this.buildDataSection(),
      this.notice,
      this.privacy,
    );

    this.element.append(header, bodyCell);
  }

  /** Called whenever the underlying settings or presets may have changed. */
  refresh(): void {
    const notice = this.callbacks.storageNotice();
    this.notice.hidden = !notice;
    this.notice.textContent = notice ?? '';
    this.soundSectionRefresh?.();
  }

  // ------------------------------------------------------------ sections

  private buildPresetsSection(): HTMLElement {
    const heading = sectionHeading('Saved timers');
    const create = document.createElement('button');
    create.type = 'button';
    create.className = 'sidebar-new-button';
    create.append(icon('plus', 16), document.createTextNode('New timer'));
    create.addEventListener('click', () => this.callbacks.onCreatePreset());
    heading.append(create);

    const wrap = document.createElement('div');
    wrap.append(heading, this.presetList.element);
    return wrap;
  }

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
          { value: 'interval', label: 'This timer\u2019s intervals', iconName: 'ticksInterval' },
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
