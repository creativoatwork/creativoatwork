# Project rules — creativoatwork

Project-specific working agreements. Read alongside `CONTEXT.md` (current state), `PRODUCT.md` (product and design intent), and `CCOS.md` (the generic operating standard).

Where this file and `CCOS.md` disagree, **this file wins** — it describes the actual repository; CCOS provides generic defaults. See `CCOS.md` §4 "Configuration Priority".

## Scope

This repository is a marketing site, not an application platform. Keep it that way unless explicitly asked otherwise.

- Do not add Firebase Auth, Firestore, Storage, or Cloud Functions "for later." Firebase is a static host here.
- Do not add a state manager, router, component library, or CSS framework alongside Tailwind. There are seven components and one form.
- Do not add a `tailwind.config.js`. Tailwind 4 is configured CSS-first in `src/index.css`.

New dependencies need a reason that survives the question "what breaks without this?"

## Design work is constrained

`PRODUCT.md` lists explicit anti-references — template-agency layouts, maximalist gradients, corporate beige, SaaS feature-icon grids. These are not stylistic preferences to weigh; they are exclusions. Before proposing UI, check the change against them.

Specific standing constraints:

- One accent color. `--color-accent` is it.
- Use the existing type helpers (`.display`, `.display-md`, `.lede`, `.body`, `.eyebrow`) rather than inventing sizes.
- New colors go in `@theme` as tokens, in OKLCH, or they do not go in.
- Motion stays restrained and must respect `prefers-reduced-motion` — the global rule in `index.css` covers transitions and the `.reveal` family; anything JS-driven needs its own check.

## Accessibility floor

WCAG 2.2 AA, per `PRODUCT.md`. Non-negotiable on this site because a rough edge is self-disqualifying for a studio.

Every UI change gets checked for: visible focus state, keyboard reachability (including the mobile menu), real labels on inputs, meaningful `alt` or `alt=""`, and contrast.

## The contact endpoint is the only attack surface

`worker/src/index.ts` is public and unauthenticated. Treat changes to it as security-relevant:

- Keep validation before use, and HTML-escaping before templating into email.
- Keep the CORS allowlist tight. Do not widen it to `*`.
- Never log full message bodies, email addresses, or the Resend key.
- `RESEND_API_KEY` is a Wrangler secret. It must never appear in the repo, in a `VITE_`-prefixed variable, or in client code — `VITE_` variables are inlined into the public bundle.
- Abuse controls today are the honeypot plus a 3/min per-IP burst limit (`CONTACT_RATE_LIMITER`, `[[unsafe.bindings]]` in `wrangler.toml`). Keep `RATE_LIMIT_PERIOD_SECONDS` in `index.ts` in sync with `period`. The limiter is per-colo and **fails open**, so it caps runaway spend rather than guaranteeing a quota — do not describe the endpoint as protected against a determined or distributed attacker. Remaining gaps are in `backlog.md`.

## One deployed surface, deliberately

There is exactly one URL: `creativoatwork.com`. **Do not leave a Firebase Hosting preview
channel alive.**

A channel was used once to verify a CSP before promoting it, then kept around. It updates only
when explicitly redeployed, so it silently served an older bundle while production was correct.
That caused three separate debugging rounds in one session: each time the fix was verified on
production and reported as done while the operator was looking at the channel. A second URL
serving different bytes is a hazard with no compensating value — the e2e suite covers the same
ground locally against the Hosting emulator, which reads the real `firebase.json`.

If a channel is genuinely needed for a one-off check, delete it in the same session:
`npx firebase-tools hosting:channel:delete <name>`.

**When a UI change looks wrong after a deploy, establish which bytes the browser has before
theorising.** `curl -s <url>/admindash | grep -o '/assets/admindash-[^"]*\.js'` on every surface,
and compare against `dist/`.

## Verification honesty

The only automated gate is `npm run build` (which runs `tsc -b`). There are no tests.

State what was actually run. "Type-checks and builds clean" is a claim you can make after running it; "works" is not, unless the behavior was exercised in a browser. If a change touches the form, the header nav, or responsive layout, verify in a browser before calling it done.

## Git

Do not commit, push, open PRs, or deploy without being asked. Deploys are manual and go to a live studio site.

Never commit `.env.production`, `.env.local`, or anything containing the Resend key.
