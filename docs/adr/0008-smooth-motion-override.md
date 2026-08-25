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
`smoothMotion` is on. Both keep the real dot grid — same count, same
`gridShape` layout as the discrete style, for visual continuity when
toggling smooth motion on and off — and share one piece of math,
`dotShrinkProgress(elapsed, index, count)`: how far dot `index` (of
`count`, reading order) is through its own equal share of the timer, 0 to
1, continuous, exported and unit-tested the same way `gridShape` is. Every
currently-lit dot progresses in lockstep with the whole timer, rather than
only the one dot whose turn it currently is (which is what the discrete
style's own "draining dot" sub-animation already did, and continues to do
when this style is off). The two styles differ only in what they *do* with
that progress value per dot:
- **`shrink`**: the dot's own radius scales down from full to nothing —
  `radius = baseRadius * (1 - progress)`.
- **`ring`**: the dot's outer size never changes; instead it depletes with
  exactly the arc `circle.ts` itself draws — same clockwise-from-twelve
  geometry, same `stroke-dasharray`/`stroke-dashoffset` arithmetic (the
  `pie` sub-element `build()` already gives every cell, previously only
  driven by the discrete style's single draining dot). The first
  implementation of this style delegated to a whole separate `createCircle`
  instance instead, swapping the grid out for one big ring — visually
  wrong: the ask was dots *individually* depleting like tiny clocks, still
  arranged in their grid, not the grid replaced by circle mode. Reusing the
  existing per-dot arc the discrete style already draws, driven by the
  continuous `progress` instead of the discrete `partial`, was both the fix
  and the simpler implementation — no second visualization instance, no
  hide/show bookkeeping between two SVG trees.

Both settings flow through `RenderState` like `reducedMotion` and
`warningMix` already do — not through `StageOptions`/constructor
arguments the way `circleStyle` or `circleTicks` do — because neither one
needs a structural rebuild-on-change the way those do; every frame's
`RenderState` is enough to pick the right per-dot rendering, so nothing
outside `createDots`'s own `render()` needs to know which style is active.

## Consequences

**Why this is right:**
- The override is opt-in and explicit, never implied. Turning on Smooth
  motion is a choice a teacher makes for their own device; it does not
  change what `prefers-reduced-motion` means anywhere else, and turning it
  back off restores the OS preference's authority immediately.
- The `ring` style reuses the exact arc geometry `build()` already gives
  every dot for the discrete style's own draining-dot sub-animation — zero
  duplicated dash-array math, and the same geometry that was already
  correct and already visible in the default style.
- `dotShrinkProgress` being a pure, exported function (`tests/dots.test.ts`)
  means the one genuinely new piece of animation math in this feature — not
  a one-line conditional like the `depletionFraction` change — is verified
  exactly, the same discipline `gridShape` is already held to. It is also
  what makes both styles trivially consistent with each other: they read
  the identical per-dot progress value, so switching between them mid-timer
  never jumps.

**What this costs:**
- Two settings instead of one (`smoothMotion` and `dotsSmoothStyle`) is
  more surface than a single toggle, but collapsing them would mean either
  a dormant dots preference that occasionally does nothing (confusing) or
  losing the ability to remember a chosen dots style across turning smooth
  motion off and back on (worse).
