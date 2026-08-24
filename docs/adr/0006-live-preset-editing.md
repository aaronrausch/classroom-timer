# 6. Live preset editing, not a modal form

## Status
Accepted

## Context
The original preset editor was a `<dialog>` form: click the pencil on a tile,
fill in name/length/display/colour/numbers/warn-at fields, click Save. Nothing
in that form was reflected on the stage until the moment Save was pressed —
choosing a colour meant reading its name or a small swatch, not seeing it on
the actual ring the class would look at.

Duration, visualization and the numeric readout, meanwhile, were already
live-editable from the main toolbar at all times, entirely independent of the
preset system. That left two competing mental models in the same app: "the
timer currently on screen" and "the preset I'm editing in a dialog" were
different things that happened to share most of their fields.

## Decision
Collapse them into one. The sidebar's **Current Timer** panel
(`src/ui/sidebar.ts`) is not a form — it is a live view onto the same
`WorkingConfig` object in `src/main.ts` that the toolbar already edits and the
render loop already reads every frame. Changing a colour swatch there repaints
the stage on the next frame, the same way dragging the duration up already
did.

Only three fields moved into this panel: **name**, **colour**, and **warning
threshold**. Duration, visualization, and the readout toggle stay exactly
where they were, on the toolbar — see the doc comment on
`CurrentTimerFields` in `src/ui/sidebar.ts`. Duplicating them into the sidebar
too would have created two places to change the same value with no way to
keep them in sync; the fields that moved were exactly the ones that had *no*
live home before this.

A tile's pencil icon now means "load this preset into the Current Timer panel
and onto the stage, idle, without starting it" (`editPreset` in
`src/main.ts`) rather than "open a form describing it". Saving is either
**Update** (overwrite the loaded preset) or **Save as new** (create another),
both operating on whatever is currently live — see `PresetList.saveAsNew` /
`updateExisting` in `src/ui/presetList.ts`.

## Consequences

**Why this is right:**
- "See changes as you make them" was the actual complaint this fixes: a
  colour choice, a warning threshold, a name — all visible on the real stage
  before committing to anything.
- One thing to reason about instead of two. `WorkingConfig` is now
  unambiguously "the timer that is either running or about to be", whether it
  got there by launching a preset, editing one, or being built from scratch.
- The one-click launch path (SPEC §4.2, §13) is untouched and stays a
  separate function (`launch`) from editing (`editPreset`) — clicking a
  tile's body still starts it immediately in full screen; only the pencil
  loads it for editing instead.

**What this costs:**
- A preset's full field set is now split across two locations (the toolbar
  and the sidebar) rather than one form. This is deliberate (see above) but
  is a real departure from "everything in one dialog", and is worth
  reconsidering if a sixth editable field ever needs a home — it should go
  wherever it is *live*, not back into a form.
- Deleting a loaded preset needs an explicit disabled-while-pending guard on
  the Delete button (`src/ui/sidebar.ts`) to stop a fast double-click from
  opening two stacked confirm dialogs — a small extra piece of state a modal
  submit handler didn't need to think about.
