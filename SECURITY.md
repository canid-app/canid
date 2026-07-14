# Security policy

canid has no backend: cards are decoded and rendered entirely in the viewer's
browser, and everything in a URL fragment is treated as attacker-controlled.
The security-sensitive files are `js/view.js`, `js/registry.js`, and
`js/scramble.js` — see the header comments in each, and the Architecture
section of the README, for the threat model. Note that the link "scrambling"
is documented obfuscation, not encryption, so reports that it can be reversed
are expected behavior, not a vulnerability.

## Reporting a vulnerability

Email [dev@canid.app](mailto:dev@canid.app) instead of opening a public
issue. Include steps to reproduce (a crafted card link is usually the whole
proof of concept). You'll get a reply as quickly as I can manage, a fix as
fast as severity warrants, and credit if you want it. There is no bounty
program. canid is free and unfunded.

## Supported versions

Only what's deployed at [canid.app](https://canid.app), which always tracks
the `main` branch.
