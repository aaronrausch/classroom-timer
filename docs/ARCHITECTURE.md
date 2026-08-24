# Architecture

## Stack

- **Static site**, no server, no runtime backend.
- **TypeScript**, strict mode.
- **Vite** for build and dev server.
- **No UI framework.** The app is a state machine and four renderers behind a
  shared interface; a framework would add dependency churn without solving a
  problem this project actually has. Revisit only if preset management proves
  genuinely painful to hand-roll — see `docs/adr/0002-no-ui-framework.md`.
- **SVG** for the circle and dots; CSS transforms for the bar; scaled SVG text
  for digits. No canvas — canvas costs crispness and accessibility at a
  complexity level that doesn't need it.
- **Vitest** for the test suite — same Vite pipeline as the app, no separate
  test-runner configuration to keep in sync.

Every dependency beyond these is a future breakage and needs an ADR to
justify it (see `docs/adr/` and `ROBOTS.md`).

## Module map

```
src/
  core/               Pure, DOM-free. No document, no window, no localStorage
                       access outside storage.ts. This is where correctness
                       has to be provable — see tests/.
    clock.ts          The only place time is read. ClockSource abstraction
                       makes the whole timing model testable without waiting
                       real seconds (ManualClock in tests).
    timer.ts          The state machine (idle/running/paused/finished) and
                       the deadline arithmetic that keeps it drift-free.
    presets.ts         Pure CRUD over the preset collection — every function
                       returns a new array, nothing mutates its input.
    storage.ts         localStorage adapter: versioning, migrations, and the
                       failure-mode handling (unavailable/full/corrupt/future
                       version) required by SPEC §5.9.
    audio.ts           Chime playback, the unlock-on-first-gesture dance,
                       and silent degradation when audio isn't available.

  views/              Dumb renderers. Each takes a RenderState and draws it;
                       none of them read a clock, a store, or a setting
                       directly. All four implement the Visualization
                       interface in types.ts — adding a fifth mode is a
                       single new file here, nothing else.
    types.ts           The RenderState contract every visualization receives,
                       plus small shared helpers (colour mixing for the
                       warning cross-fade, clock formatting).
    circle.ts, bar.ts, dots.ts, digits.ts
                       The four visualizations (SPEC §5.3).
    readout.ts          The optional numeric overlay for the three graphical
                       modes (SPEC §5.4) — a separate, smaller concern from
                       the digits mode itself.

  ui/                 The DOM layer: controls, the preset library, the
                       sidebar, theming, full-screen handling.
    controls.ts         The toolbar and the keyboard bindings.
    presetList.ts       Preset tiles (launch + load-for-editing), and the
                       pure save/update/delete/reorder operations the
                       sidebar's Current Timer panel calls into.
    sidebar.ts          The Current Timer panel, saved timers, and every
                       setting, in one collapsible panel. Editing a preset is
                       not a form that commits on save — the panel is a live
                       view onto the same config the render loop reads every
                       frame, so a colour or warning-threshold change shows
                       on the stage immediately. See
                       docs/adr/0006-live-preset-editing.md. This is also the
                       one place a section heading (plain text) is used,
                       because none of it is ever shown to a student; see the
                       comment at the top of the file.
    theme.ts            Light/dark, palette application, and the
                       prefers-reduced-motion listener.
    fullscreen.ts        Fullscreen API with a maximised-layout fallback,
                       chrome auto-hide while running, and the Screen Wake
                       Lock request.
    icons.ts             The single bundled icon set (inline SVG, no font,
                       no CDN) and the iconButton() helper that guarantees
                       every icon-only control has a real accessible name.
    palettes.ts          The six curated palettes, each authored (not
                       derived) for both themes, plus the WCAG contrast
                       arithmetic tests/palettes.test.ts checks them against.
    modal.ts             A <dialog>-based modal with a hand-rolled fallback,
                       and the confirm-before-delete dialog.

  main.ts             The wiring. core/ decides what's true, views/ decide
                       what it looks like, and this file is the only place
                       the two meet — the animation loop, and when to write
                       to storage.
```

## The timer state machine

```
        ┌─────────────────────────────────────────┐
        ▼                                         │
    ┌───────┐  start   ┌─────────┐  pause  ┌────────┐
    │ IDLE  │─────────▶│ RUNNING │────────▶│ PAUSED │
    └───────┘          └─────────┘◀────────└────────┘
        ▲                    │      resume      │
        │                    │ reaches 0        │
        │    reset           ▼                  │
        └──────────────┬──────────┐             │
                       │ FINISHED │◀────────────┘
                       └──────────┘   (reset from any state)
```

Full transition rules are in SPEC §5.1; the implementation is
`src/core/timer.ts`, fully covered by `tests/timer.test.ts`.

## Timing model

The countdown is **deadline-based, not tick-based**: `Timer` stores an
absolute end timestamp and computes remaining time as `deadline - now` on
every frame, driven by `requestAnimationFrame`. Nothing is ever accumulated,
so a dropped frame, a throttled background tab, or a GC pause costs the
countdown nothing (SPEC §5.2).

Two clocks are read, reconciled in `Timer.readRunningRemaining()`:

- `performance.now()` (monotonic) is authoritative by default.
- `Date.now()` (wall clock) is the cross-check. If the monotonic clock has
  fallen more than a second behind the wall clock, the machine slept with
  `performance.now()` frozen, and the wall clock's account of elapsed time is
  trusted instead.

`tests/timer.test.ts` exercises this with a `ManualClock` that can simulate
sleep (`clock.sleep(wallMs, monoMs)`) and NTP corrections
(`clock.skewWall(ms)`) without any test taking real wall-clock time.

## Storage

Local only — `localStorage` under a single namespaced key, with a
`schemaVersion` integer and a migration table (`MIGRATIONS` in
`src/core/storage.ts`) for future schema changes. See
`docs/adr/0001-local-only-storage.md` for why, and SPEC §5.9 / §6 for the
full data model and failure-mode requirements.

## Adding a fifth visualization

1. Create `src/views/your-mode.ts` exporting a factory matching
   `VisualizationFactory` in `src/views/types.ts`.
2. Add the id to `VisualizationId` in `src/core/presets.ts` and to
   `VISUALIZATION_IDS`.
3. Wire it into the `switch` in `Stage.setVisualization()`
   (`src/ui/stage.ts`).
4. Add an icon in `src/ui/icons.ts` and a label in the `MODE_LABELS` /
   `MODE_ICONS` maps in `src/ui/controls.ts` and `src/ui/presetList.ts`.
5. Verify it against the 8-metre test (SPEC §7.1) before shipping it.
