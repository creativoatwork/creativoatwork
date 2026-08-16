# Backlog

Known gaps and candidate work, roughly by priority. Not a task tracker for in-flight work — that lives in the session log.

## Security / correctness

- **No sustained rate cap.** A 3/min per-IP burst limit shipped 2026-08-05 (see `decisions.md`), which closes the runaway-spend risk. What remains: a bot pacing under 3/min can drip mail into `hello@` indefinitely. Closing it needs an hourly counter, which needs storage — a KV namespace keyed `rl:<ip>:<unix-hour>` was the designed approach. Deferred as setup overhead.
- **No bot-quality control beyond the honeypot.** Invisible Turnstile was designed and deliberately deferred: it requires creating a Turnstile site, a public site key (`VITE_TURNSTILE_SITE_KEY`), and a `TURNSTILE_SECRET_KEY` Wrangler secret. Revisit if spam actually starts landing.
- **Rate limiting is per-colo, not global.** Inherent to the native binding. A distributed attacker gets a higher effective ceiling. Only Durable Objects would count exactly; not worth it at this traffic.
- **No idempotency on send.** A double-submitted or retried request sends two emails. The client guards against double-submit in the UI (`status === 'sending'`), which is not a server-side guarantee.
- **`VITE_CONTACT_URL` is build-time only.** If the Worker URL changes, a stale deployed bundle points at a dead endpoint until the frontend is rebuilt and redeployed. Worth documenting in the deploy runbook, or fronting the Worker with a stable custom domain.

## Process

- **The Codex stop-time review gate is disabled.** Enabling it (`/codex:setup --enable-review-gate`)
  forces a fresh Codex review before a session can stop. That matches CCOS §16 literally, but
  taxes copy and styling edits that §14 exempts. Left off deliberately; revisit if a
  review-worthy change ever ships without one.
- **`.ai/CLAUDE.md` drifted once already.** It claimed the honeypot was the only abuse control
  months after rate limiting shipped, while `CONTEXT.md` documented the limiter correctly.
  Fixed 2026-08-16. Memory files can contradict each other, not just the code — a reconcile
  pass should read them against one another, not only against the repository.

## /admindash

- **Domain auto-population was cut before implementation.** The Add Project modal takes a domain and everything else is typed by hand. A server-side `/inspect` endpoint on the Worker was designed, adversarially reviewed, and dropped: eight of fifteen HIGH review findings existed only because of it (JWT verification, JWKS caching, SSRF guards, CORS rework, per-route limiter policy), and it put the live contact endpoint at risk to save a few seconds per project. Revisit only if manual entry actually becomes annoying.
- **No automated export.** Backups are manual — nobody is reminded. Closing this needs Blaze plus scheduled Firestore exports, or a cron on a machine that is on regularly.
- **The detail view subscribes to the whole collection** to find one document. Fine at tens of documents; revisit alongside the ~500-document threshold.
- **`worker/wrangler.toml` still uses `[[unsafe.bindings]]`** for the contact rate limiter. Cloudflare's current GA syntax is `[[ratelimits]]` (needs Wrangler >= 4.36.0; the repo declares ^4.119.0). Verified against Cloudflare docs during the /admindash review. Standalone cleanup, unrelated to the dashboard.
- **No browser-level check in the verification chain.** Type-check, 54 rules tests, bundle-isolation walking, and a Node probe against the live APIs all passed while the CSP blocked every enrichment request in production. Playwright over `/admindash` sign-in plus one Gather would close it; until then, any change adding a network destination needs a manual browser pass.
- **Enrichment detection tables are duplicated** between `src/admin/data/enrich.ts` and `scripts/enrich-projects.mjs`. Extracting a shared module would need the script to consume compiled TS or the tables to move to JSON.
- **MX classification is weak** — `creativoatwork.com` returns a verification-style record and reports "other" rather than naming the mail host.
- **The Cloud Monitoring alert on Firestore read count is designed but not created.** Spark has no budget alerts, but Cloud Monitoring alerting policies work without billing.

## Validation

- **No test framework.** Contact form state transitions (idle → sending → ok/error, error-code mapping) and Worker request validation are the highest-value units to cover first.
- **No linter.** No ESLint, no Prettier, no formatting convention beyond what is already in the files.
- **No browser testing.** Playwright would cover the flows that matter most: contact submission, mobile menu keyboard navigation, and anchor-nav scrolling.
- **No CI.** Nothing runs `tsc -b` on push, so a type error can reach `main` unnoticed.

## Deployment

- **Manual deploys.** Both targets deploy from a local machine. Preferred flow is GitHub → CI → deploy for the frontend, and a checked Worker deploy. Would also close the CI gap above.

## Legal

Both `/terms` and `/privacy` are live, public, linked from the footer, and indexable. All of the following are open.

- **Neither document has been reviewed by counsel.** They were drafted from common commercial practice and, for the Privacy Policy, from the actual stack. That is not the same as being enforceable or complete for this business.
- **No EU representative appointed.** GDPR Article 27 may require one given work for Cyrus (Italy) and the Transatlantic Innovation Hub, which explicitly targets European companies entering the US. The Privacy Policy cannot substitute for the appointment.
- **DMCA designated agent not registered.** Terms Section 24 describes the notice procedure, but safe harbour requires registering an agent with the US Copyright Office (about $6). Without it the section is procedure without protection.
- **The arbitration clause is a deliberate trade-off, not free protection.** It blocks class actions but exposes the company to mass-arbitration cost, and consumer-facing clauses attract scrutiny. Worth a conscious decision with counsel rather than leaving by default.
- **Terms Section 12 incorporates the Privacy Policy by reference.** Changing one may require reviewing the other.

## Content

- **Six pool images are only 400×250** — `siscc`, `cyrus-preview`, `gallery-preview`, `podcastfarm`, `mariottistudio`, `donnsterling-preview`. They were converted to WebP where possible, which fixed weight but not sharpness; upscaling cannot add detail. They render into cards 390×260 CSS pixels wide, so they are soft on retina beside the ten sources at 1000–1600px. The draw is weighted to show at most two at a time and never in the wide slot, which contains the problem rather than solving it. A real fix needs fresh screenshots of the live sites at 1000px or more.
- **`siscc.png` and `cyrus-preview.png` are unreferenced but retained** at the operator's explicit request. The `.webp` versions are what `Work.tsx` uses. They still deploy, costing about 250KB.
- **Project `scope` strings are inferred.** Every entry added after the original six was written from a single hero screenshot and has not been confirmed against what was actually built.

## Documentation

- `PRODUCT.md`'s **Register** section contains only the word "brand". It may be a deliberate one-word value for the document's voice register rather than an unfinished field — never confirmed either way. Worth one sentence from the founder to settle it.
- `PRODUCT.md` was realigned to the new positioning on 2026-08-05 and now carries a **Capabilities** list that is the authority on what the site may claim. Anything added to Services must appear there first.
- No accessibility audit has been run against the WCAG 2.2 AA floor `PRODUCT.md` sets. The code shows deliberate a11y work, but "verified" is a stronger claim than anything currently supports.
