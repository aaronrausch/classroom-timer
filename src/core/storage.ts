import {
  DEFAULT_SETTINGS,
  defaultAppData,
  isVisualizationId,
  normalizeName,
  normalizeOrder,
  createId,
} from './presets';
import type { AppData, Preset, Settings, ThemeChoice } from './presets';
import { clampDurationSeconds } from './timer';
import type { WarningThreshold } from './timer';

export const STORAGE_KEY = 'classroom-timer';
export const BACKUP_KEY = 'classroom-timer:backup';
export const SCHEMA_VERSION = 1;

/** The slice of the Storage API this module actually uses. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadStatus =
  /** Stored data was read and used. */
  | 'ok'
  /** Nothing stored yet — first run. */
  | 'empty'
  /** Stored data was unreadable. It has been backed up, not overwritten. */
  | 'corrupt'
  /** Stored data came from a newer version of the app and was left alone. */
  | 'future-version'
  /** No usable storage at all. The app runs, but nothing is remembered. */
  | 'unavailable';

export interface LoadResult {
  data: AppData;
  status: LoadStatus;
  /** False when changes will not survive a reload, for the one quiet notice. */
  persistent: boolean;
}

/** A migration takes the raw stored object at version N and returns version N+1. */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migrations are pure `vN -> vN+1` functions applied in sequence (SPEC §6).
 * There are none yet — v1 is the first shipped schema — but the runner is real,
 * exercised by tests, and ready. Presets are user-authored data; discarding
 * them on an upgrade would be a serious failure, so this is not a thing to
 * improvise later under pressure.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = Object.freeze({});

export function runMigrations(
  raw: Record<string, unknown>,
  fromVersion: number,
  toVersion: number,
  table: Readonly<Record<number, Migration>> = MIGRATIONS,
): { raw: Record<string, unknown>; version: number } {
  let current = raw;
  let version = fromVersion;
  while (version < toVersion) {
    const migrate = table[version];
    if (!migrate) break;
    current = migrate(current);
    version += 1;
  }
  return { raw: current, version };
}

/**
 * A storage that forgets. Used when `localStorage` is missing, blocked or full,
 * which on locked-down school images and in private browsing is a routine
 * situation rather than an exotic one. The timer must not care.
 */
