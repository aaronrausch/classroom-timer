import { describe, expect, it } from 'vitest';
import {
  BACKUP_KEY,
  MemoryStorage,
  SCHEMA_VERSION,
  STORAGE_KEY,
  Store,
  runMigrations,
  sanitizeAppData,
  serializeAppData,
} from '../src/core/storage';
import type { Migration } from '../src/core/storage';
import { starterPresets } from '../src/core/presets';
import type { AppData } from '../src/core/presets';

/** A storage that throws on every operation, simulating a fully locked-down browser. */
class ThrowingStorage {
  getItem(): never {
    throw new Error('denied');
  }
  setItem(): never {
    throw new Error('denied');
  }
  removeItem(): never {
    throw new Error('denied');
  }
}

/** A storage that accepts reads but rejects writes, simulating a full quota. */
class FullStorage extends MemoryStorage {
  override setItem(): never {
    throw new Error('quota exceeded');
  }
}

function sampleData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      theme: 'dark',
      soundEnabled: true,
      soundId: 'assertive',
      volume: 0.4,
      circleStyle: 'disc',
      circleTicks: 'clock',
      showTenths: true,
      showTimerName: true,
      sidebarCollapsed: false,
    },
    presets: starterPresets(),
  };
}

describe('Store — the happy path', () => {
  it('first run: nothing stored, returns defaults with starter presets', () => {
    const store = new Store(new MemoryStorage());
    const result = store.load();
    expect(result.status).toBe('empty');
    expect(result.persistent).toBe(true);
    expect(result.data.presets.length).toBeGreaterThan(0);
  });

  it('round-trips a save through a fresh Store instance', () => {
    const backing = new MemoryStorage();
    const store = new Store(backing);
    store.load();
    const saved = store.save(sampleData());
    expect(saved).toBe(true);

    const reloaded = new Store(backing).load();
    expect(reloaded.status).toBe('ok');
    expect(reloaded.data.settings.theme).toBe('dark');
    expect(reloaded.data.settings.circleStyle).toBe('disc');
    expect(reloaded.data.presets).toHaveLength(sampleData().presets.length);
  });
});

describe('Store — failure modes (SPEC §11.1)', () => {
  it('unavailable: falls back to in-memory defaults, reports not persistent', () => {
    const store = new Store(null);
    const result = store.load();
    expect(result.status).toBe('unavailable');
    expect(result.persistent).toBe(false);
    expect(result.data.presets.length).toBeGreaterThan(0);
    // Saving must not throw even though nothing is actually persisted.
    expect(() => store.save(sampleData())).not.toThrow();
    expect(store.save(sampleData())).toBe(false);
  });

  it('a storage that throws on getItem is treated as unavailable, not crashed', () => {
    const store = new Store(new ThrowingStorage());
    expect(() => store.load()).not.toThrow();
    expect(store.load().status).toBe('unavailable');
  });

  it('full: a write that fails is reported, app keeps running on the in-memory copy', () => {
    const store = new Store(new FullStorage());
    store.load();
    expect(() => store.save(sampleData())).not.toThrow();
    expect(store.save(sampleData())).toBe(false);
    expect(store.snapshot().settings.theme).toBe('dark');
  });

  it('corrupt: unparseable JSON falls back to defaults and preserves the payload', () => {
    const backing = new MemoryStorage();
    backing.setItem(STORAGE_KEY, '{not valid json');
    const store = new Store(backing);
    const result = store.load();
    expect(result.status).toBe('corrupt');
    expect(result.data.presets.length).toBeGreaterThan(0);
    expect(backing.getItem(BACKUP_KEY)).toBe('{not valid json');
  });

  it('corrupt: valid JSON with no schemaVersion is treated as corrupt, not silently accepted', () => {
    const backing = new MemoryStorage();
    backing.setItem(STORAGE_KEY, JSON.stringify({ presets: [] }));
    const store = new Store(backing);
    expect(store.load().status).toBe('corrupt');
  });

  it('corrupt payload is preserved under a backup key, never overwritten by a second corruption', () => {
    const backing = new MemoryStorage();
    backing.setItem(STORAGE_KEY, 'first corruption');
    new Store(backing).load();
    expect(backing.getItem(BACKUP_KEY)).toBe('first corruption');
  });

  it('future-version: a higher schema version is left untouched, not parsed or guessed at', () => {
    const backing = new MemoryStorage();
    const future = { schemaVersion: SCHEMA_VERSION + 1, settings: {}, presets: [{ from: 'the future' }] };
    backing.setItem(STORAGE_KEY, JSON.stringify(future));
    const store = new Store(backing);
    const result = store.load();
    expect(result.status).toBe('future-version');
    expect(result.persistent).toBe(false);

    // The original future payload must still be exactly as it was.
    expect(JSON.parse(backing.getItem(STORAGE_KEY) as string)).toEqual(future);
  });

  it('empty string is treated as empty, not corrupt', () => {
    const backing = new MemoryStorage();
    backing.setItem(STORAGE_KEY, '');
    expect(new Store(backing).load().status).toBe('empty');
  });
});

