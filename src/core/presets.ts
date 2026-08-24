import type { WarningThreshold } from './timer';
import { clampDurationSeconds } from './timer';

export type VisualizationId = 'circle' | 'bar' | 'dots' | 'digits';

export const VISUALIZATION_IDS: readonly VisualizationId[] = ['circle', 'bar', 'dots', 'digits'];

export function isVisualizationId(value: unknown): value is VisualizationId {
  return typeof value === 'string' && (VISUALIZATION_IDS as readonly string[]).includes(value);
}

export interface Preset {
  id: string;
  name: string;
  durationSeconds: number;
  visualization: VisualizationId;
  palette: string;
  /** Overlay readout; ignored when `visualization` is "digits" (SPEC §5.4). */
  readout: boolean;
  warning: WarningThreshold;
  order: number;
  /**
   * Fields written by a newer version of the app are carried here and written
   * back untouched, so a teacher using two machines on different versions does
   * not silently lose configuration (SPEC §6).
   */
  unknownFields?: Record<string, unknown>;
}

export type ThemeChoice = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemeChoice;
  soundEnabled: boolean;
  soundId: string;
  volume: number;
  /**
   * Ring or filled disc for the circle mode (SPEC §5.3A). A property of the
   * room — the disc reads better at distance, the ring is calmer for long
   * durations — so it lives in settings rather than in each preset.
   */
  circleStyle: 'ring' | 'disc';
  /**
   * Thin reference marks around the circle mode, off by default (SPEC §5.3A
   * lists quarter ticks as a `[MAY]`, not something to impose unasked).
   * "clock" draws twelve fixed marks like an analogue clock face, with the
   * four quarter positions accented. "interval" derives marks from the
   * *current* timer's own duration — a mark at each round unit of time that
   * has elapsed, with every fifth accented — the same "round unit" discipline
   * §5.3C requires of the dots mode, applied here as a ruler instead of a
   * countdown.
   */
  circleTicks: 'none' | 'clock' | 'interval';
  /** Tenths of a second under ten seconds in the digits mode. Off by default. */
  showTenths: boolean;
  /** A small, persistent label in the corner of the stage naming the running timer. Off by default. */
  showTimerName: boolean;
  /**
   * Whether the sidebar (saved timers plus settings) is folded away. A teacher
   * who runs the same two timers all day wants the wall, not the panel; a
   * teacher mid-planning wants it open. Remembered, because it is a working
   * habit rather than a momentary choice.
   */
  sidebarCollapsed: boolean;
}

export interface AppData {
  schemaVersion: number;
  settings: Settings;
  presets: Preset[];
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  soundEnabled: false,
  soundId: 'gentle',
  volume: 0.6,
  circleStyle: 'ring',
  circleTicks: 'none',
  showTenths: false,
  showTimerName: false,
  sidebarCollapsed: false,
};

export type NewPreset = Omit<Preset, 'id' | 'order'> & Partial<Pick<Preset, 'id' | 'order'>>;

/**
 * Not `crypto.randomUUID()` directly: interactive-whiteboard browsers are often
 * old, and some serve the app over plain HTTP, where `crypto` is unavailable.
 * Failing to save a preset because of an id generator would be absurd.
 */
export function createId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/**
 * The starter library (SPEC §5.8). Real classroom transitions, so the value of
 * presets is visible before the teacher has invested anything. All six are
 * editable and deletable.
 */
export function starterPresets(): Preset[] {
  const seed: Array<[string, number, VisualizationId, string, boolean, number]> = [
    ['Morning register', 300, 'circle', 'teal', true, 60],
    ['Silent reading', 900, 'bar', 'indigo', false, 60],
    ['Tidy up', 180, 'circle', 'amber', true, 30],
    ['Station rotation', 600, 'dots', 'forest', true, 60],
    ['Exit ticket', 120, 'dots', 'violet', true, 30],
    ['Quick task', 60, 'digits', 'rose', false, 15],
  ];
  return seed.map(([name, durationSeconds, visualization, palette, readout, warn], order) => ({
    id: createId(),
    name,
    durationSeconds,
    visualization,
    palette,
    readout,
    warning: { type: 'seconds', value: warn } as WarningThreshold,
    order,
  }));
}

export function defaultAppData(schemaVersion: number): AppData {
  return {
    schemaVersion,
    settings: { ...DEFAULT_SETTINGS },
    presets: starterPresets(),
  };
}

// ------------------------------------------------------------------ pure CRUD
//
// Every function here returns a new array. Nothing mutates its input, so the
// caller decides when state changes, and the tests can reason about it.

export function sortPresets(presets: readonly Preset[]): Preset[] {
  return [...presets].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/** Reassign `order` to 0..n-1 in current visual sequence. */
export function normalizeOrder(presets: readonly Preset[]): Preset[] {
  return sortPresets(presets).map((preset, index) => ({ ...preset, order: index }));
}

export function addPreset(presets: readonly Preset[], preset: NewPreset): Preset[] {
  const maxOrder = presets.reduce((max, p) => Math.max(max, p.order), -1);
  const created: Preset = {
    ...preset,
    id: preset.id ?? createId(),
    order: preset.order ?? maxOrder + 1,
    name: normalizeName(preset.name),
    durationSeconds: clampDurationSeconds(preset.durationSeconds),
  };
  return [...presets, created];
}

export function updatePreset(
  presets: readonly Preset[],
  id: string,
  patch: Partial<Omit<Preset, 'id'>>,
): Preset[] {
  return presets.map((preset) => {
    if (preset.id !== id) return preset;
    const next = { ...preset, ...patch };
    if (patch.name !== undefined) next.name = normalizeName(patch.name);
    if (patch.durationSeconds !== undefined) {
      next.durationSeconds = clampDurationSeconds(patch.durationSeconds);
    }
    return next;
  });
}

export function removePreset(presets: readonly Preset[], id: string): Preset[] {
  return normalizeOrder(presets.filter((preset) => preset.id !== id));
}

/**
 * Move a preset to a new index in the visual sequence. Backs both drag-and-drop
 * and the keyboard-accessible alternative, so the two cannot drift apart.
 */
export function movePreset(presets: readonly Preset[], id: string, toIndex: number): Preset[] {
  const ordered = sortPresets(presets);
  const from = ordered.findIndex((preset) => preset.id === id);
  if (from === -1) return [...presets];
  const target = Math.min(ordered.length - 1, Math.max(0, toIndex));
  if (target === from) return ordered.map((preset, index) => ({ ...preset, order: index }));
  const [moved] = ordered.splice(from, 1);
  ordered.splice(target, 0, moved);
  return ordered.map((preset, index) => ({ ...preset, order: index }));
}

/** A preset name is the teacher's own words; we only trim and cap runaway input. */
export function normalizeName(name: string): string {
  const trimmed = (name ?? '').replace(/\s+/g, ' ').trim();
  return trimmed.slice(0, 48) || 'Timer';
}
