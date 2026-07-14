# Contributing to canid

Thanks for wanting to help. canid is deliberately small, so contributing is
mostly about respecting its constraints.

## The constraints (non-negotiable)

- No dependencies, no build step, no backend. Plain HTML, CSS, and ES
  modules. PRs that add a framework, bundler, or npm packages won't be
  merged.
- Dark-first UI, big tap targets, plain-spoken copy. See "Name, logo, and
  look" in the README.

## Security-sensitive code

`js/view.js`, `js/registry.js`, and `js/scramble.js` treat everything in a
URL fragment as attacker-controlled, and the registry regexes are the XSS
allowlist. Changes there get extra scrutiny; keep new regexes conservative.
Found a security issue? Email [dev@canid.app](mailto:dev@canid.app) instead
of opening a public issue — see [SECURITY.md](SECURITY.md).

## Developing

```sh
npx wrangler dev
```

serves the site at `http://localhost:8787` with production routing. Work on
a branch then open a PR. Pushes to `main` deploy to production.

## Before you open a PR

- Describe what you changed, how you tested it, and why.
- If you changed any cached asset, bump `CACHE` in `service-worker.js`.
- If you touched FAQ content or the sample-card fragment, update every copy.
  See "Things kept in sync by hand" in the README.

## Adding a platform

A `REGISTRY` entry in `js/registry.js` with a strict, conservative regex, a
brand icon in `js/icons.js`, and a mention in the FAQ's platform list (all
three synced copies).

## License

Contributions are licensed under AGPL-3.0, like the rest of the project.
