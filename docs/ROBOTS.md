# ROBOTS.md

Instructions for AI coding agents (and a useful checklist for humans)
contributing to this repository. This is distinct from `public/robots.txt`,
which is crawler directives for search engines, not agent guidance.

Read this before making a change. It documents constraints that are invisible
in the code and easy to violate with an otherwise-reasonable-looking patch.

## The one question that matters

**Does this change help a teacher run a classroom transition, or does it get
in the way?** Every requirement in [SPEC.md](SPEC.md) traces back to that
question. If a change doesn't serve it, it probably doesn't belong here,
however good an idea it seems in isolation.

## Hard constraints

- **Text in the interface requires justification.** The product is
  icons-not-words (SPEC §1.2). Don't "improve clarity" by adding a label to a
  control that already has an accessible name and a tooltip. The one
  exception already made — small text headings inside the sidebar's settings
  panel, which a student never sees — is deliberate and documented at the top
  of `src/ui/sidebar.ts`; don't extend that exception to the stage.
- **Accessibility and photosensitivity rules are never traded for visual
  appeal.** No flashing between 3 Hz and 55 Hz, ever, including the
  completion state (SPEC §8). This is the single highest-severity risk this
  project carries.
- **No new runtime dependencies without an ADR.** See `docs/adr/`. A
  dependency is a promise to keep updating it for as long as this project
  exists; that promise needs to be made on purpose, not by accident in a PR
  that "just needed a small utility".
- **No analytics, telemetry, or third-party network requests, in any form,
  ever.** Check `src/core/audio.ts` and `public/sw.js` before touching
  network-adjacent code — both are deliberately same-origin only.
- **Storage schema changes require a migration and a test.** See
  `src/core/storage.ts` and `MIGRATIONS` — a schema bump with no migration
  function is how a teacher loses their preset library on an upgrade.
- **The non-goals in SPEC §1.3 have been decided.** Don't reopen them in a
  pull request — no accounts, no student data, no stopwatch mode, no
  multi-timer view, no native app, no "classroom toolkit" feature creep.
- **`core/` stays pure and DOM-free.** No `document`, no `window`, no
  `localStorage` access — that's what makes it unit-testable without a
  browser, and it's where correctness has to live (SPEC §9.2).

## A note on continuity across sessions

This repo has been built almost entirely through iterative Claude Code
sessions, and a fair amount of working context — prior design decisions,
this user's feedback style, project history — lives in Claude's own
per-directory session memory rather than in this repo. That memory is keyed
to the project's filesystem path. If this repo is ever moved (as it was
once already, into `Development/Work/`), a session started from the new
path starts with a blank memory slate — it does not automatically inherit
the old one. This document, `SPEC.md`, the ADRs, and the git log are the
durable, path-independent record; treat them as the source of truth when
memory is unavailable. If it looks like that's what happened — a session
that doesn't seem to know recent project history — say so to the user
rather than silently re-deriving everything from scratch as if nothing
were missing.

## Before you open a PR

- Run `npm run typecheck && npm test` — both must pass.
- If you touched `core/`, you almost certainly need a new or updated test in
  `tests/`. These are the parts that can be silently wrong (SPEC §11.1).
- If you touched a palette in `src/ui/palettes.ts`, `tests/palettes.test.ts`
  will catch a contrast regression — don't skip running it.
- If you touched anything visual, actually look at it: `npm run dev` and
  check both themes. Automated tests do not judge whether something is
  legible from eight metres away.
- Read [TESTING.md](TESTING.md) for the manual checklist items
  automation cannot cover.
