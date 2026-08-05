# Decisions

Durable architectural and process decisions. Newest first. Record the decision, the reasoning, and what it rules out.

Entries below marked _(reconstructed)_ were inferred from repository state and commit history during the 2026-08-05 bootstrap, not recorded at the time they were made. Correct them if the reasoning was different.

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
