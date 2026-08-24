# Deployment

Written for a technically curious teacher, not a DevOps engineer. If you can
create a GitHub account and click buttons in a settings page, you can deploy
your own copy of this timer in about ten minutes.

## Option A: GitHub Pages (recommended, free, no card required)

### 1. Fork the repository

Click **Fork** at the top of the GitHub page for this project. This gives you
your own copy at `github.com/<your-username>/<repo-name>`.

### 2. Enable GitHub Pages

In your fork, go to **Settings → Pages**. Under **Build and deployment**, set
**Source** to **GitHub Actions**. That's the whole configuration step — the
included workflow (`.github/workflows/deploy.yml`) does the rest.

### 3. Push to `main`

If you haven't changed anything yet, an empty commit will do it:

```bash
git commit --allow-empty -m "Trigger first deploy"
git push
```

Watch the **Actions** tab in your repository. When the workflow finishes, the
**Pages** settings page will show your live URL — typically
`https://<your-username>.github.io/<repo-name>/`.

### 4. The one thing that trips people up: the base path

GitHub Pages serves a forked project from a *subpath*
(`/<repo-name>/`), not the domain root. This project handles that
automatically: the deploy workflow sets a `BASE_PATH` environment variable
from the repository name before building, and `vite.config.ts` reads it. You
don't need to edit anything for the default case.

If you rename the repository, or point a custom domain at it (see below), the
base path changes — see the workflow file for exactly where it's computed.

## Local development

```bash
npm install
npm run dev
```

Nothing else. No environment variables, no `.env` file, no backend to start
alongside it.

## A local production preview before deploying

```bash
npm run build
npm run preview
```

This serves the exact static output that will be deployed, so you can catch
anything that only shows up in a production build (unminified-vs-minified
behaviour, base-path issues) before it's live.

## Custom domain

1. Add a `public/CNAME` file containing just your domain, e.g.:
   ```
   timer.yourschool.org
   ```
2. At your DNS provider, add a `CNAME` record pointing your subdomain at
   `<your-username>.github.io`. For an apex domain, use GitHub's documented `A`
   records instead — see
   [GitHub's own custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
   for the current IP addresses.
3. With a custom domain, the site is served from the domain root, not a
   subpath — set `BASE_PATH` to `/` for the build (see the workflow file).

## Alternatives

This is a static site with no server-side requirement, so it deploys
anywhere that serves static files. Two options in a few lines each:

- **Cloudflare Pages** — connect the repository, build command
  `npm run build`, output directory `dist`. Cloudflare Pages serves from the
  domain root by default, so set `BASE_PATH=/` (or leave it unset — that's
  the default in `vite.config.ts`).
- **Netlify** — same build command and output directory. Also serves from
  the root by default.

## The deploy fails closed

The GitHub Actions workflow runs the test suite before building, and the
build step type-checks first (`npm run build` runs `tsc --noEmit` before
`vite build`). A failing test or a type error stops the deploy — a broken
timer on a classroom wall is worse than a stale one (SPEC §10).
