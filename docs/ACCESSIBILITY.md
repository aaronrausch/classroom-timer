# Accessibility

## Commitments

These are hard requirements (SPEC §8), not aspirations. A classroom of thirty
students reliably includes students affected by every item below.

- **No flashing between 3 Hz and 55 Hz**, anywhere, including the completion
  state. This is a photosensitive-epilepsy safety requirement — the
  highest-severity risk this project carries, made worse by a full-screen
  projected image being the worst possible delivery vector for it.
- **Colour is never the only signal.** The warning and finished states are
  each distinguishable by a second channel — the circle's stroke thickens,
  the bar grows taller, the dots swell slightly, the digits gain weight —
  verified against deuteranopia, protanopia, and tritanopia simulation.
- **Contrast meets WCAG 2.2 AA**: 3:1 for large graphical objects, 4.5:1 for
  any text, in both themes, for every shipped palette. Verified
  automatically by `tests/palettes.test.ts` against the actual colour values
  in `src/ui/palettes.ts` — not assumed, not eyeballed.
- **Full keyboard operability**, with a visible focus indicator and a
  logical focus order. See the keyboard shortcut table in SPEC §5.10.
- **Timer state is exposed to assistive technology** via a polite live
  region (`Stage.announce()` in `src/ui/stage.ts`), announcing started,
  paused, and finished — not every second, which would make the tool
  actively unusable with a screen reader rather than accessible.
- **`prefers-reduced-motion` is honoured, and is not a degraded mode.**
  Depletion becomes stepped (once per second) with no easing; the timer
  remains fully functional. See `MotionPreference` in `src/ui/theme.ts` and
  `depletionFraction()` in `src/views/types.ts`.
- **`prefers-contrast` is respected** where the browser supports it.
- **Icon-only controls always carry a real accessible name.** Every control
  built with `iconButton()` (`src/ui/icons.ts`) requires a `label`; there is
  no code path to an unlabelled icon button in this codebase.

## How this is verified

- **Automatically, in CI**: `tests/palettes.test.ts` checks contrast for
  every palette in both themes on every change. `npm run typecheck && npm
  test` both gate every deploy (see `docs/DEPLOYMENT.md`).
- **Manually, before a release**: the checklist in `docs/TESTING.md` covers
  everything automation cannot judge — flash-rate on real hardware,
  colour-blind simulation, screen reader behaviour, and the 8-metre
  legibility test.
- **Not yet done**: verification with a real screen reader user (SPEC §8
  lists this as `[SHOULD]`, not yet completed as of this writing). If you do
  this, please record what you found — in an issue, a PR description, or
  directly as an update to this file.

## Known gaps

- Screen reader verification (above) — `SHOULD`, not yet performed.
- Only English is supported. Strings are centralised so this is mechanically
  cheap to address later, but no translation work has been done (SPEC
  assumption A3).
- No dedicated high-contrast/Windows-forced-colours theme beyond what
  `prefers-contrast: more` already adjusts. If this turns out to be
  insufficient in practice, it belongs in `docs/adr/` as a real decision, not
  a silent patch.

If you find a gap not listed here, please open an issue rather than working
around it silently — accessibility regressions are exactly the kind of thing
this file exists to keep visible.
