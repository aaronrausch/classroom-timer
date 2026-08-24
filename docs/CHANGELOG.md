# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
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
- Removed the live "One dot per X seconds · N dots" hint from under the
  toolbar; the same information is still shown while a timer is loaded for
  editing.
- A fast double-click on the Current Timer panel's Delete button could open
  two stacked confirmation dialogs; the button now disables itself for the
  duration of the confirmation.
