# 7. Custom colours, and gradients as one sweep across the whole view

## Status
Accepted

## Context
The original theme system offered six curated palettes, each a fixed
fill/track/warning/numeral set hand-picked to clear the SPEC's contrast
floors (§5.12, §8). A teacher whose school colours weren't among them had no
way to match the projector to anything but chance. Fifteen curated palettes
narrows that gap but can never close it — the fix is letting a teacher name
their own colour.

A second, related request came with it: gradients. The naive reading —
colour each drawn element (each dot, each tick, the fill vs. the track)
independently along a gradient — was rejected early. That reads as
decoration applied per-object, not as one coherent sweep, and it would have
meant re-deriving contrast guarantees per element instead of per palette.

## Decision
**Custom colour** (`src/ui/palettes.ts`): a single hex input is enough to
derive a full `PaletteColors` set — `deriveCustomPalette` runs the same
`withMinContrast` correction the curated palettes are held to by hand,
guaranteeing the SPEC §5.12/§8 floors algorithmically instead of by review.
`towardAlertHue` rotates the input's own hue toward alert-red for the warning
colour, so a custom teal still warns in something recognisably "alert",
not an arbitrary rotation. A custom palette is identified by an encoded id
(`encodeCustomPalette`/`decodeCustomPalette`: `custom:#hex` or
`customgrad:#from:#to`) rather than a new field threaded through
`Settings`/`Preset` — it reuses the existing `palette: string` slot
everywhere a curated palette id already flows (storage, presets, the
toolbar), so nothing downstream needed to learn a second colour
representation. `resolvePaletteOrCustom` in `src/ui/theme.ts` is the one
dispatch point that tells a curated id from a custom one.

**Gradient themes**: "maps onto the whole view of the timer, not individual
elements" is implemented literally as one gradient per visualization,
spanning that view's own coordinate space corner-to-corner, that every
depleting element samples from its own position rather than being coloured
independently:
- **Circle** (`src/views/circle.ts`): a `<linearGradient
  gradientUnits="userSpaceOnUse">` fixed to the 100×100 viewBox; the
  depleting arc's `stroke` references it.
- **Dots** (`src/views/dots.ts`): the same technique, re-anchored to the
  grid's own viewBox whenever the grid reshapes (`build()`), since dot count
  changes the viewBox itself. Every lit dot's `fill` is the one reference —
  a 5×3 grid of dots reads as one sweep, not five different colours.
- **Bar** (`src/views/bar.ts`): no native SVG gradient space to anchor to, so
  the CSS equivalent: the gradient is painted as a `background-image` on the
  depleting `fill` div sized *larger* than the div by `1 / fraction`
  (`background-size`). `fill` shrinks via `scaleX`, which would otherwise
  visibly squeeze a normal background along with it; enlarging the source
  image by the inverse of that squeeze cancels it out, so what shows through
  always matches the same fixed point on a full-width sweep, exactly as if
  the gradient were painted on the wall behind a shrinking curtain.

Both stops move together during the warning cross-fade
(`gradientStops` in `src/views/types.ts`, mirroring `activeFill`): each stop
blends independently toward the *same* solid warning colour over
`warningMix`, so a warning still reads as "the whole sweep is now alarmed"
and never a jump from gradient to flat colour.

The track/spent-dot colour is deliberately left solid and untouched by
gradients in every view. Gradients answer "what colour is the remaining
time drawn in", the same question a solid palette's `fill` answers — they
are not a second theme system for every role a palette has.

## Consequences

**Why this is right:**
- One derivation path (`deriveCustomPalette` /
  `deriveCustomGradientPalette`) is the only place contrast math has to be
  correct, and it is — `tests/palettes.test.ts` runs it against sixteen
  adversarial hex inputs (pure primaries, near-black, near-white, colours
  already near the alert hue) across both themes, the same discipline the
  curated palettes are held to.
- A gradient is genuinely one visual object across the whole timer, matching
  the request, rather than an illusion built from many independently-tinted
  elements that would drift out of sync with each other during a reshape or
  a warning fade.
- Reusing the `palette: string` slot means presets, import/export, and
  storage sanitisation (`src/core/storage.ts`) needed no schema change to
  carry a custom colour — a saved preset with a custom palette round-trips
  through the exact same path a curated one does.

**What this costs:**
- `trackFor` (`src/ui/palettes.ts`) exists solely to correct a case the
  curated palettes never hit: a fixed `fill`-vs-track mix ratio failed 3:1
  contrast for some derived hexes (desaturated greys, dark browns). It
  iterates the mix ratio until contrast is met, which is more machinery
  than a hand-authored palette needs, but a custom hex has no author to
  catch that by eye.
- The bar's `background-size` compensation is a genuine CSS trick, not an
  obvious one — a reader unfamiliar with it needs the comment in
  `src/views/bar.ts` to see why the size is `1 / fraction` rather than a
  fixed value.
- Curated palettes remain solid-only; a teacher wanting a gradient must use
  the custom picker's Gradient mode rather than picking one from the
  fifteen. Adding curated gradient presets is a reasonable future addition
  but wasn't required to satisfy the request as given.
