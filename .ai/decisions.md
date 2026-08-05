# Decisions

Durable architectural and process decisions. Newest first. Record the decision, the reasoning, and what it rules out.

Entries below marked _(reconstructed)_ were inferred from repository state and commit history during the 2026-08-05 bootstrap, not recorded at the time they were made. Correct them if the reasoning was different.

---

## 2026-08-05 — Rate limit the contact endpoint with Cloudflare's native binding

**Decision.** 3 submissions per minute per IP, enforced by the Workers rate-limiting binding declared in `worker/wrangler.toml`. Rejections return HTTP 429 with `Retry-After` and the error code `rate_limited`. No KV, no Turnstile.

**Reasoning.** Design exploration first landed on a layered scheme — 3/min burst, 10/hour sustained cap, and invisible Turnstile. The operator then constrained the work to "free, no added headaches, no complexity," which rules out anything needing provisioning: a KV namespace, a Turnstile site and key pair, or a new secret. The native binding requires none of those; it is declared entirely in config and costs nothing.

**Accepted trade-offs, explicitly.**

- **No sustained cap.** A bot pacing itself under 3/min can still drip mail into `hello@` indefinitely. This is the known hole.
- **No bot-quality control** beyond the existing honeypot. Turnstile was dropped, so a well-built bot that leaves the honeypot blank still gets through.
- **Per-colo counting.** The limit is enforced per Cloudflare edge location, not globally, so a geographically distributed attacker gets a higher effective ceiling.
- **Experimental binding.** It lives under `[[unsafe.bindings]]`; wrangler prints a warning on every run and the shape could change.

**Fail-open by design.** A limiter error is logged via `console.error` and the submission proceeds. Rationale: the failure cost is asymmetric — losing a real prospect costs far more than accepting a spam email during a rare outage.

**Placement.** The check sits after honeypot and field validation, so a visitor correcting a typo doesn't burn their budget on rejected attempts.

**Not ruled out permanently.** If spam materializes, the layered design is recorded in `backlog.md` and can be revisited.

---

## 2026-08-05 — Adopt `.ai/` structured memory and a README

**Decision.** Bootstrap `.ai/` (`CLAUDE.md`, `CONTEXT.md`, `decisions.md`, `backlog.md`, `sessions/`) and add a human-facing `README.md`.

**Reasoning.** The repository had no README and no working context. Product intent lived in `PRODUCT.md`, but the operational picture — how the contact form works end to end, where secrets live, what the deploy steps are, what is actually verified — existed only in the code.

**Split.** `README.md` is for humans and covers setup, build, deploy, and structure. `.ai/` holds working context, project-specific rules, decisions, and session history. Decisions and session logs do not go in the README.

---

## Contact form on a Cloudflare Worker + Resend, not Firebase _(reconstructed)_

**Decision.** The contact form posts to a standalone Cloudflare Worker (`creativoatwork-contact`) that calls the Resend REST API. Commit `879f567`.

**Reasoning (inferred).** The site is otherwise fully static and needs no Firebase runtime. A single Worker keeps the one dynamic endpoint off the Firebase billing surface and avoids pulling the Firebase SDK, a Functions runtime, and a Blaze-plan dependency into a static marketing site.

**Consequences.** Two deploy targets and two toolchains (`firebase-tools`, `wrangler`). The frontend and the endpoint are coupled only through the build-time `VITE_CONTACT_URL` — a Worker URL change requires a frontend rebuild and redeploy, not just a config edit.

**Rules out.** Adding Cloud Functions for the contact path. If a second dynamic endpoint appears, revisit deliberately rather than accreting endpoints in one Worker file.

---

## Firebase Hosting as a pure static host _(reconstructed)_

**Decision.** Deploy `dist/` to Firebase Hosting with an SPA rewrite, clean URLs, immutable asset caching, and baseline security headers. Commits `a6d595d`, `a1a5165`.

**Reasoning (inferred).** The site is a static bundle; Hosting provides CDN, TLS, and header control with no runtime.

**Consequences.** `cleanUrls` is what makes `public/terms.html` reachable at `/terms` — the Terms link depends on it. No Firebase project services are provisioned or expected.

---

## Tailwind 4, configured CSS-first _(reconstructed)_

**Decision.** Tailwind 4 via `@tailwindcss/vite`, with all design tokens in an `@theme` block in `src/index.css`. No `tailwind.config.js`. Commit `93af150`.

**Reasoning (inferred).** Tailwind 4's CSS-first configuration keeps tokens and the styles that consume them in one file, which suits a site whose design system is a small token set plus five typographic helpers.

**Consequences.** Tokens are consumed as `var(--color-*)`. Adding a JS config would split the source of truth and should be avoided.
