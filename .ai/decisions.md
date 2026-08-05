# Decisions

Durable architectural and process decisions. Newest first. Record the decision, the reasoning, and what it rules out.

Entries below marked _(reconstructed)_ were inferred from repository state and commit history during the 2026-08-05 bootstrap, not recorded at the time they were made. Correct them if the reasoning was different.

---

## 2026-08-05 — Publish Terms of Service and Privacy Policy

**Decision.** Replace the seven-section placeholder at `/terms` with a 33-section document, and add a 21-section Privacy Policy at `/privacy`. Both are standalone HTML in `public/`, linked from the site footer and from each other, indexed, and listed in the sitemap.

**Reasoning.** The operator asked for terms that protect the company. Three clauses do most of the real work for this specific business: Terms Section 4 separates the site terms from client engagement agreements; Section 8 disclaims the third-party client marks the portfolio necessarily displays; Section 9 makes contact-form submissions expressly non-confidential, which is the protection that matters when a prospect emails an idea and later claims it was taken.

The Privacy Policy exists because the Terms could not close that gap. The contact form collects personal data, the Worker keys a rate limiter on IP, and there is at least one EU client, so GDPR is plausibly in scope.

**Position worth protecting.** The site sets no cookies, runs no analytics, and does no tracking, and the Policy says so plainly. Adding any analytics package makes Section 4 false and creates a consent-banner obligation.

**Stated plainly, not hedged:** neither document has been reviewed by counsel, and "ironclad" was not achievable. Liability caps cannot exclude fraud and, in most jurisdictions, gross negligence; the Terms concede this explicitly rather than overreaching, because a clause pretending to exclude everything is likelier to be struck. Outstanding legal items are in `backlog.md`.

---

## 2026-08-05 — Rotate the work grid instead of curating a fixed eight

**Decision.** `Work.tsx` draws 8 of 16 projects at random per page load, weighted so at least 6 are high-resolution and the double-width slot always is.

**Reasoning.** The operator wanted more work visible without lengthening the section, and wanted newly added clients to surface without re-curating. Rotation does that; the previously retired projects returned to the pool rather than being deleted.

**The non-obvious constraint** is that the site prerenders. Randomising during render would make the server and client markup disagree and break hydration, so the first render is deterministic and the shuffle runs after mount. Anyone editing this component needs to understand that before touching the render path.

**Weighting was added after observing the failure.** An unweighted draw put five 400×250 images on screen at once, which read worse than the curated set it replaced. `MIN_SHARP = 6` bounds it.

**Rules out** storing `span` per project. Span is positional, which is what keeps the three-row tiling intact for any draw.

---

## 2026-08-05 — Prerender the site at build time for search and AI discoverability

**Decision.** `npm run build` now runs a client build, an SSR build of `src/entry-server.tsx`, and `scripts/prerender.mjs`, which injects the rendered markup into `dist/index.html`. The client hydrates instead of mounting from scratch.

**Reasoning.** The built page shipped `<body><div id="root"></div></body>`. Google generally executes JavaScript, but the AI crawlers — GPTBot, ClaudeBot, PerplexityBot, CCBot — largely do not. The site was effectively invisible to them, which directly contradicted the goal of being findable through assistants. No amount of meta-tag work fixes an empty body.

**Why not a plugin.** `react-dom/server` is already present via `react-dom`, so this needs no new dependency, no headless browser, and no framework migration. The whole mechanism is one 40-line script.

**Consequences and hazards.**

- `src/main.tsx` calls `hydrateRoot` when the root already has children and `createRoot` otherwise. The fallback matters: `vite dev` serves an empty root.
- Anything rendered during the build must be SSR-safe. No `window` or `document` access during render — effects are fine, since they don't run server-side. `Footer` calls `new Date().getFullYear()`, which is evaluated at build time.
- `scripts/prerender.mjs` **throws** if the root div is missing or the render is under 1000 bytes, rather than silently shipping a blank page. Do not soften that.
- `npm run build:client` still exists for a client-only build.

**Also added:** canonical URL, Open Graph and Twitter cards with a 1200×630 `og-card.jpg`, schema.org `ProfessionalService` and `WebSite` JSON-LD including the full service catalog, `robots.txt` explicitly allowing AI crawlers, `sitemap.xml`, and `llms.txt`.

---

## 2026-08-05 — Reposition the site for technical evaluators

**Decision.** Rewrite the hero capability strip, hero lede, `01 / Services`, `03 / About` prose, and the `02 / Selected work` project set to lead with engineering rather than CMS product names.

**Reasoning.** The operator's stated goal was to convince technical evaluators (CTOs, technical founders) in the buying group. The site anchored on "WordPress · WooCommerce · LMS · Web apps," which prices the studio as an implementation shop, while Services simultaneously claimed "every layer of the stack" — a claim the capability strip undercut.

**Capabilities confirmed by the operator as genuinely deliverable**, and therefore safe to claim: headless / modern JS front-ends (React, TypeScript), custom application engineering, cloud infrastructure and CI/CD, AI/LLM feature work, and legacy application transformation. Nothing beyond this list may be claimed without checking first.

**Changes.**

- Hero strip: `TypeScript · React · Headless CMS · WooCommerce` / `Legacy modernization · AI integration · CI/CD`. The old "Goal oriented · Performance focused" was generic enough to appear on any agency site.
- Hero lede: leads with custom applications and names modernization; keeps the operator's own "Strategy first / No fluff" cadence.
- Services: 8 items became 9, reordered engineering-first, adding legacy modernization, headless front-ends, and AI integration. WordPress demoted into the headless entry.
- About: three paragraphs of agency boilerplate replaced. Retains three operator-approved claims — no account-manager layer, few concurrent projects, modernization as the common entry point.
- Work: curated from 6 to 8, leading with six platform projects.

**Headlines were deliberately left alone** in both About and Work. The operator kept the About headline when offered a rewrite; treat headlines as theirs unless they ask.

**Standing constraint.** `PRODUCT.md` principle #1 is "show, don't claim." Services now claims AI and modernization work, so `02 / Selected work` must carry visual evidence of it. Adding a capability claim without a matching project is a regression.

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
