# Contributing

## Setup

```bash
git clone <your fork>
cd classroom-timer
npm install
npm run dev
```

No environment variables, no backend, no account to sign up for. If
`npm install` and `npm run dev` don't get you a running app, that's a bug in
this document or the project — please open an issue.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server with hot reload |
| `npm run build` | Type-checks, then produces a production build in `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Runs the automated test suite once |
| `npm run test:watch` | Test suite in watch mode |
| `npm run gen:assets` | Regenerates the bundled chimes and PWA icons (`scripts/`) |

## Before opening a pull request

1. `npm run typecheck && npm test` — both clean.
2. If you touched `src/core/`, add or update a test in `tests/`. This is
   where correctness has to be provable, not just plausible — see
   [ARCHITECTURE.md](ARCHITECTURE.md).
3. If the change is visible, run it in a browser in both light and dark
   theme. See the manual checklist in [TESTING.md](TESTING.md) —
   automated tests can't judge legibility from the back of a room.
4. If you're an AI agent, read [ROBOTS.md](ROBOTS.md) first.

## Accessibility checklist

Every change that touches the stage (the visualizations, the completion
state, the warning transition) must be checked against these before merging.
They are hard requirements, not suggestions — see SPEC §8.

- [ ] No flashing between 3 Hz and 55 Hz, anywhere, including the completion
      state.
- [ ] Nothing is communicated by colour alone — check with a colour-blindness
      simulator (deuteranopia, protanopia, tritanopia) if you touched a
      palette or a warning/finished state.
- [ ] Contrast holds: 3:1 for graphical objects, 4.5:1 for any text, in both
      themes. `tests/palettes.test.ts` checks the shipped palettes
      automatically; check custom colours by hand.
- [ ] Full keyboard operability, with a visible focus indicator, in a logical
      order.
- [ ] `prefers-reduced-motion: reduce` leaves the timer fully functional —
      not a degraded mode, just a differently-animated one (stepped
      depletion, no easing).
- [ ] A screen reader announces state changes (started, paused, finished) —
      not every second.

## Conventions

- TypeScript, strict mode. No `any` without a comment explaining why it's
  unavoidable.
- `core/` never touches the DOM. If a function in `src/core/` needs
  `document` or `window`, it belongs in `src/ui/` or `src/views/` instead.
- Comments explain *why*, not *what*. If removing a comment wouldn't confuse
  a future reader, don't write it.
- No new runtime dependency without an ADR in `docs/adr/` (see
  [ROBOTS.md](ROBOTS.md)).

## Commit messages

Plain, descriptive, imperative mood ("Fix dot grid padding", not "Fixed" or
"Fixes"). No fixed format is enforced beyond that.
