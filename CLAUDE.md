# creativoatwork

This repository operates under **CCOS 2.4**. Two files carry the rules, and they have
different jobs:

@.ai/CCOS.md

@.ai/CLAUDE.md

- `.ai/CCOS.md` — the generic CCOS 2.4 operating standard, verbatim. Session protocol, review
  gates, memory lifecycle, security floor.
- `.ai/CLAUDE.md` — this repository's specific working agreements.

**Where they disagree, `.ai/CLAUDE.md` wins.** CCOS supplies defaults; the project file
describes reality. Full precedence order is in `CCOS.md` §4 "Configuration Priority" — current
user instruction, then security, then the actual code, then project config, then CCOS
defaults, then historical memory.

## Read before working

| File | What it is |
|---|---|
| `.ai/CONTEXT.md` | Current state — architecture, build pipeline, contact contract, the Work-grid constraints, rate limiting. Start here. |
| `.ai/decisions.md` | Why things are the way they are. Check before proposing to undo something. |
| `.ai/backlog.md` | Known gaps, deliberately deferred. Check before "discovering" one. |
| `PRODUCT.md` | Product intent, audience, anti-references, the Capabilities list. Binding on design and copy. |
| `README.md` | Setup and deploy runbook. |
| `.ai/sessions/` | Chronological history. |

Memory is not authority — code is. If a memory file contradicts the repository, trust the
repository and fix the file in the same change.

## Three traps specific to this repo

1. **The build prerenders.** `npm run build` is client build → SSR build → `scripts/prerender.mjs`.
   A successful run prints `prerender: injected N bytes`; if that line is missing, the deploy
   ships an empty page to crawlers. Nothing rendered at build time may touch `window` or
   `document`.
2. **The Work grid has three coupled constraints** — hydration, tiling, and image resolution.
   `.ai/CONTEXT.md` spells them out. Breaking any one is a regression that type-checking will
   not catch.
3. **`PRODUCT.md`'s Capabilities list is the authority on what the site may claim.** Nothing
   goes into Services that is not on that list.

## Codex

Codex is installed as the CCOS independent reviewer (`CCOS.md` §13–§19). Claude implements and
decides; Codex critiques. Never let both edit this working tree at once.

Review gates that apply here: `worker/src/index.ts` and anything touching the contact
endpoint, `wrangler.toml` bindings, the prerender pipeline, Hosting configuration, and the
legal pages. Copy and styling changes do not need it. The stop-time gate is off by default —
invoke review by judgment.

## Verification and Git

`npm run build` is the only automated gate; there are no tests and no linter. State what was
actually run — "type-checks and builds clean" is earned by running it, "works" is not unless
exercised in a browser.

Do not commit, push, open PRs, or deploy without being asked. Deploys are manual and go to a
live studio site. Never commit `.env.production`, `.env.local`, or anything with the Resend key.
