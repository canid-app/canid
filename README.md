# canid

canid is a free digital contact card that lives in a link. Add the
handles you want to share, sort them into groups for different audiences, and
hand them out (meant to be shared via QR, NFC, or a raw link). Live at
[canid.app](https://canid.app).

## Architecture

There is no backend, no database, and no build step. Everything on a card is
packed into the URL fragment (the part after `#`), to avoid data being sent
to a server. The viewer page (`/c`) decodes the fragment locally and renders
the card with DOM APIs.

- Plain HTML, CSS, and ES modules. No framework, bundler, or dependencies.
- Hosted as static assets on Cloudflare Workers (`wrangler.jsonc`).
- `js/view.js` treats every fragment value as attacker-controlled; the
  per-platform regexes in `js/registry.js` are the XSS allowlist. Read the
  header comments in both files before touching them.
- The link "scrambling" (`js/scramble.js`) is obfuscation against casual
  scrapers, **not** encryption.
- The only external request the site makes is the
  [Simple Analytics](https://simpleanalytics.com) script on the landing/editor
  page and the info pages (FAQ, terms, 404). The card viewer (`/c`) and
  saved-cards pages load nothing third-party, and the per-path CSP in
  `_headers` enforces it: on `/c` and `/saved` no external origin is allowed
  at all.

## Local development

Requires Node.js (for wrangler only since the site itself has no dependencies):

```sh
npx wrangler dev
```

This serves the site at `http://localhost:8787` with the same routing as
production (`/c` → `c.html`, 404s → `404.html`). The service worker
deliberately bypasses its cache on `localhost`.

## Branches and deploying

Pushing to `main` deploys to production via Cloudflare's git integration. 
**Never test against `main`**. Do work on a branch, verify it with
`npx wrangler dev`, and merge when it's ready. External contributions are
welcome, just make sure you open a PR and describe what you changed, how you
tested it, and why. I'll try to review PRs as quickly as I can.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: keep the
constraints (no dependencies, no build step, no backend), treat `js/view.js`,
`js/registry.js`, and `js/scramble.js` as security-sensitive, and report
security issues to [dev@canid.app](mailto:dev@canid.app) instead of opening
a public issue ([SECURITY.md](SECURITY.md)).

## Name, logo, and look

- "canid" is lowercase, always, even at the start of a sentence.
- The AGPL covers the code, not the identity. The canid name, wordmark, and
  canid.app domain refer to the instance I run. If you self-host, pick your
  own name and logo.
- Design intent (for PRs that touch the UI): dark-first (cards get shown in
  dark venues so nothing flash-bang white), big tap targets, the notched-card
  motif, and Karrik as the brand face. Copy is plain-spoken and doesn't
  oversell anything because this isn't for everyone. Think "scrambled, not encrypted" as the "house" style.

## Things kept in sync by hand

No build step means some duplication is maintained manually. When you change
one of these, change all of its copies:

- **FAQ content** lives in three places: `js/faq.js` (in-editor modal),
  the static markup in `faq.html` (no-JS/SEO copy), and the JSON-LD block in
  `faq.html`'s `<head>`.
- **The sample-card fragment** is hard-coded in the nav of `index.html`
  (twice), `faq.html`, and `terms.html`.
- **Service worker**: new files must be added to `SHELL` in
  `service-worker.js`, and the `CACHE` name must be bumped whenever any
  cached asset changes, or installed clients keep serving stale files.
- **Version string** in the footer of `index.html`.

## Inspiration

If you're curious about why this exists: it's because I attend a lot of events
in different communities, and I want to give different people different
contact info. canid makes it easy to create one-off contact cards,
link-in-bios, or other landing pages without it ever touching a server or
requiring an account that creates a web of your online presence and can be
sold to data brokers. A nice side effect is that the page doesn't "exist" on
the internet until someone is viewing it, so it won't end up being aggregated
by search engines or other third parties. Obviously if someone has the link,
they have it, and there are a lot of tradeoffs, but I find the tool useful and
hopefully you do too.

I didn't invent the trick canid is built on and there are a bunch of
interesting projects that treat the URL as the thing:

- [itty.bitty](https://itty.bitty.site) packs entire tiny websites into a
  link
- [URL Pages](https://github.com/jstrieb/urlpages) and
  [NoPaste](https://github.com/bokub/nopaste) do the same for web pages and
  code snippets

So, while I run the canonical canid.app site, the code is freely available
here if you want to host it yourself (with a different name and logo) or if
you want to contribute to canid.

## Note about this repository
I developed this over the course of multiple months in a private repository 
and decided to open source it later. As such, you'll notice there isn't a commit history. 
I wanted to decouple this from my other projects. If you have any questions about the commit history 
please feel free to email.

## Fonts

Karrik (by Jean-Baptiste Morizot and Lucas Le Bihan, via
[velvetyne.fr](https://velvetyne.fr/fonts/karrik/)) and the other bundled
typefaces are licensed under the SIL Open Font License — see
`fonts/LICENCE.txt` and `fonts/OFL.txt`.

## License

[AGPL-3.0](LICENSE), with two bundled exceptions that keep their original
licenses:

- `vendor/qr-styling.js` ([qr-code-styling](https://github.com/kozakdenys/qr-code-styling))
  remains under MIT — see the header in that file.
- The fonts in `fonts/` remain under the SIL Open Font License 1.1 — see
  `fonts/LICENCE.txt` (Karrik) and `fonts/OFL.txt` (Inter, Instrument Serif,
  JetBrains Mono).

Network names and logos belong to their respective
owners and appear only to identify those networks.

Bugs and feedback: [dev@canid.app](mailto:dev@canid.app)
