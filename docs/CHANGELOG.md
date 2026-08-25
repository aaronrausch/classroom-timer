# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- A "Smooth motion" setting (off by default) that forces the circle, bar,
  and digits' bottom proportion strip to deplete continuously even when the
  device's own `prefers-reduced-motion` preference is on — a deliberate,
  explicit override a teacher can turn on for their own timer, never
  implied by anything else. See
  [docs/adr/0008-smooth-motion-override.md](adr/0008-smooth-motion-override.md).
- With Smooth motion on, Dots mode can deplete continuously too, instead of
  its usual discrete countable grid — a "Dots style" choice between a
  smooth ring (borrowing circle mode's own depletion) and every lit dot
  shrinking to nothing over its own equal share of the timer.
- Custom colours: a hex input or native colour picker derives a full,
  contrast-guaranteed palette from any colour a teacher chooses, alongside
  the fifteen curated palettes (up from six). See
  [docs/adr/0007-gradient-themes.md](adr/0007-gradient-themes.md).
- Gradient themes: the custom colour picker also supports a two-stop
  gradient, rendered as one sweep across the whole visualization rather than
  colouring each dot/segment independently.
- A "Show timer name" toggle in Display puts the current timer's name in the
  corner of the screen, small and readable — off by default.
- The toolbar and sidebar now fade out after a few seconds of no mouse
  movement or key presses, leaving only the timer visual on screen; moving
  the cursor or pressing a key brings them back immediately.
- Initial release: four visualizations (circle, bar, dots, digits), presets
  with local storage, light/dark themes with six palettes, full-screen
  projector mode, offline support via a service worker, and a full
  accessibility and testing baseline. See [SPEC.md](SPEC.md) for the complete
  product definition.
- Circle mode tick marks (SPEC §5.3A `[MAY]`): off by default, with two
  styles — fixed clock positions, or marks derived from the current timer's
  own duration — plus the setting to choose between them.
- Live preset editing: the sidebar's Current Timer panel is a direct view
  onto the running configuration, so a colour or warning-threshold change is
  visible on the stage immediately, rather than after a modal's Save button.
  See [docs/adr/0006-live-preset-editing.md](adr/0006-live-preset-editing.md).

### Changed
- The custom colour picker was redesigned: swatches (curated and custom) are
  now plain solid colour rather than a diagonal fill/track split, "Custom
  color" is a dedicated full-width row instead of a stray extra grid cell,
  the expanded picker has more breathing room, and Gradient mode now offers
  five ready-made gradient presets (Sunset, Ocean, Forest, Fire, Dusk) as
  starting points.
- Circle ticks icons redesigned: twelve evenly-spaced marks for "Clock
  positions" (matching a real analogue clock face) and a deliberately
  irregular spread for "This timer's intervals", both clearer at a glance
  than the previous versions.
- The numeral-overlay toggle in the toolbar's Display group got its own icon
  and a light divider, so it no longer looks like a duplicate of the Digits
  mode button beside it.
- Sidebar rows with several icon choices (Theme, Circle style, Circle ticks,
  Chime) now always put the label on its own line above the choices, so
  every such row lines up the same way regardless of how many choices it
  has or how long its label is — previously some fit next to their label
  (right-aligned) and some wrapped below it (left-aligned), depending on
  width.
- Chrome now fades out after 1.5 seconds of inactivity instead of 3.
- "Colour" was American-English "Color" in the one place it was visible in
  the UI (the sidebar's colour-picker label and its screen-reader text);
  internal code, comments, and docs (including SPEC.md) still use British
  spelling throughout and were left as they were.
- Every timer now defaults to a "last 10%" warning threshold, replacing the
  previous fixed 60-second default, so shorter timers (a 2-minute exit
  ticket) still warn at a sensible point instead of the whole thing being
  "warning" from the start.
- "Saved timers" moved to the top of the sidebar, above Appearance/Sound/
  Display, since loading or editing a preset is the most common thing done
  there.
- The dots grid's readout no longer overlaps the dot grid — the numeral now
  reserves its own row via flexbox instead of a fixed height carved out of
  the grid, so the two stay in sync as either one's size changes.
- The sidebar now sits on the right, matching its own toggle button's
  position in the toolbar.
- The play/pause icon, duration readout, and every other toolbar indicator
  now update every animation frame instead of on a 200ms timer, so they can
  no longer visibly lag behind a click.
- The dots grid always forms a complete rectangle; a count that doesn't
  factor evenly gets a few permanently faint filler dots rather than a
  ragged final row.
- Spent and filler dots render as a faint shadow of the fill colour instead
  of a solid disc.
- The numeric readout overlay is noticeably larger on all three graphical
  visualizations.

### Fixed
- Changing a settings-panel option unrelated to light/dark (circle style,
  circle ticks, etc.) no longer triggers a full rebuild of the saved-timer
  tiles — that rebuild is now correctly gated on the theme actually changing,
  fixing visible jank/lag when clicking sidebar controls.
- Changing the circle tick style no longer briefly flashes the whole ring to
  its default state; only the tick marks themselves update.
- Changing "Tenths under ten seconds" in Digits mode no longer flashes the
  numerals — the same class of fix as the tick-style one above, applied to
  the digits visualization's own setting.
- The From/To hex fields in Gradient mode no longer spill past the picker
  panel's own edge — a text `<input>`'s browser-default intrinsic width was
  overriding its flex-shrink, the same `min-width: 0` gotcha this codebase
  has hit before (see `.sidebar-body-cell` in app.css).
- Removed the live "One dot per X seconds · N dots" hint from under the
  toolbar; the same information is still shown while a timer is loaded for
  editing.
- A fast double-click on the Current Timer panel's Delete button could open
  two stacked confirmation dialogs; the button now disables itself for the
  duration of the confirmation.
