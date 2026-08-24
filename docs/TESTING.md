# Testing

## Automated

```bash
npm test          # run once
npm run test:watch  # watch mode while developing
npm run typecheck   # tsc --noEmit
```

All of `src/core/` is covered — it's pure and DOM-free specifically so it can
be, and it's where a bug would be silent rather than obviously visible (SPEC
§11.1). As of this writing:

| Suite | What it covers |
|---|---|
| `tests/timer.test.ts` | State machine transitions, deadline arithmetic across pause/resume, drift over a long simulated run, machine-sleep and NTP-correction handling, duration parsing/formatting |
| `tests/presets.test.ts` | Preset CRUD — add/update/remove/move/sort — all pure and non-mutating |
| `tests/storage.test.ts` | The full failure-mode matrix (unavailable, full, corrupt, future schema version), migrations, and field-by-field sanitisation of untrusted stored data |
| `tests/palettes.test.ts` | WCAG contrast ratios for every shipped palette, in both themes |
| `tests/dots.test.ts` | Dot-interval derivation (always a round unit of time) and grid-shape selection |

A new test is expected alongside any change to `src/core/` or
`src/ui/palettes.ts` — see `CONTRIBUTING.md`.

### What CI does *not* catch

Automated tests verify logic, not legibility. Nothing in the test suite can
tell you whether the circle mode is readable from the back of a real
classroom, or whether a chosen palette looks washed out on an actual
projector. That's what the manual checklist below is for.

## Manual pre-release checklist

Run through this before a release that touches anything visual, and at least
once before the very first deploy. None of it is automatable; all of it has
caused real problems in similar projects before.

### The 8-metre test (SPEC §7.1)

- [ ] Project the app (or view it on the largest screen available) and stand
      roughly eight metres back — the size of a real classroom.
- [ ] For each of the four visualizations, confirm you can read "how much
      time is left" at a glance, without walking closer.
- [ ] Confirm the warning state (colour shift) is visible from that distance
      too, not just up close.

### Real projector verification (SPEC §7.2)

- [ ] View on an actual projector, in a lit room, not just a laptop screen.
      Projected images wash out contrast and shift colour — a palette that
      looks fine on a laptop can disappear on a wall.
- [ ] Check both light and dark theme under real room lighting; SPEC §7.2
      suggests dark is likely the better projector default, but that's a
      claim to verify, not assume.

### Colour-blind simulation (SPEC §8)

- [ ] Run the warning and finished states through a deuteranopia,
      protanopia, and tritanopia simulator (browser extension or OS-level
      filter). Confirm the second, non-colour signal (weight/scale change,
      shape) is still legible with colour removed.

### Flash-rate check (SPEC §8, §5.6)

- [ ] Record the completion state transition and step through it
      frame-by-frame, or watch closely in slow motion. Confirm nothing
      flashes, and that any settle animation stops within a few seconds and
      does not loop.

### Behaviour after machine sleep (SPEC §5.2)

- [ ] Start a timer, close the laptop lid (or lock the screen) for longer
      than the remaining duration, then reopen. Confirm the timer resolves
      to the finished state immediately, not after counting down from where
      it was left.
- [ ] Repeat with a sleep shorter than the remaining duration — confirm the
      countdown picks up correctly at the right remaining time.

### Keyboard and screen reader

- [ ] Tab through the entire interface with a mouse unplugged. Every control
      must be reachable, with a visible focus indicator, in a sensible order.
- [ ] With a screen reader running, start, pause, and finish a timer.
      Confirm state changes are announced once, not every second.

### Audio unlock (SPEC §5.7)

- [ ] With sound enabled in settings, load the app fresh (clear any cached
      audio-unlock state) and press Start. Confirm the chime plays on that
      first press — this is the single most likely "it's broken" report this
      project will get if it regresses.

### Offline (SPEC §5.13)

- [ ] Load the app once with a network connection, then go offline (airplane
      mode, or disconnect Wi-Fi) and reload. Confirm the app still loads and
      runs a full timer correctly.
