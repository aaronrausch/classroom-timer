# Roadmap

What's planned, what's deferred, and what's been decided against. Written so
a contributor — human or AI — doesn't have to re-litigate a decision that's
already been made. See [SPEC.md §1.3](SPEC.md#13-non-goals) for the full list
of non-goals and the reasoning behind them.

## Deferred (plausible for a later version)

- **JSON export / import for presets.** Moving a preset library between a
  classroom PC and a personal laptop. Deferred from v1 to keep the surface
  area small; revisit if it turns out to matter more than expected. SPEC §5.9.
- **Automatic transition chaining.** Running a sequence of presets back to
  back (e.g. a full station rotation) without returning to the picker between
  each one. v1 requires a manual return to the picker; see SPEC §4.3.
- **A second, shorter warning threshold** (e.g. a discrete 10-second
  countdown emphasis layered on top of the main warning state). SPEC §5.5.
- **Custom colour palettes** with a live contrast check, for a school wanting
  its own colours rather than the shipped set. SPEC §5.12.
- **Localisation.** Strings are already centralised (SPEC assumption A3), so
  this is mechanically cheap when there's a real translator, but v1 ships
  English only.

## Explicitly refused

These were considered and rejected. Don't reopen them without a new SPEC
discussion — see [SPEC.md §1.3](SPEC.md#13-non-goals) and
[ROBOTS.md](ROBOTS.md).

- **User accounts, cloud sync, any server-side state.** The whole point is
  that a teacher never logs into anything.
- **Any collection of student data, ever, in any form.**
- **Stopwatch / count-up mode.** This is a countdown timer.
- **Multiple simultaneous timers on one screen.** One timer, one decision,
  one glance.
- **Native mobile apps.** The web app installs as a PWA; a native wrapper
  would duplicate the whole app for no real gain.
- **Analytics, telemetry, or any third-party script.**
- **Class lists, randomisers, noise meters, or other "classroom toolkit"
  features.** This is a timer, not a suite. Feature creep here is the single
  easiest way to ruin what makes this useful.

## Open questions

Carried over from [SPEC.md §14](SPEC.md#14-assumptions-and-open-questions).
Anyone picking these up should update SPEC.md with the answer, not just
change the code silently:

1. Should a teacher choose the dot interval directly ("one dot per minute")
   rather than a duration with a derived dot count?
2. Is a 60-second warning default right across the full duration range, or
   should the default itself scale (e.g. as a percentage) for very short and
   very long timers?
3. What's the primary age range this ships for? It shifts the sensible
   default visualization (dots read better young) and the overall tone.
4. How usable is a chime in a real classroom's audio setup, given that PC
   audio is often routed to the projector or muted? If rarely usable, the
   warning-threshold *visual* deserves more design attention than it has now.
