# 2. No UI framework

## Status
Accepted — revisit if the trigger condition below is met.

## Context
The app has interactive state (a timer, a list of presets, a settings panel)
that a framework like React or Vue would normally manage. But the actual
surface area is small: one state machine, four renderers behind a shared
interface, and a preset list with basic CRUD.

## Decision
Hand-write the DOM layer in TypeScript, with `core/` kept pure and DOM-free
so the framework choice (or absence of one) never touches correctness. See
`docs/ARCHITECTURE.md` for the module boundaries this depends on.

## Consequences

**Why this is right for now:**
- Every dependency is a promise to keep updating it for as long as the
  project exists (see `ROBOTS.md`). A framework is the single largest such
  promise available, for a project that explicitly wants to still deploy
  cleanly in five years (SPEC §1.2, principle 6).
- The actual UI complexity here — four view swaps, a preset list, a settings
  panel — does not need a framework's data-binding to stay manageable. The
  `Visualization` interface in `src/views/types.ts` already gives the four
  renderers a clean, framework-free extension point.
- It keeps the total bundle small, which matters directly for SPEC §11.3
  (under 200 KB, interactive in under 2 seconds on a low-end Chromebook).

**What this costs:**
- More manual DOM wiring than a framework would provide, particularly in
  `src/ui/presetList.ts` and `src/ui/sidebar.ts`.
- No framework-provided component reuse patterns — the small helpers in
  `src/ui/sidebar.ts` (`choiceRow`, `toggleButton`) exist because of this.

## Revisit if
Preset and settings management grows enough state-synchronisation complexity
that hand-written DOM wiring becomes genuinely error-prone rather than
merely more verbose. That has not happened as of this writing.
