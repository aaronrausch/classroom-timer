# 3. GitHub Pages for hosting

## Status
Accepted

## Context
The app is a static site (see ADR 0001, ADR 0002) and needs somewhere to be
hosted that a teacher — not a DevOps engineer — can set up and, critically,
that another teacher can fork and redeploy themselves.

## Decision
GitHub Pages, deployed via GitHub Actions on every push to `main`. See
`.github/workflows/deploy.yml` and `docs/DEPLOYMENT.md`.

## Consequences

**Why this is right:**
- Free, with no expiry and no credit card, which matters for a tool aimed at
  individual teachers rather than a school's IT budget.
- Deploys on push, with no external service (a Vercel/Netlify account, a
  cloud provider) that could itself disappear or start requiring payment.
- Trivially forkable: another teacher who can use GitHub can have their own
  copy, in their school's colours, in about ten minutes — see
  `docs/DEPLOYMENT.md`. This directly serves SPEC §13's success criterion
  that "a teacher with a GitHub account deploys their own copy using only
  DEPLOYMENT.md."
- The deploy fails closed: tests and type-checking run before the build, so
  a broken change cannot reach a classroom wall (SPEC §10).

**What this costs:**
- GitHub Pages project sites are served from a subpath
  (`/<repo-name>/`), which is the most common first-deploy failure for any
  static site host of this kind. Handled explicitly via the `BASE_PATH`
  environment variable computed in the deploy workflow and read in
  `vite.config.ts` — see the comment there.
- Requires a GitHub account, which is an assumption about the audience (SPEC
  §13 makes this assumption explicit rather than hiding it).

**Alternatives considered:** Netlify and Cloudflare Pages both work equally
well for this static site and are documented as one-paragraph alternatives in
`docs/DEPLOYMENT.md`, specifically so the project doesn't lock a forker into
GitHub if they'd rather not use it.
