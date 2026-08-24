import type { ThemeChoice } from '../core/presets';
import { PALETTES, SURFACES, resolvePaletteOrCustom } from './palettes';
import type { PaletteColors, ThemeMode } from './palettes';

/**
 * Light and dark, and the application of a palette (SPEC §5.12).
 *
 * The default follows `prefers-color-scheme`; an explicit choice by the teacher
 * overrides it and persists. Dark is likely the better projector default in a
 * lit room, but that is a claim to validate on a wall, not to hard-code here
 * (SPEC §7.2), so the system preference wins until someone says otherwise.
 */
export class ThemeController {
  private choice: ThemeChoice = 'system';
  private readonly query: MediaQueryList | null;
  private readonly listeners = new Set<(mode: ThemeMode) => void>();
  private lastNotifiedMode: ThemeMode | null = null;

  constructor(private readonly root: HTMLElement = document.documentElement) {
    this.query =
      typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    this.query?.addEventListener?.('change', () => {
      if (this.choice === 'system') this.apply();
    });
  }

  get mode(): ThemeMode {
    if (this.choice === 'light' || this.choice === 'dark') return this.choice;
    return this.query?.matches ? 'dark' : 'light';
  }

  get value(): ThemeChoice {
    return this.choice;
  }

  set(choice: ThemeChoice): void {
    this.choice = choice;
    this.apply();
  }

  /** What the `D` key does: a straight flip, leaving "system" behind deliberately. */
  toggle(): ThemeChoice {
    this.set(this.mode === 'dark' ? 'light' : 'dark');
    return this.choice;
  }

  onChange(listener: (mode: ThemeMode) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  apply(): void {
    const mode = this.mode;
    const surface = SURFACES[mode];
    this.root.dataset['theme'] = mode;
    this.root.style.setProperty('--surface-bg', surface.bg);
    this.root.style.setProperty('--surface-text', surface.text);
    this.root.style.setProperty('--surface-muted', surface.muted);
    this.root.style.setProperty('--surface-panel', surface.panel);
    this.root.style.setProperty('--surface-border', surface.border);
    // Native form controls and scrollbars should follow, or the settings panel
    // ends up with a white select on a dark ground.
    this.root.style.colorScheme = mode;

    // Listeners exist to react to an *actual* light/dark flip (e.g. repainting
    // preset swatches). `set()` is called on every settings change, not just
    // theme changes — without this guard, changing something as unrelated as
    // the circle style would still fire every listener, and a listener that
    // rebuilds a list (as the preset list's did) turned every sidebar click
    // into a visible full rebuild of unrelated DOM.
    if (mode === this.lastNotifiedMode) return;
    this.lastNotifiedMode = mode;
    for (const listener of this.listeners) listener(mode);
  }

  colorsFor(paletteId: string): PaletteColors {
    return resolvePaletteOrCustom(paletteId, this.mode);
  }
}

export function paletteOptions(): ReadonlyArray<{ id: string; label: string }> {
  return PALETTES.map((palette) => ({ id: palette.id, label: palette.label }));
}

/**
 * `prefers-reduced-motion`, read live rather than once at start-up — a teacher
 * who turns it on in the OS should not have to reload a projected timer.
 */
export class MotionPreference {
  private readonly query: MediaQueryList | null;
  private readonly listeners = new Set<(reduced: boolean) => void>();

  constructor() {
    this.query =
      typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.query?.addEventListener?.('change', () => {
      document.documentElement.dataset['reducedMotion'] = String(this.reduced);
      for (const listener of this.listeners) listener(this.reduced);
    });
    document.documentElement.dataset['reducedMotion'] = String(this.reduced);
  }

  get reduced(): boolean {
    return this.query?.matches ?? false;
  }

  onChange(listener: (reduced: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
