# SPEC — Classroom Visual Timer

**Status:** Draft v0.1
**Last updated:** 2026-08-23
**Owner:** aaronr919@gmail.com

---

## 1. Purpose

A full-screen visual countdown timer, displayed on a classroom projector or interactive
whiteboard, that lets a room full of students understand *how much time is left* at a glance
from anywhere in the room — without reading.

Every decision in this document is subordinate to that goal. When a trade-off appears, the
question is always: **does this help a teacher run a transition, or does it get in the way?**

### 1.1 The governing scenario

A teacher has 25 seconds of attention to spare. They are standing at the front of the room,
often at a lectern PC or an interactive whiteboard, sometimes with a student mid-sentence.
They need to put a five-minute timer on the wall and get back to teaching.

That is the whole product. Everything else is secondary.

### 1.2 Design principles

1. **Legible from the back row.** The primary visual must be interpretable at ~8 metres by a
   student who is not looking directly at it. This is the *8-metre test* and it is the single
   hardest constraint in the project (see §7).
2. **Icons, not words.** The interface communicates through shape and symbol. Text appears
   only where it is genuinely irreplaceable: preset names the teacher typed themselves, and
   numerals in the digits mode and readout. Numerals are a quantity, not prose.
3. **Two clicks to running.** Any saved preset must reach a running, full-screen timer in at
   most two interactions.
4. **Nothing to log into.** No accounts, no backend, no network calls at runtime. The app
   works on a school network with aggressive filtering, and works offline.
5. **Calm.** A timer on the wall for six hours a day must not be visually exhausting. No
   pulsing, no jitter, no attention-grabbing motion until the end state.
6. **Boring to maintain.** A static site with no build-time magic and few dependencies, so it
   still deploys cleanly in five years.

### 1.3 Non-goals

Explicitly out of scope for v1. Listed so they are decided, not forgotten:

- User accounts, cloud sync, or any server-side state.
- Any collection of student data. The app never sees a student.
- Stopwatch / count-up mode.
- Multiple simultaneous timers on one screen.
- Native mobile apps.
- Analytics, telemetry, or third-party scripts of any kind.
- Class lists, randomisers, noise meters, or other "classroom toolkit" features. This is a
  timer.

---

## 2. Users

| User | Context | Needs |
|---|---|---|
| **Primary — Classroom teacher** | Lectern PC or IWB, projector, 20–30 students, low patience | Start a common duration instantly; save the durations they use daily; make it visible |
| **Secondary — Student** | Seated, 2–10 m away, glancing up mid-task | Understand remaining time in under one second, without reading |
| **Tertiary — Support staff / TA** | Unfamiliar with the tool, handed the PC | Operate it correctly with zero training |
| **Quaternary — Maintainer** | Forking or contributing, possibly years later | Understand and deploy the project from docs alone |

Accessibility is not a fifth user. It is a property of the first four (see §8).

---

## 3. Core concepts

**Timer** — a countdown of a given duration. Has exactly one lifecycle (§5.1).

**Visualization** — one of four ways the remaining time is drawn: circle, bar, dots, or
digits (§5.3).

**Readout** — an optional numeric display layered over a *graphical* visualization, distinct
from the digits mode itself (§5.4).

**Preset** — a named, saved configuration: `{ name, duration, visualization, palette }`. This
is what makes the tool worth returning to; it is the difference between a timer and *this
class's* timer. Examples a teacher would actually create: "Morning register", "Silent
reading", "Tidy up", "Station rotation", "Exit ticket".

**Theme** — light or dark, plus a chosen colour palette (§5.7).

---

## 4. User journeys

### 4.1 First run (no presets)
1. Teacher lands on the site. Sees a large timer face at a sensible default (5:00) with
   duration controls and a prominent start button. No onboarding, no modal, no tour.
2. They adjust the duration, press start. It works.
3. A single unobtrusive save affordance offers to remember it.

### 4.2 Daily use (the path that matters)
1. Teacher opens the bookmarked site. Presets are visible immediately as large tappable tiles.
2. One click on "Tidy up" → timer loaded and running full-screen.
3. Space bar pauses if a student interrupts. Space resumes.
4. At 60s remaining the display shifts to its warning state; students self-correct.
5. Timer completes. Unmistakable visual end state, optional chime.
6. Escape returns to the picker for the next activity.