export class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** Probe for a storage that can actually be written to, not merely referenced. */
export function detectStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const probe = `${STORAGE_KEY}:probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/**
 * The persistence boundary. Everything above it deals in `AppData`; everything
 * below it deals in strings that may be absent, truncated, or written by a
 * version of this app that does not exist yet.
 *
 * The one rule it never breaks: **bad stored data does not white-screen the
 * app, and is never silently destroyed.**
 */
export class Store {
  private readonly storage: StorageLike;
  readonly available: boolean;
  private writable: boolean;
  private data: AppData;
  private statusValue: LoadStatus = 'empty';

  constructor(storage: StorageLike | null = detectStorage()) {
    this.available = storage !== null;
    this.writable = this.available;
    this.storage = storage ?? new MemoryStorage();
    this.data = defaultAppData(SCHEMA_VERSION);
  }

  get status(): LoadStatus {
    return this.statusValue;
  }

  get persistent(): boolean {
    return this.available && this.writable;
  }

  load(): LoadResult {
    if (!this.available) {
      this.data = defaultAppData(SCHEMA_VERSION);
      this.statusValue = 'unavailable';
      return { data: this.data, status: 'unavailable', persistent: false };
    }

    let text: string | null = null;
    try {
      text = this.storage.getItem(STORAGE_KEY);
    } catch {
      this.writable = false;
      this.data = defaultAppData(SCHEMA_VERSION);
      this.statusValue = 'unavailable';
      return { data: this.data, status: 'unavailable', persistent: false };
    }

    if (text === null || text === '') {
      this.data = defaultAppData(SCHEMA_VERSION);
      this.statusValue = 'empty';
      return { data: this.data, status: 'empty', persistent: this.persistent };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return this.quarantine(text, 'corrupt');
    }

    if (!isPlainObject(parsed)) {
      return this.quarantine(text, 'corrupt');
    }

    const rawVersion = parsed['schemaVersion'];
    const version = typeof rawVersion === 'number' && Number.isInteger(rawVersion) ? rawVersion : null;

    if (version === null) {
      return this.quarantine(text, 'corrupt');
    }

    // A higher version is not parsed at all. Guessing at a newer shape and
    // writing our guess back is how a teacher loses their preset library.
    if (version > SCHEMA_VERSION) {
      this.data = defaultAppData(SCHEMA_VERSION);
      this.statusValue = 'future-version';
      this.writable = false;
      return { data: this.data, status: 'future-version', persistent: false };
    }

    const migrated = runMigrations(parsed as Record<string, unknown>, version, SCHEMA_VERSION);
    if (migrated.version !== SCHEMA_VERSION) {
      return this.quarantine(text, 'corrupt');
    }

    this.data = sanitizeAppData(migrated.raw);
    this.statusValue = 'ok';
    return { data: this.data, status: 'ok', persistent: this.persistent };
  }

  /**
   * Save. Returns false when the write did not stick — a full quota on a shared
   * school machine, most often. The caller keeps running on the in-memory copy.
   */
  save(data: AppData): boolean {
    this.data = data;
    if (!this.available) return false;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(serializeAppData(data)));
      return true;
    } catch {
      // Quota exceeded, or storage revoked mid-session.
      this.writable = false;
      return false;
    }
  }

  snapshot(): AppData {
    return this.data;
  }

  /** Preserve an unreadable payload under a backup key rather than overwriting it. */
  private quarantine(text: string, status: LoadStatus): LoadResult {
    try {
      this.storage.setItem(BACKUP_KEY, text);
    } catch {
      this.writable = false;
    }
    this.data = defaultAppData(SCHEMA_VERSION);
    this.statusValue = status;
    return { data: this.data, status, persistent: this.persistent };
  }
}

// -------------------------------------------------------------- sanitisation
//
// Stored data is input. It is validated field by field, and anything that does
// not survive validation falls back to a default rather than to `undefined`
// leaking into a renderer.

const KNOWN_PRESET_KEYS = new Set([
  'id',
  'name',
  'durationSeconds',
  'visualization',
  'palette',
  'readout',
  'warning',
  'order',
]);

export function sanitizeAppData(raw: Record<string, unknown>): AppData {
  const settings = sanitizeSettings(raw['settings']);
  const rawPresets = Array.isArray(raw['presets']) ? raw['presets'] : [];
  const presets = rawPresets
    .map((entry, index) => sanitizePreset(entry, index))
    .filter((preset): preset is Preset => preset !== null);

  return {
    schemaVersion: SCHEMA_VERSION,
    settings,
    presets: normalizeOrder(presets),
  };
}

function sanitizeSettings(raw: unknown): Settings {
  if (!isPlainObject(raw)) return { ...DEFAULT_SETTINGS };
  const theme = raw['theme'];
  const volume = raw['volume'];
  return {
    theme: theme === 'light' || theme === 'dark' || theme === 'system' ? (theme as ThemeChoice) : DEFAULT_SETTINGS.theme,
    soundEnabled: typeof raw['soundEnabled'] === 'boolean' ? raw['soundEnabled'] : DEFAULT_SETTINGS.soundEnabled,
    soundId: typeof raw['soundId'] === 'string' ? raw['soundId'] : DEFAULT_SETTINGS.soundId,
    volume:
      typeof volume === 'number' && Number.isFinite(volume)
        ? Math.min(1, Math.max(0, volume))
        : DEFAULT_SETTINGS.volume,
    circleStyle: raw['circleStyle'] === 'disc' ? 'disc' : DEFAULT_SETTINGS.circleStyle,
    circleTicks:
      raw['circleTicks'] === 'clock' || raw['circleTicks'] === 'interval'
        ? raw['circleTicks']
        : DEFAULT_SETTINGS.circleTicks,
    showTenths: typeof raw['showTenths'] === 'boolean' ? raw['showTenths'] : DEFAULT_SETTINGS.showTenths,
    sidebarCollapsed:
      typeof raw['sidebarCollapsed'] === 'boolean'
        ? raw['sidebarCollapsed']
        : DEFAULT_SETTINGS.sidebarCollapsed,
  };
}

function sanitizePreset(raw: unknown, index: number): Preset | null {
  if (!isPlainObject(raw)) return null;

  const duration = raw['durationSeconds'];
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return null;

  const unknownFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!KNOWN_PRESET_KEYS.has(key)) unknownFields[key] = value;
  }

  const order = raw['order'];
  const preset: Preset = {
    id: typeof raw['id'] === 'string' && raw['id'] ? raw['id'] : createId(),
    name: normalizeName(typeof raw['name'] === 'string' ? raw['name'] : 'Timer'),
    durationSeconds: clampDurationSeconds(duration),
    visualization: isVisualizationId(raw['visualization']) ? raw['visualization'] : 'circle',
    palette: typeof raw['palette'] === 'string' && raw['palette'] ? raw['palette'] : 'teal',
    readout: typeof raw['readout'] === 'boolean' ? raw['readout'] : true,
    warning: sanitizeWarning(raw['warning']),
    order: typeof order === 'number' && Number.isFinite(order) ? order : index,
  };

  if (Object.keys(unknownFields).length > 0) preset.unknownFields = unknownFields;
  return preset;
}

function sanitizeWarning(raw: unknown): WarningThreshold {
  if (isPlainObject(raw)) {
    const value = raw['value'];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      if (raw['type'] === 'percent') return { type: 'percent', value: Math.min(100, value) };
      if (raw['type'] === 'seconds') return { type: 'seconds', value: Math.round(value) };
    }
  }
  return { type: 'seconds', value: 60 };
}

/** Write unknown fields back out, so version mixing is survivable (SPEC §6). */
export function serializeAppData(data: AppData): Record<string, unknown> {
  return {
    schemaVersion: data.schemaVersion,
    settings: data.settings,
    presets: data.presets.map((preset) => {
      const { unknownFields, ...known } = preset;
      return { ...(unknownFields ?? {}), ...known };
    }),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
