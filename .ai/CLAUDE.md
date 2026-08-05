# Project rules — creativoatwork

Project-specific working agreements. Read alongside `CONTEXT.md` (current state) and `PRODUCT.md` (product and design intent).

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
- The honeypot is the only abuse control today. There is no rate limiting; do not describe the endpoint as protected.

## Verification honesty

The only automated gate is `npm run build` (which runs `tsc -b`). There are no tests.

State what was actually run. "Type-checks and builds clean" is a claim you can make after running it; "works" is not, unless the behavior was exercised in a browser. If a change touches the form, the header nav, or responsive layout, verify in a browser before calling it done.

## Git

Do not commit, push, open PRs, or deploy without being asked. Deploys are manual and go to a live studio site.

Never commit `.env.production`, `.env.local`, or anything containing the Resend key.
