# CONTEXT

Current project state. Update when architecture, integrations, or workflow change.

_Last reconciled against the repository: 2026-08-05 (commit `879f567`)._

## What this is

Single-page marketing site for Creativo@Work LLC, a Brooklyn web development studio. Its one job is converting a warm visitor into a contact conversation. Audience, voice, anti-references, and design principles are specified in `PRODUCT.md` and are binding on design work.

## Architecture

Static React SPA on Firebase Hosting, plus one serverless endpoint for the contact form.

```
Browser → Firebase Hosting (static dist/)
Contact form → Cloudflare Worker /contact → Resend → hello@creativoatwork.com
```

There is **no** Firebase Auth, Firestore, Storage, or Cloud Functions in this project, and no Firebase SDK in the client bundle. Firebase is used purely as a static host. Do not introduce Firebase services speculatively.

## Stack

- Vite 6, React 18, TypeScript 5.6
- Tailwind CSS 4 via `@tailwindcss/vite`, CSS-first configuration — tokens live in `@theme` in `src/index.css`. There is no `tailwind.config.js` and one should not be added without cause.
- Geist / Geist Mono loaded from Google Fonts in `index.html`
- Cloudflare Worker (`worker/`), wrangler 3, `compatibility_date = 2024-10-22`
- Resend for transactional email

## Layout

- `src/App.tsx` — fixed section order: Header, [Hero, Services, Work, About, Contact], Footer
- `src/components/*.tsx` — one file per section, no shared component library
- `src/index.css` — design tokens plus `base` / `components` / `utilities` layers
- `public/terms.html` — standalone page served at `/terms` via Hosting `cleanUrls`
- `worker/src/index.ts` — the entire contact endpoint, single file

## Conventions

- Sections carry monospace numbering (`01 / Services` … `04 / Contact`) and anchor ids (`#home`, `#services`, `#work`, `#about`, `#contact`) that the header nav links to. Renumber consistently if section order changes.
- Section headers share a `grid sm:grid-cols-[auto_1fr]` shape: number in the left column, heading and lede in the right.
- Colors are referenced as `var(--color-*)`, defined once in `@theme`, in OKLCH. One accent color only.
- Typographic scale is expressed through `.display`, `.display-md`, `.lede`, `.body`, `.eyebrow` rather than ad-hoc utilities.
- `.gutter` owns horizontal page padding at every breakpoint.

## Contact form contract

Client posts `{ name, email, message, company }` as JSON. `company` is a honeypot — non-empty means bot, and the worker returns `{ ok: true }` without sending.

Worker responses are `{ ok: true }` or `{ ok: false, error: <code> }` with codes `invalid_json`, `not_found`, `method_not_allowed`, `invalid_input`, `invalid_email`, `rate_limited`, `send_failed`, `internal_error`. The client adds a local `network` code. Every code shown to users needs matching copy in `ERROR_COPY` in `src/components/Contact.tsx` — adding a worker code without the copy falls back to a generic message.

Worker validation: `name` 1–100, `email` 5–200 plus regex, `message` 5–5000 characters, all trimmed. User input is HTML-escaped before templating into the email. `reply_to` is set to the sender.

CORS is allowlisted to `creativoatwork.com`, `www.creativoatwork.com`, the two Firebase domains, and any localhost/127.0.0.1 port.

## Build pipeline

`npm run build` is three steps: client build, SSR build to `dist-ssr/`, then `scripts/prerender.mjs` injects the rendered HTML into `dist/index.html` and deletes `dist-ssr/`. A successful run prints `prerender: injected N bytes`. **If that line is missing, the deploy would ship an empty page to crawlers.**

Everything rendered at build time must be SSR-safe: no `window` or `document` during render. Effects are fine.

## Hero sizing

The hero is `min-h-[calc(100svh-69px)]` / `sm:min-h-[calc(100svh-73px)]`. Those constants are the header's exact height — logo (`h-9` / `sm:h-10`) plus `py-4` plus its 1px bottom border. The header is `sticky`, so it sits in flow and consumes that space. **Change the header's height or padding and these two numbers must change with it**, or the first screen stops being exactly one viewport.

`.display` scales on height as well as width (`clamp(2.6rem, min(8.5vw, 12svh), 7.5rem)`) so the hero still fits on short laptop screens. Width-only scaling pushed the capability strip below the fold at 1280×720.

## Work imagery

Project previews live in `public/img/img_cw/`. New ones should be WebP, ~1000px wide for `std` cards and ~1600px for `wide`, produced with `cwebp -q 80 -resize <width> 0 in.png -o out.webp`. Typical output is 20–45KB.

`sips` on this machine has **no WebP encoder** — use `cwebp`, which is installed.

The card caption puts client name and `scope` on one flex row. **Keep `scope` under ~23 characters**; longer strings wrap and collide with the client name on 390px cards. Existing values run 15–23 characters.

## Rate limiting

3 submissions per minute per IP, via the `CONTACT_RATE_LIMITER` binding in `wrangler.toml` (`[[unsafe.bindings]]`, type `ratelimit`). Keyed on `CF-Connecting-IP`, which Cloudflare overwrites at the edge and a client therefore cannot spoof. Exceeding it returns 429 with `Retry-After: 60`.

`RATE_LIMIT_PERIOD_SECONDS` in `index.ts` must stay in sync with `period` in `wrangler.toml`; the binding accepts only 10 or 60.

The check runs **after** honeypot and validation, so rejected attempts don't consume a visitor's budget. It **fails open** — a limiter error logs and lets the message through.

Two limits to be honest about: counting is per-colo rather than global, and there is no cap longer than 60 seconds, so a bot pacing under the limit is not stopped. See `backlog.md`.

## Configuration and secrets

- `VITE_CONTACT_URL` — the worker endpoint. Build-time, inlined into the bundle. Lives in `.env.local` (dev) or `.env.production` (build); both gitignored. `.env.example` is the committed template.
- `RESEND_API_KEY` — Wrangler secret on the Cloudflare side only. Never in the repo, never in a `VITE_`-prefixed variable.

Firebase project: `creativoatwork-54e65`. GitHub: `creativoatwork/creativoatwork`.

## Validation

`npm run build` runs `tsc -b` before bundling, so type errors fail the build. That is the **only** automated gate: no test framework, no linter, no CI. Any claim that a change is verified must state what was actually run.

`worker/` has its own `npm run typecheck`.

## Deployment

Manual, from a local machine:

- Frontend: `npm run build` then `npx firebase deploy --only hosting`
- Worker: `cd worker && npm run deploy`

Not yet wired to GitHub. This diverges from the preferred GitHub → CI → deploy flow and is tracked in the backlog.

**Live worker URL** (first deployed 2026-08-05):

```
https://creativoatwork-contact.creativoatwork-contact-worker.workers.dev/contact
```

This exact string is inlined into the frontend bundle at build time via `.env.production`, which is gitignored and must exist locally before any hosting deploy. **Building without it ships a contact form with no endpoint** — every submission fails with a generic error. Always confirm the URL is present in `dist/assets/*.js` before deploying.

`RESEND_API_KEY` is set as a Wrangler secret on the worker. Verify with `wrangler secret list`; an empty `[]` means email will 502.

Cloudflare account ID: `7e69b4714d0b27bdee429db2ccde9f7a`. Firebase auth is `creativoatwork@gmail.com`.

A workers.dev subdomain must be registered on the account for the worker to be reachable; without it DNS resolves but TLS fails with a handshake error, which looks like an outage rather than a config gap.
