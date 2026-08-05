# Backlog

Known gaps and candidate work, roughly by priority. Not a task tracker for in-flight work — that lives in the session log.

## Security / correctness

- **No rate limiting on the contact endpoint.** The honeypot is the only abuse control. A trivial script can drive Resend spend and flood `hello@`. Options: Cloudflare Rate Limiting rules, a Turnstile challenge, or a KV-backed per-IP counter in the Worker. Highest-value gap.
- **No idempotency on send.** A double-submitted or retried request sends two emails. The client guards against double-submit in the UI (`status === 'sending'`), which is not a server-side guarantee.
- **`VITE_CONTACT_URL` is build-time only.** If the Worker URL changes, a stale deployed bundle points at a dead endpoint until the frontend is rebuilt and redeployed. Worth documenting in the deploy runbook, or fronting the Worker with a stable custom domain.

## Validation

- **No test framework.** Contact form state transitions (idle → sending → ok/error, error-code mapping) and Worker request validation are the highest-value units to cover first.
- **No linter.** No ESLint, no Prettier, no formatting convention beyond what is already in the files.
- **No browser testing.** Playwright would cover the flows that matter most: contact submission, mobile menu keyboard navigation, and anchor-nav scrolling.
- **No CI.** Nothing runs `tsc -b` on push, so a type error can reach `main` unnoticed.

## Deployment

- **Manual deploys.** Both targets deploy from a local machine. Preferred flow is GitHub → CI → deploy for the frontend, and a checked Worker deploy. Would also close the CI gap above.

## Documentation

- `PRODUCT.md` has an empty **Register** section ("brand") that reads as a placeholder — confirm whether it is intentional.
- No accessibility audit has been run against the WCAG 2.2 AA floor `PRODUCT.md` sets. The code shows deliberate a11y work, but "verified" is a stronger claim than anything currently supports.
