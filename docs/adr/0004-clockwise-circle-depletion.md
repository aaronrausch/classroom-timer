# 4. Clockwise circle depletion, not configurable

## Status
Accepted

## Context
The circle visualization (SPEC §5.3A) needs a direction to deplete in. The
obvious candidates are clockwise or anticlockwise, and it would be easy to
make this a per-preset option.

## Decision
Clockwise from 12 o'clock, always. Not exposed as a setting. See the
implementation notes in `src/views/circle.ts`, which also documents the SVG
dash-arithmetic trick used to draw it exactly (no arc-path special cases at
the full or empty extremes).

## Consequences

**Why this is right:**
- It mirrors the analogue clock face and the physical wind-up classroom
  timers many students already have a mental model for. Matching an existing
  mental model is worth more than a configuration option here.
- Consistency across every classroom using this app matters more than
  personal preference: a student moving between classrooms (or years) should
  never have to re-learn which direction "time passing" reads as.
- Removing the option removes a whole category of "why does the timer in my
  room work differently" support question.

**What this costs:** A teacher who has a strong preference for the reverse
direction cannot change it. Given the reasoning above, this is considered a
feature, not a gap — see SPEC §5.3A: "This direction is not configurable;
it matches the mental model and inverting it confuses."