### 4.3 Transition chaining (manual, v1)
Station rotations are run by returning to the picker and choosing the next preset. Automatic
chaining is deferred — see ROADMAP.

---

## 5. Functional requirements

Requirements are labelled `[MUST]`, `[SHOULD]`, `[MAY]`.

### 5.1 Timer lifecycle

State machine, exactly these states:

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

- `[MUST]` `IDLE` — duration selected, not started. Controls visible.
- `[MUST]` `RUNNING` — counting down. Chrome auto-hides after 3s of pointer inactivity.
- `[MUST]` `PAUSED` — frozen. A persistent, unambiguous paused indicator is shown so a
  teacher who walked away can tell at a glance that time is not moving.
- `[MUST]` `FINISHED` — reached zero. See §5.6.
- `[MUST]` Reset is available from every state and returns to `IDLE` with the same duration
  (not to defaults — a teacher who runs the same 5 minutes three times running should press
  reset, then start).

### 5.2 Timing accuracy

- `[MUST]` The timer is **deadline-based, not tick-based.** Store an absolute end timestamp;
  compute remaining time as `deadline - now` on each frame. Never accumulate `setInterval`
  deltas — they drift, and browsers throttle background timers to once per second or slower.
- `[MUST]` Rendering is driven by `requestAnimationFrame`; the clock source is
  `performance.now()` with a `Date.now()` cross-check to detect system sleep.
- `[MUST]` On tab visibility change or wake-from-sleep, recompute from the deadline. A timer
  that was backgrounded past its end time resolves to `FINISHED` immediately on return.
- `[MUST]` Accuracy target: displayed remaining time within ±250 ms of true remaining time.
- `[MUST]` Pause stores remaining duration; resume computes a fresh deadline.
- `[SHOULD]` Duration range 5 seconds to 120 minutes.

### 5.3 Visualizations

Four modes. Each `[MUST]` be selectable per-timer and storable in a preset.

Three are graphical (circle, bar, dots); the fourth is numeric (digits). All four are peers —
equally selectable, equally supported, sharing one renderer interface.

Shared requirements for all three:
- `[MUST]` Depletion is **continuous and smooth**, not stepped per second, except where the
  mode is inherently discrete (dots, digits).
- `[MUST]` Fill the available viewport generously — the visual occupies the majority of the
  screen's short axis.
- `[MUST]` Correct at both extremes: exactly full at start, exactly empty at zero, no
  visual残 remainder or off-by-one pixel at completion.
- `[MUST]` Respect `prefers-reduced-motion` (§8).
- `[MAY]` A "smooth motion" setting that explicitly overrides `prefers-reduced-motion`,
  forcing continuous depletion anyway. Off by default and never implied by any other
  setting — a device's reduced-motion preference exists to protect someone from real
  motion, so overriding it is only ever a deliberate, explicit choice, never a silent one.

#### A. Circle (default)
An unfilling ring or disc, depleting **clockwise from 12 o'clock**, mirroring the analogue
clock face and the physical classroom timers students may already know.

- `[MUST]` Clockwise depletion from top. This direction is not configurable; it matches the
  mental model and inverting it confuses.
- `[MUST]` Rendered as SVG with a stroked circle and animated `stroke-dashoffset`, or an
  equivalent arc path. SVG scales cleanly to any projector resolution.
- `[SHOULD]` Offer ring (stroked outline) and disc (filled pie) as a minor sub-option; the
  disc reads better at distance, the ring is calmer for long durations.
- `[MAY]` Faint tick marks at quarters to aid estimation.

#### B. Bar
A horizontal bar that drains. The most legible option at distance and on wide projectors
with poor contrast.

- `[MUST]` Drains right-to-left (the filled portion shrinks toward the left edge), so the
  remaining quantity sits where reading begins.
- `[MUST]` Spans the full viewport width, with generous height (target ≥ 20% of viewport
  height in full-screen).

#### C. Dots
A grid of large dots that extinguish one at a time. Converts time into a **countable**
quantity — "three dots left" — which is powerful for younger students and for students who
struggle to estimate proportion.

