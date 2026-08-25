# 8. A "smooth motion" setting that overrides reduced motion

## Status
Accepted

## Context
The circle, bar, and digits' proportion strip already deplete continuously
by default — the render loop samples a continuous fraction every animation
frame (`main.ts`'s `frame()`), and `depletionFraction` in
`src/views/types.ts` only steps that to once-per-second when
`prefers-reduced-motion` is on (SPEC §8). A user who reported seeing
per-second jumps in the default build was very likely running with that OS
preference active, whether deliberately or as a side effect of a battery- or
performance-motivated setting rather than a motion-sensitivity one — reduced
motion is a single OS-wide switch a person doesn't get to say "except for
this one app" to.

That is exactly the case this ADR is about: a teacher who wants continuous
motion back for their own classroom timer, on their own device, despite the
device's own preference saying otherwise. The dots mode adds a second,
related but distinct request on top: an alternate, continuous depletion
style for a mode whose entire premise (SPEC §5.3C) is being *discrete* —
countable dots, not a proportion.

## Decision
**`Settings.smoothMotion`** (`src/core/presets.ts`), off by default: when on,
`depletionFraction` returns the continuous fraction even under
`reducedMotion` (`!state.reducedMotion || state.smoothMotion`). Every view
that already called `depletionFraction` — circle, bar, and now digits'
proportion strip (see below) — gets the override for free; no per-view code
was needed for those three.

Digits' proportion strip did *not* already call the shared helper — it had
its own inline duplicate of the same stepping arithmetic
(`src/views/digits.ts`). That duplication is why it was skipped by the
original reduced-motion work entirely; replacing it with a call to
`depletionFraction` was both the fix and a small cleanup in the same edit.

**`Settings.dotsSmoothStyle`** (`'ring' | 'shrink'`), only consulted while
`smoothMotion` is on:
- **`ring`**: dots delegates its rendering wholesale to a `createCircle`
  instance it constructs and holds internally (`src/views/dots.ts`), rather
  than reimplementing circle's dash arithmetic. The dot grid's own SVG is
  hidden (not destroyed) while this is active, and the delegate is only
  ever constructed while the style is actually selected. `Visualization.id`
  stays `'dots'` throughout — this is a rendering choice inside dots mode,
  not a switch to circle mode, so nothing outside `createDots` needs to
  know the delegate exists.
- **`shrink`**: keeps the real dot grid (same count, same `gridShape`
  layout as the discrete style, for visual continuity when toggling smooth
  motion on and off), but every lit dot's own radius becomes a continuous,
  pure function of the *overall* elapsed fraction and that dot's own equal
  share of the timer — `dotShrinkProgress(elapsed, index, count)`, exported
  and unit-tested the same way `gridShape` is. Every currently-lit dot
  visibly shrinks in lockstep as the whole timer runs, rather than only the
  one dot whose turn it currently is (which is what the discrete style's
  "draining dot" pie-wipe sub-animation already did, and continues to do
  when this style is off).

Both settings flow through `RenderState` like `reducedMotion` and
`warningMix` already do — not through `StageOptions`/constructor
arguments the way `circleStyle` or `circleTicks` do — because neither one
needs a structural rebuild-on-change the way those do; `dotShrinkProgress`
recomputes every frame for free, and the ring/grid structural swap is
detected and handled inside `createDots`'s own `render()` from the state it
already receives every frame, with no new stage.ts wiring at all.

## Consequences

**Why this is right:**
- The override is opt-in and explicit, never implied. Turning on Smooth
  motion is a choice a teacher makes for their own device; it does not
  change what `prefers-reduced-motion` means anywhere else, and turning it
  back off restores the OS preference's authority immediately.
- Reusing `createCircle` for the ring style means zero duplicated dash-array
  math and zero new bugs in geometry that was already correct and already
  tested by virtue of circle mode's own existence.
- `dotShrinkProgress` being a pure, exported function (`tests/dots.test.ts`)
  means the one genuinely new piece of animation math in this feature — not
  a one-line conditional like the `depletionFraction` change — is verified
  exactly, the same discipline `gridShape` is already held to.

**What this costs:**
- The dots-mode readout keeps dots' own bottom-anchored/flex layout
  treatment (`app.css`'s `[data-viz='dots'][data-readout='on']` rules) even
  while showing a ring, rather than adopting circle's centred-readout
  treatment — a minor visual inconsistency, accepted rather than adding a
  second CSS keying scheme for "dots showing a ring" as its own case.
- Two settings instead of one (`smoothMotion` and `dotsSmoothStyle`) is
  more surface than a single toggle, but collapsing them would mean either
  a dormant dots preference that occasionally does nothing (confusing) or
  losing the ability to remember a chosen dots style across turning smooth
  motion off and back on (worse).
