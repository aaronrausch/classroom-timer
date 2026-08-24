# 1. Local-only storage, no backend

## Status
Accepted

## Context
A teacher needs their saved timers to persist between visits. The obvious
options are a backend with accounts, or something purely client-side.

## Decision
Store everything in `localStorage`, in the browser, with no server and no
accounts. See `src/core/storage.ts`.

## Consequences

**Why this is right for this product:**
- It removes the login screen from between a teacher and the timer, which
  directly serves the core scenario in SPEC §1.1: 25 seconds of attention,
  no account to remember.
- It removes every student-data-privacy obligation a backend would create —
  there is no server that could ever see a student, because there is no
  server.
- It works on a school network with aggressive filtering, and works offline.
- It costs nothing to run, indefinitely, with no infrastructure to maintain
  or eventually shut down.

**What this costs:**
- No sync between devices. A teacher's presets on the classroom PC don't
  automatically appear on a personal laptop. Mitigated by the (currently
  deferred) JSON export/import — see `ROADMAP.md`.
- Data can be lost if browser storage is cleared, or is simply unavailable in
  some environments (locked-down school images, private browsing). Handled
  explicitly, not ignored: the app runs fully in memory when storage is
  unavailable, and a corrupt payload is quarantined under a backup key rather
  than silently discarded — see the failure-mode handling in
  `src/core/storage.ts` and its tests.