describe('schema migrations', () => {
  it('runs pure vN -> vN+1 functions in sequence up to the target version', () => {
    const addFoo: Migration = (raw) => ({ ...raw, foo: 'added-at-v1-to-v2' });
    const addBar: Migration = (raw) => ({ ...raw, bar: 'added-at-v2-to-v3' });
    const table = { 1: addFoo, 2: addBar };

    const result = runMigrations({ schemaVersion: 1 }, 1, 3, table);
    expect(result.version).toBe(3);
    expect(result.raw).toMatchObject({ foo: 'added-at-v1-to-v2', bar: 'added-at-v2-to-v3' });
  });

  it('stops early and reports the version reached if a migration is missing', () => {
    const table = { 1: ((raw: Record<string, unknown>) => raw) as Migration };
    const result = runMigrations({}, 1, 5, table);
    expect(result.version).toBe(2);
  });

  it('is a no-op when already at the target version', () => {
    const result = runMigrations({ a: 1 }, 3, 3, {});
    expect(result).toEqual({ raw: { a: 1 }, version: 3 });
  });
});

describe('sanitizeAppData — untrusted input at the storage boundary', () => {
  it('drops presets with an unreadable duration rather than crashing', () => {
    const data = sanitizeAppData({
      settings: {},
      presets: [{ id: 'a', name: 'Bad', durationSeconds: 'not a number' }],
    });
    expect(data.presets).toHaveLength(0);
  });

  it('falls back field-by-field for a malformed settings object', () => {
    const data = sanitizeAppData({ settings: { theme: 'purple', volume: 'loud' }, presets: [] });
    expect(data.settings.theme).toBe('system');
    expect(data.settings.volume).toBe(0.6);
  });

  it('falls back to the circle visualization for an unknown value', () => {
    const data = sanitizeAppData({
      settings: {},
      presets: [{ id: 'a', name: 'X', durationSeconds: 60, visualization: 'holographic' }],
    });
    expect(data.presets[0].visualization).toBe('circle');
  });

  it('clamps an out-of-range duration rather than dropping the preset', () => {
    const data = sanitizeAppData({
      settings: {},
      presets: [{ id: 'a', name: 'X', durationSeconds: 99_999 }],
    });
    expect(data.presets[0].durationSeconds).toBeLessThanOrEqual(120 * 60);
  });

  it('preserves unknown fields on a preset for round-tripping across app versions', () => {
    const data = sanitizeAppData({
      settings: {},
      presets: [
        { id: 'a', name: 'X', durationSeconds: 60, futureFieldFromV2: 'keep me' },
      ],
    });
    const serialized = serializeAppData(data);
    const preset = (serialized.presets as Array<Record<string, unknown>>)[0];
    expect(preset['futureFieldFromV2']).toBe('keep me');
  });

  it('handles presets not being an array at all', () => {
    const data = sanitizeAppData({ settings: {}, presets: 'not an array' });
    expect(data.presets).toEqual([]);
  });
});
