# Classroom Timer

A full-screen visual countdown timer for a classroom projector or interactive
whiteboard. No accounts, no network calls, no student data — it works offline
and stores nothing but the timers you save, in your own browser.

**[Live demo →](#)** _(update this link after your first deploy — see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md))_

![Classroom Timer showing a circle countdown](docs/screenshot.png)
_(add a screenshot here once you have one — see the note in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md))_

## What it is

A teacher has 25 seconds to put a timer on the wall and get back to teaching.
This app is built around exactly that moment: two clicks from a saved preset
to a running, full-screen timer, legible from the back of the room.

- **Four visualizations** — circle, bar, dots, digits — each verified against
  the "8-metre test": readable from the back row without reading a single
  word.
- **Presets** — save a duration, visualization, colour and warning threshold
  under a name you choose. "Tidy up" and "Silent reading" become one click.
- **Nothing to log into.** No backend, no accounts, no analytics, no
  third-party scripts. It runs on a filtered school network and works
  offline once loaded.
- **Accessible by default** — full keyboard operation, no flashing above 3 Hz,
  colour is never the only signal, and `prefers-reduced-motion` is honoured.

See [SPEC.md](docs/SPEC.md) for the full product specification and the
reasoning behind every decision above.

## Quick start

```bash
npm install
npm run dev
```

Open the printed local URL. That's it — no environment variables, no backend
to run alongside it.

## Deploying your own copy

Free, and takes about ten minutes with no prior experience. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for a full walkthrough (GitHub Pages
by default; Netlify and Cloudflare Pages both work too, since this is a
static site).

## Privacy

This app collects nothing. There is no analytics, no telemetry, no
third-party script of any kind, and no network request at runtime beyond
loading the page once. `localStorage` holds only the timers and settings you
create yourself — never anything about a student. See
[docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) and §8.1 of
[SPEC.md](docs/SPEC.md) for the full commitment. This is deliberately easy to
verify by reading the
source: `src/core/` never imports anything network-related, and
`public/sw.js` only ever reads from its own cache.

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for setup, conventions and the
accessibility checklist every change is expected to pass. If you are an AI
coding agent working in this repository, read [ROBOTS.md](docs/ROBOTS.md)
first — it documents constraints that are easy to miss from the code alone.

## Documentation

Everything beyond this file lives in [docs/](docs/):

| File | What's in it |
|---|---|
| [docs/SPEC.md](docs/SPEC.md) | The product specification — what this is and why |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What's planned, deferred, or deliberately refused |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Setup, conventions, the a11y checklist |
| [docs/ROBOTS.md](docs/ROBOTS.md) | Guidance for AI agents working in this repo |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Module map, state machine, dependency rationale |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deploy your own copy, step by step |
| [docs/TESTING.md](docs/TESTING.md) | Automated suite plus the manual pre-release checklist |
| [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) | Commitments, how they're verified, known gaps |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Keep a Changelog format, semantic versioning |
| [docs/adr/](docs/adr/) | Numbered decision records for the choices worth explaining |

## License

MIT — see [LICENSE](LICENSE). Fork it, put it in your school's colours, and
run it forever.
