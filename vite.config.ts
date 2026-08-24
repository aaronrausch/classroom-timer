import { defineConfig } from 'vite';

// GitHub Pages project sites are served from /<repo-name>/. The deploy workflow
// sets BASE_PATH accordingly; local dev and user/organisation pages use "/".
// Getting this wrong is the most common first-deploy failure (SPEC §10).
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    sourcemap: false,
  },
});