- `[MUST]` Dot count is derived from duration into a sensible range (target 5–30 dots) using
  a fixed ladder of intervals (e.g. 10s, 15s, 30s, 1m, 2m, 5m per dot) so that each dot
  represents a *round* unit of time. A dot must never represent 37 seconds.
- `[MUST]` The interval each dot represents is discoverable by the teacher when choosing the
  mode, since it changes how they narrate it ("one dot per minute").
- `[MUST]` Dots extinguish in reading order (left-to-right, top-to-bottom).
- `[SHOULD]` Grid layout adapts to viewport aspect ratio to keep dots as large as possible.
- `[SHOULD]` The final dot depletes continuously (drains or fades) rather than vanishing, so
  the last interval is not a dead zone.
- `[MAY]` While "smooth motion" (above) is on, dots may instead deplete continuously — as
  either a smooth ring in place of the grid, or every lit dot shrinking to nothing over its
  own equal share of the timer — rather than as discrete countable units. Off by default;
  the discrete grid is what makes dots dots (SPEC §5.3C's opening sentence), so this is an
  explicit opt-in trade of "countable" for "continuous", not the mode's own default character.

#### D. Digits
A full-screen numeric countdown, `MM:SS`, with no graphical depletion. The most precise and
most legible option, and the right choice when exactness matters more than felt duration —
timed assessments, exam conditions, short sharp tasks, and older students.

- `[MUST]` Digits scale to fill the viewport, sized as large as the longest expected string
  allows, so the size does not jump when the display drops from `MM:SS` to `M:SS`.
- `[MUST]` Tabular/monospaced figures, so digits do not shift horizontally as they change.
- `[MUST]` Reserve fixed character cells; the layout must not reflow every second.
- `[SHOULD]` Under 60 seconds, seconds only, at greater size still.
- `[SHOULD]` A minimal secondary depletion cue — for example a thin progress line along one
  edge — so the mode still conveys *proportion* at a glance and not only an exact number. Kept
  subordinate to the digits.
- `[MAY]` Tenths of a second below 10 s. Off by default; it is agitating on a wall for six
  hours a day.

This mode is the deliberate exception to the icons-not-words principle (§1.2). Numerals are
not prose, they are the most compact possible encoding of the exact quantity, and there are
classroom situations where exactness is the requirement.

### 5.4 Numeric readout (overlay)

Distinct from the **Digits** mode of §5.3D: this is a smaller `MM:SS` readout layered over the
three *graphical* modes, for teachers who want both the felt sense of depletion and the exact
number.

- `[MUST]` Toggleable, stored per-preset, available on the circle, bar, and dots modes.
- `[MUST]` Not applicable to the Digits mode, where it would be redundant; the toggle is
  hidden or disabled rather than silently ignored.
- `[MUST]` Positioned so it never obscures the depletion boundary of the active visualization.
- `[MUST]` Clearly subordinate in size to the graphical visual — otherwise the mode has
  effectively become Digits with decoration, and the teacher should just pick Digits.
- `[SHOULD]` Tabular/monospaced figures.

### 5.5 Warning threshold

- `[MUST]` A configurable point at which the display changes to signal "time is nearly up",
  stored per-preset.
- `[MUST]` Configurable as an absolute value (default 60 s) with sensible options; `[SHOULD]`
  also support a percentage for long timers.
- `[MUST]` The warning is conveyed by **colour shift *and* a non-colour cue** (see §8) — the
  visualization adopts the warning palette *and* changes in a second dimension, such as a
  subtle sustained scale or weight change. Never by colour alone.
- `[MUST]` The transition into the warning state is a smooth cross-fade over ~600 ms, not an
  abrupt jump, and not a flash.
- `[MAY]` A second, shorter threshold (e.g. 10 s) with a discrete countdown emphasis.

### 5.6 Completion state

- `[MUST]` Unmistakable without sound and without text. The screen commits fully to the
  finished state — a full-viewport colour field plus a clear completion glyph.
- `[MUST]` The state **persists** until dismissed. It must not auto-clear after a few
  seconds; a teacher facing the class needs to be able to turn around and see it.
- `[MUST]` Any animation on completion is bounded — it settles into a static state within a
  few seconds and does not loop indefinitely. A permanently animating screen is exhausting
  and a distraction hazard.
- `[MUST]` **No flashing above 3 Hz, ever.** This is a photosensitive-epilepsy safety
  requirement, not a stylistic preference (§8).

### 5.7 Sound

Off by default. Sound in a classroom is a decision the teacher makes, not a default we impose.

- `[MUST]` A completion chime, toggleable, with the setting persisted globally (not
  per-preset — a teacher's audio situation is a property of their room, not their activity).
- `[MUST]` **Audio unlock handling.** Browsers block audio playback until a user gesture
  occurs on the page. The audio context is created and unlocked on the *first Start press* of
  each page load. This must be handled explicitly or the chime will silently fail — the
  single most likely "it's broken" bug report this project will receive.
- `[MUST]` If unlock fails, degrade silently to visual-only. Never surface a browser audio
  error to a teacher mid-lesson.
- `[MUST]` Audio assets bundled locally; no CDN, no network fetch at play time.
- `[SHOULD]` Volume control, persisted.
- `[SHOULD]` 2–3 chime options, distinct in character (gentle / neutral / assertive).
- `[MAY]` An optional quiet cue at the warning threshold.

### 5.8 Presets

The feature that turns this from a utility into a daily tool.

- `[MUST]` Create a preset from the current configuration: name, duration, visualization,
  palette, readout on/off, warning threshold.
- `[MUST]` Name is free text, teacher-authored. This is the one place text is unapologetically
  present, and it is the teacher's own language.
- `[MUST]` List, launch, edit, reorder, and delete presets.
- `[MUST]` Deletion requires confirmation. Losing a preset library to a misclick on a
  projector-mirrored display is a real risk.
- `[MUST]` Presets render as large tiles sized for confident clicking on an interactive
  whiteboard with a finger or stylus (§7.3).
- `[SHOULD]` Ship 4–6 sensible starter presets on first run, immediately editable and
  deletable, so the value is visible before any investment.
- `[SHOULD]` Reordering by drag, with a keyboard-accessible alternative.

### 5.9 Storage

Decision: **local only.** `localStorage`, no backend, no accounts, no sync.

Rationale: it removes the login screen from between the teacher and the timer, removes all
student-data-privacy obligations, works on filtered school networks, and costs nothing to
run forever.

- `[MUST]` All persistence via `localStorage` under a single namespaced key.
- `[MUST]` Stored payload carries a **schema version integer**, with a migration path for
  future versions. Presets are user-authored data; silently discarding them on an upgrade is
  a serious failure.
- `[MUST]` Handle `localStorage` being unavailable or full (private browsing, locked-down
  school images) by running fully in memory. The timer works; only persistence is lost, and
  that fact is communicated once, quietly.
- `[MUST]` Corrupt or unparseable stored data must not white-screen the app. Fall back to
  defaults and preserve the corrupt payload under a backup key rather than overwriting it.
- `[SHOULD]` A JSON export / import for teachers moving between the classroom PC and a
  laptop. Deferred to ROADMAP if it competes with v1 polish.

### 5.10 Controls and input

- `[MUST]` Controls: **start, pause, resume, reset**. Pause and resume share one toggle
  affordance.
- `[MUST]` Duration entry: coarse quick-add buttons (e.g. +1m, +5m) plus a precise entry path.
  Optimise for the common case — a whole number of minutes.
- `[MUST]` **Add time while running** (e.g. +1m). Teachers extend timers constantly; without
  this they reset and start over, losing the class's sense of progress.
- `[MUST]` Every control is an icon with an accessible name (§8). Tooltips on hover for
  sighted mouse users; never required for operation.
- `[MUST]` Keyboard shortcuts:

  | Key | Action |
  |---|---|
  | `Space` | Start / pause / resume |
  | `R` | Reset |
  | `F` | Toggle full-screen |
  | `Esc` | Exit full-screen / return to picker |
  | `T` | Toggle numeric readout |
  | `D` | Toggle light / dark |
  | `1` `2` `3` `4` | Switch visualization (circle / bar / dots / digits) |
  | `↑` `↓` | Adjust duration when idle |

- `[MUST]` Shortcuts are discoverable from a help affordance, not memorised blind.
- `[MUST]` Shortcuts are suppressed while a text field (preset name) has focus.

### 5.11 Full-screen / projector mode

- `[MUST]` One-press full-screen via the Fullscreen API, with graceful fallback to a
  maximised in-page layout where the API is blocked.
- `[MUST]` While running, all chrome fades out after 1.5 seconds of pointer
  inactivity and returns on any pointer movement or key press. What remains is the
  visualization and nothing else. Applies in full-screen and in normal windowed
  mode alike, not only full-screen.
- `[MUST]` The layout is designed for **projector aspect ratios** (16:9 and 4:3) and remains
  correct on interactive whiteboards, which are frequently 4:3 or an unusual resolution.
- `[SHOULD]` Attempt to inhibit screen sleep during a running timer via the Screen Wake Lock
  API where supported, degrading silently where not.

### 5.12 Themes and colour

- `[MUST]` Light and dark mode. Default follows `prefers-color-scheme`; the teacher's explicit
  choice overrides and persists.
- `[MUST]` A curated set of palettes. Each palette defines the depletion colour, the remaining
  track colour, the warning colour, and the finished colour, and each is authored and verified
  in **both** light and dark mode. Palettes are not a single hue with automatic derivation —
  that produces unreadable results at projector contrast.
- `[MUST]` Every palette passes the contrast requirements in §8, verified, not assumed.
- `[MUST]` Palette is stored per-preset, so "Silent reading" can be calm blue and "Tidy up"
  can be urgent orange. This is a real pedagogical use of colour — visual coding by activity.
- `[SHOULD]` A custom colour option for teachers matching a school or classroom scheme, with
  a live contrast warning if the chosen colour fails.

### 5.13 Offline

- `[MUST]` A service worker caching the full app shell, so the timer works with no network.
  School Wi-Fi fails; lessons do not stop.
- `[MUST]` A safe update strategy — a new version activates on next load, never mid-timer.
- `[SHOULD]` Installable as a PWA, giving teachers a desktop icon on the classroom PC.

---

## 6. Data model

```jsonc
{
  "schemaVersion": 1,
  "settings": {
    "theme": "system",          // "system" | "light" | "dark"
    "soundEnabled": false,
    "soundId": "gentle",
    "volume": 0.6
  },
  "presets": [
    {
      "id": "uuid",
      "name": "Tidy up",
      "durationSeconds": 180,
      "visualization": "circle", // "circle" | "bar" | "dots" | "digits"
      "palette": "amber",
      "readout": true,              // overlay; ignored when visualization is "digits"
      "warning": { "type": "seconds", "value": 60 },
      "order": 0
    }
  ]
}
```

Rules:
- `schemaVersion` is checked on every load. Unknown *higher* versions are not parsed — the app
  falls back to defaults and preserves the payload rather than corrupting newer data.
- Migrations are pure functions `vN -> vN+1`, applied in sequence, each covered by a test.
- Unknown fields are preserved on round-trip where practical, to survive version mixing across
  a teacher's two machines.

---

## 7. Visual design requirements

### 7.1 The 8-metre test
The binding constraint. Every visualization is verified by projecting it and viewing from the
back of a classroom-sized room. Any element failing to communicate at that distance is either
enlarged or removed. This test outranks aesthetic preference.

### 7.2 Projector reality
Projected images have **washed-out contrast, shifted colour, and elevated black levels**. A
palette that looks refined on a laptop can be invisible on a wall.

- `[MUST]` Depletion colour and track colour differ in **luminance**, not only hue. A design
  distinguishable only by hue disappears on a weak projector and to colour-blind students
  simultaneously.
- `[MUST]` Avoid thin strokes, fine detail, and low-contrast greys in the primary visual.
- `[SHOULD]` Dark mode is likely the better projector default in a lit room; validate rather
  than assume.

### 7.3 Interaction targets
- `[MUST]` Minimum interactive target 48×48 CSS px; preset tiles substantially larger.
- `[MUST]` Generous spacing between destructive and non-destructive controls. Reset must not
  neighbour delete.
- `[MUST]` Usable with a whiteboard stylus or finger, where pointer precision is poor.

### 7.4 Iconography
- `[MUST]` Conventional, unambiguous symbols: triangle for play, double bar for pause, circular
  arrow for reset, expand arrows for full-screen.
- `[MUST]` Every icon carries an accessible name and a hover tooltip. Icon-only is a *visual*
  minimalism goal, never a reason for an unlabelled control in the accessibility tree.
- `[MUST]` Single consistent icon set, bundled as inline SVG. No icon font, no CDN.

### 7.5 Motion
- `[MUST]` Continuous depletion, no perceptible stepping.
- `[MUST]` No looping animation during the running state.
- `[MUST]` Transitions between states are brief and purposeful (≤ 600 ms).

---

## 8. Accessibility and safety

Non-negotiable. A classroom of thirty students reliably includes students affected by every
item below.

- `[MUST]` **No flashing between 3 Hz and 55 Hz at any point**, including the completion
  state. Photosensitive epilepsy is the highest-severity risk this project carries, and a
  full-screen projected image is the worst possible delivery vector. Encoded as an explicit
  test/review checklist item, not left to reviewer memory.
- `[MUST]` **Never encode meaning in colour alone.** Warning and finished states are each
  distinguishable by a second channel — shape, glyph, size, or fill pattern. Verified against
  deuteranopia, protanopia, and tritanopia simulation.
- `[MUST]` Contrast: primary visual elements meet or exceed WCAG 2.2 AA (3:1 for large
  graphical objects; 4.5:1 for any text), in both themes, for every shipped palette.
- `[MUST]` Full keyboard operability, visible focus indicators, logical focus order.
- `[MUST]` Timer state exposed to assistive technology via a polite live region, announcing
  state changes (started, paused, finished) — not every second.
- `[MUST]` Honour `prefers-reduced-motion`: depletion becomes stepped (e.g. per second) with
  no easing, transitions become instant, all decorative motion is removed. The timer remains
  fully functional — reduced motion is not a degraded mode. The one exception is the explicit
  "smooth motion" setting (§5.3), which a teacher must turn on themselves — the device's own
  preference is never overridden implicitly.
- `[MUST]` Respect `prefers-contrast` where supported.
- `[SHOULD]` Verified with at least one screen reader before v1.
- `[SHOULD]` Text scales with user font-size settings without breaking layout.

### 8.1 Privacy
- `[MUST]` No analytics, no telemetry, no third-party scripts, no fonts loaded from a CDN, no
  network requests at runtime. Self-host everything.
- `[MUST]` No cookies. `localStorage` holds only teacher-authored configuration — no personal
  data, and never any student data.
- `[MUST]` This posture is stated plainly in the README, because a teacher may need to justify
  the tool to a school IT or safeguarding lead. Being trivially approvable is a feature.

---

## 9. Technical architecture

### 9.1 Stack
- **Static site.** No server, no runtime backend.
- **TypeScript**, for the maintainability the project requires.
- **Vite** for build and dev server.
- **No UI framework in v1** unless justified. The app is a state machine and three renderers;
  a framework adds dependency churn without solving a problem here. Revisit only if the preset
  management UI proves genuinely painful.
- **SVG** for the circle and dots; CSS transforms for the bar; plain scaled DOM text for
  digits. Canvas is unnecessary at this complexity and costs crispness and accessibility.
- Dependencies are kept minimal and each one justified in `docs/ARCHITECTURE.md`. Every
  dependency is a future breakage.

### 9.2 Module boundaries

```
src/
  core/
    clock.ts          Deadline-based time source; the only place time is read
    timer.ts          State machine; pure, no DOM
    presets.ts        CRUD over the preset collection; pure
    storage.ts        localStorage adapter, versioning, migrations, safe fallback
    audio.ts          Chime playback, unlock handling, silent degradation
  views/
    circle.ts         ┐
    bar.ts            ├ Each takes { remaining, total, state, palette } and renders
    dots.ts           │
    digits.ts         ┘
    readout.ts        Overlay readout for the three graphical modes
  ui/
    controls.ts       Icon controls, keyboard bindings
    presetList.ts     Preset tiles, edit and delete flows
    theme.ts          Light/dark, palette application
    fullscreen.ts     Fullscreen API, chrome auto-hide, wake lock
  main.ts
```

Key constraint: **`core/` is pure and DOM-free.** It is unit-testable without a browser, and
it is where correctness lives. Views are dumb renderers that receive state and draw. All four
visualizations implement the same interface, so a new one is a single new file in `views/` —
that is the extension point, and it should stay cheap.

### 9.3 Repository layout

```
/
  index.html
  src/
  public/
    icons/  sounds/  robots.txt  manifest.webmanifest
  docs/
    SPEC.md  ROADMAP.md  ROBOTS.md  CONTRIBUTING.md  CHANGELOG.md
    ARCHITECTURE.md  DEPLOYMENT.md  TESTING.md  ACCESSIBILITY.md
    adr/  0001-*.md …
  tests/
  .github/workflows/deploy.yml
  README.md  LICENSE
```

Only `README.md` and `LICENSE` sit at the repository root, alongside the
project's config files — every other document lives under `docs/`, including
this one. GitHub still finds `docs/CONTRIBUTING.md` for its own tooling
(issue/PR banners, the "Contribute" link): `root`, `docs/`, and `.github/` are
all recognised locations for that file.

---

## 10. Hosting and deployment

Decision: **GitHub Pages.**

Rationale: free with no expiry and no credit card, deploys on push with no external service to
outlive, and — importantly for this audience — trivially forkable. Another teacher who can use
GitHub can have their own copy, in their school's colours, in ten minutes.

Requirements:
- `[MUST]` GitHub Actions workflow: on push to `main`, install, test, build, deploy to Pages.
- `[MUST]` The deploy fails closed if tests fail. A broken timer on a classroom wall is worse
  than a stale one.
- `[MUST]` `DEPLOYMENT.md` documents deployment end-to-end **for someone who has never done
  it**: fork, enable Pages, set the source to Actions, push, done. Written for a technically
  curious teacher, not for a DevOps engineer.
- `[MUST]` Correct base path handling for project-pages URLs (`/repo-name/`), which is the
  most common first-deploy failure.
- `[MUST]` Local development is `npm install && npm run dev`. Nothing more.
- `[SHOULD]` Custom domain instructions, including the `CNAME` file and DNS records.
- `[SHOULD]` A documented one-command local production preview before deploying.
- `[SHOULD]` Document Cloudflare Pages and Netlify as alternatives in a few lines each — the
  app is static, so it deploys anywhere, and saying so lowers the barrier for forks.

---

## 11. Quality

### 11.1 Testing
- `[MUST]` Unit tests for `core/` — state machine transitions, deadline arithmetic across
  pause/resume, storage migrations, dot-interval derivation. These are the parts that can be
  *silently* wrong.
- `[MUST]` A test asserting no drift over a long simulated run with a mocked clock.
- `[MUST]` Tests for storage failure modes: unavailable, full, corrupt, future schema version.
- `[SHOULD]` End-to-end smoke test: load, start, pause, resume, finish.
- `[SHOULD]` Automated accessibility check (e.g. axe) in CI.
- `[MUST]` A manual pre-release checklist in `docs/TESTING.md` covering the things automation
  cannot judge: the 8-metre test, real projector verification, colour-blind simulation, the
  flash-rate check, and behaviour after machine sleep.

### 11.2 Browser support
- `[MUST]` Current Chrome, Edge, Firefox, Safari.
- `[MUST]` **Chromebooks**, including older ones — a large share of the real audience.
- `[SHOULD]` Interactive whiteboard embedded browsers, which are often outdated. Feature-detect
  and degrade; never assume the newest APIs.

### 11.3 Performance
- `[MUST]` Loads and is interactive in under 2 seconds on a low-end Chromebook on school Wi-Fi.
- `[MUST]` Sustains 60 fps depletion on that same hardware; degrade update frequency rather
  than drop frames visibly.
- `[MUST]` Total initial payload under 200 KB excluding audio.
- `[MUST]` No memory growth over a full school day of repeated timers.

---

## 12. Documentation set

Docs are a deliverable, not an afterthought. Each has one job:

| File | Purpose |
|---|---|
| `README.md` | What it is, a live link, a screenshot, quick start, privacy statement |
| `docs/SPEC.md` | This document — what the product is and why |
| `docs/ROADMAP.md` | What is planned, what was deferred, and what is refused |
| `docs/ROBOTS.md` | Guidance for AI coding agents working in this repo (§12.1) |
| `docs/CONTRIBUTING.md` | Setup, conventions, PR expectations, the a11y checklist |
| `docs/CHANGELOG.md` | Keep a Changelog format, semantic versioning |
| `docs/ARCHITECTURE.md` | Module map, state machine, why each dependency exists |
| `docs/DEPLOYMENT.md` | Deploy your own copy, written for non-specialists |
| `docs/TESTING.md` | Automated suites plus the manual pre-release checklist |
| `docs/ACCESSIBILITY.md` | Commitments, verification method, known gaps |
| `docs/adr/` | Numbered decision records for choices future maintainers will question |
| `public/robots.txt` | Crawler directives (distinct from `docs/ROBOTS.md`) |
| `LICENSE` | Permissive (MIT), so schools and teachers can fork freely |

Only `README.md` and `LICENSE` are exceptions to the `docs/` rule above —
both are expected at the repository root by convention (GitHub renders
`README.md` as the repo home page from there, and licence detection looks at
the root) — everything else lives under `docs/`.

ADRs to write at minimum: local-only storage; no UI framework; GitHub Pages; clockwise circle
depletion; four visualizations rather than more.

### 12.1 ROBOTS.md
Instructions for AI agents contributing to this repo — the constraints that are invisible in
the code and easy to violate:

- The classroom is the reason for every decision; features that do not serve a teacher running
  a transition do not belong.
- Text in the interface requires justification. Do not "improve clarity" by adding labels.
- The accessibility and photosensitivity rules in §8 are hard requirements, never traded for
  visual appeal.
- No new runtime dependencies without an ADR.
- No analytics, telemetry, or third-party network requests, in any form, ever.
- Storage schema changes require a migration and a test.
- The non-goals in §1.3 have been decided. Do not reopen them in a pull request.

---

## 13. Success criteria

v1 is successful when:

1. A teacher who has never seen the tool starts a correctly configured timer in under 30
   seconds, unaided.
2. A saved preset reaches a running full-screen timer in two clicks.
3. All four visualizations pass the 8-metre test on a real projector in a real, lit classroom.
4. The app functions fully with no network connection.
5. A teacher with a GitHub account deploys their own copy using only `DEPLOYMENT.md`.
6. No student data is collected — verifiable by reading the source.
7. A teacher uses it daily for a term without touching the settings again.

---

## 14. Assumptions and open questions

**Assumptions made in this draft** (correct any that are wrong):

- **A1.** Four visualization modes, confirmed by the user, superseding an initial target of
  three: circle, bar, dots, digits (§5.3). The separate overlay readout (§5.4) remains, since
  "graphical plus a small number" and "the number, full-screen" are genuinely different
  choices a teacher makes for different activities.
- **A2.** Single teacher per browser profile. No multi-user switching.
- **A3.** English only for v1; strings are centralised so localisation stays cheap.
- **A4.** MIT licence.

**Open questions:**

1. **Dot intervals** — should the teacher choose the interval per dot directly ("one dot per
   minute") rather than choosing a duration and receiving a derived dot count? The former
   matches how a teacher would narrate it aloud, and may be the better model.
2. **Warning threshold default** — is 60 s right across a 30-second timer and a 40-minute
   timer? A percentage-based default may behave better at the extremes.
3. **Age range** — is the primary audience early years, primary, or secondary? It shifts the
   default visualization (dots read better for younger students) and the visual tone.
4. **Sound in practice** — is a chime usable in your setting at all, given that the classroom
   PC's audio is often routed to the projector or muted entirely? If it is rarely usable, the
   warning-threshold visual carries more weight and deserves more design attention.
5. **Preset export** — does moving presets between the classroom PC and a personal laptop
   matter enough for v1, or is it genuinely a ROADMAP item?
