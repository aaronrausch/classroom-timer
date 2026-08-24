import { describe, expect, it } from 'vitest';
import {
  addPreset,
  createId,
  DEFAULT_SETTINGS,
  movePreset,
  normalizeName,
  normalizeOrder,
  removePreset,
  sortPresets,
  starterPresets,
  updatePreset,
} from '../src/core/presets';
import type { Preset } from '../src/core/presets';

function makePreset(overrides: Partial<Preset> = {}): Preset {
  return {
    id: createId(),
    name: 'Test timer',
    durationSeconds: 300,
    visualization: 'circle',
    palette: 'teal',
    readout: true,
    warning: { type: 'seconds', value: 60 },
    order: 0,
    ...overrides,
  };
}

describe('starterPresets', () => {
  it('ships a real, immediately usable set', () => {
    const presets = starterPresets();
    expect(presets.length).toBeGreaterThanOrEqual(4);
    expect(presets.length).toBeLessThanOrEqual(6);
    for (const preset of presets) {
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.durationSeconds).toBeGreaterThan(0);
    }
  });

  it('gives every starter preset a unique id', () => {
    const ids = starterPresets().map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('addPreset / updatePreset / removePreset', () => {
  it('adds a preset at the end of the order', () => {
    const existing = [makePreset({ order: 0 }), makePreset({ order: 1 })];
    const draft = makePreset({ name: 'New one' }) as Partial<Preset>;
    delete draft.order; // let addPreset compute it, as the UI actually calls it
    const next = addPreset(existing, draft as Parameters<typeof addPreset>[1]);
    expect(next).toHaveLength(3);
    expect(next[2].order).toBe(2);
  });

  it('does not mutate its input', () => {
    const existing = [makePreset()];
    const frozen = JSON.stringify(existing);
    addPreset(existing, makePreset());
    expect(JSON.stringify(existing)).toBe(frozen);
  });

  it('updatePreset patches only the matching preset', () => {
    const a = makePreset({ id: 'a', name: 'A' });
    const b = makePreset({ id: 'b', name: 'B' });
    const next = updatePreset([a, b], 'a', { name: 'A renamed' });
    expect(next.find((p) => p.id === 'a')?.name).toBe('A renamed');
    expect(next.find((p) => p.id === 'b')?.name).toBe('B');
  });

  it('removePreset deletes and renumbers order contiguously', () => {
    const presets = [
      makePreset({ id: 'a', order: 0 }),
      makePreset({ id: 'b', order: 1 }),
      makePreset({ id: 'c', order: 2 }),
    ];
    const next = removePreset(presets, 'b');
    expect(next.map((p) => p.id)).toEqual(['a', 'c']);
    expect(next.map((p) => p.order)).toEqual([0, 1]);
  });

  it('clamps duration on add and update', () => {
    const added = addPreset([], makePreset({ durationSeconds: 999_999 }));
    expect(added[0].durationSeconds).toBeLessThanOrEqual(120 * 60);

    const updated = updatePreset(added, added[0].id, { durationSeconds: -5 });
    expect(updated[0].durationSeconds).toBeGreaterThanOrEqual(5);
  });
});

describe('movePreset', () => {
  it('reorders a preset to a new index and renumbers everything', () => {
    const presets = [
      makePreset({ id: 'a', order: 0 }),
      makePreset({ id: 'b', order: 1 }),
      makePreset({ id: 'c', order: 2 }),
    ];
    const next = movePreset(presets, 'c', 0);
    expect(next.map((p) => p.id)).toEqual(['c', 'a', 'b']);
    expect(next.map((p) => p.order)).toEqual([0, 1, 2]);
  });

  it('clamps an out-of-range target index', () => {
    const presets = [makePreset({ id: 'a', order: 0 }), makePreset({ id: 'b', order: 1 })];
    const next = movePreset(presets, 'a', 99);
    expect(next.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('is a no-op for an unknown id, but still returns a fresh array', () => {
    const presets = [makePreset({ id: 'a', order: 0 })];
    const next = movePreset(presets, 'does-not-exist', 0);
    expect(next).not.toBe(presets);
    expect(next.map((p) => p.id)).toEqual(['a']);
  });
});

describe('sortPresets / normalizeOrder', () => {
  it('sorts by order, then name as a tiebreaker', () => {
    const presets = [
      makePreset({ id: 'b', name: 'Zebra', order: 0 }),
      makePreset({ id: 'a', name: 'Apple', order: 0 }),
    ];
    const sorted = sortPresets(presets);
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('normalizeOrder collapses gaps and duplicates into 0..n-1', () => {
    const presets = [makePreset({ id: 'a', order: 5 }), makePreset({ id: 'b', order: 5 })];
    const normalized = normalizeOrder(presets);
    expect(normalized.map((p) => p.order).sort()).toEqual([0, 1]);
  });
});

describe('normalizeName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeName('  Tidy   up  ')).toBe('Tidy up');
  });

  it('falls back to a default for empty input', () => {
    expect(normalizeName('   ')).toBe('Timer');
    expect(normalizeName('')).toBe('Timer');
  });

  it('caps runaway length', () => {
    const long = 'x'.repeat(500);
    expect(normalizeName(long).length).toBeLessThanOrEqual(48);
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('is silent and undecorated by default (SPEC §5.7)', () => {
    expect(DEFAULT_SETTINGS.soundEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.theme).toBe('system');
  });
});
