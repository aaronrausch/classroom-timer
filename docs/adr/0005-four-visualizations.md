# 5. Four visualizations, not fewer or more

## Status
Accepted

## Context
The project started with a target of three visualizations (circle, bar,
digits). A fourth, dots, was added during specification because it serves a
genuinely different need: time as a *countable* quantity rather than a
proportion, which reads better for younger students and for anyone who finds
proportional area or arc length hard to estimate. See SPEC §14, assumption
A1.

## Decision
Ship exactly four: circle, bar, dots, digits (SPEC §5.3). Each implements the
same `Visualization` interface (`src/views/types.ts`), so a fifth is
mechanically cheap to add later — but the bar for adding one is "serves a
genuinely different situation," not "looks nice."

## Consequences

**Why four, not fewer:** Each of the four serves a use case none of the
others do well —
- circle: the default, general-purpose case, matching physical classroom
  timers;
- bar: the most legible at distance and on a low-contrast projector;
- dots: a countable rather than proportional read, and the interval-per-dot
  narration ("one dot per minute") is a genuinely different pedagogical tool;
- digits: the deliberate exception to icons-not-words, for when exactness
  (timed assessments, exam conditions) matters more than felt duration.

**Why not more:** Every additional mode is an additional thing to keep
legible at eight metres (SPEC §7.1), keep accessible (SPEC §8), keep
consistent across two themes and six palettes, and an additional choice a
teacher has to make when they just want a timer running. SPEC §1.3 rules out
"classroom toolkit" feature creep generally; the same discipline applies to
visualization modes specifically. A proposed fifth mode should be held to the
same bar the existing four were: does it serve a *distinct* situation, not
merely a different taste.
