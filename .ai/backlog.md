# Backlog

Known gaps and candidate work, roughly by priority. Not a task tracker for in-flight work — that lives in the session log.

## Security / correctness

- **No sustained rate cap.** A 3/min per-IP burst limit shipped 2026-08-05 (see `decisions.md`), which closes the runaway-spend risk. What remains: a bot pacing under 3/min can drip mail into `hello@` indefinitely. Closing it needs an hourly counter, which needs storage — a KV namespace keyed `rl:<ip>:<unix-hour>` was the designed approach. Deferred as setup overhead.
- **No bot-quality control beyond the honeypot.** Invisible Turnstile was designed and deliberately deferred: it requires creating a Turnstile site, a public site key (`VITE_TURNSTILE_SITE_KEY`), and a `TURNSTILE_SECRET_KEY` Wrangler secret. Revisit if spam actually starts landing.
- **Rate limiting is per-colo, not global.** Inherent to the native binding. A distributed attacker gets a higher effective ceiling. Only Durable Objects would count exactly; not worth it at this traffic.
- **No idempotency on send.** A double-submitted or retried request sends two emails. The client guards against double-submit in the UI (`status === 'sending'`), which is not a server-side guarantee.
- **`VITE_CONTACT_URL` is build-time only.** If the Worker URL changes, a stale deployed bundle points at a dead endpoint until the frontend is rebuilt and redeployed. Worth documenting in the deploy runbook, or fronting the Worker with a stable custom domain.

## Validation

- **No test framework.** Contact form state transitions (idle → sending → ok/error, error-code mapping) and Worker request validation are the highest-value units to cover first.
- **No linter.** No ESLint, no Prettier, no formatting convention beyond what is already in the files.
- **No browser testing.** Playwright would cover the flows that matter most: contact submission, mobile menu keyboard navigation, and anchor-nav scrolling.
- **No CI.** Nothing runs `tsc -b` on push, so a type error can reach `main` unnoticed.

## Deployment

- **Manual deploys.** Both targets deploy from a local machine. Preferred flow is GitHub → CI → deploy for the frontend, and a checked Worker deploy. Would also close the CI gap above.

## Content

- **Six work images are missing — blocks deploy.** `Work.tsx` references `myonlinecopyright.png`, `clima.png`, `landusup.png`, `edge.png`, `fellow-alumni-network.png`, and `newyork-partners.png` in `public/img/img_cw/`. None exist yet, so those six cards render as empty boxes. **Do not deploy hosting until they are added.** `myonlinecopyright` is the `wide` card and wants ~2:1; the rest are ~4:3. Keep each under ~150KB — the page claims Core Web Vitals work.
- **`02 / Selected work` heading not updated.** Still "Built for businesses that needed to grow up, online," which undersells a set that is now mostly platforms. Proposed but not applied: "Platforms we designed, built, and still run." Headlines are the operator's call.
- **Project `scope` strings are inferred.** The six new entries were written from a single hero screenshot each and have not been confirmed against what was actually built.

## Documentation

- `PRODUCT.md` has an empty **Register** section ("brand") that reads as a placeholder — confirm whether it is intentional.
- No accessibility audit has been run against the WCAG 2.2 AA floor `PRODUCT.md` sets. The code shows deliberate a11y work, but "verified" is a stronger claim than anything currently supports.
