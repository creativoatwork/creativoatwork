# CONTEXT

Current project state. Update when architecture, integrations, or workflow change.

_Last reconciled against the repository: 2026-08-05 (commit `0037272`)._

**Production status:** both targets are live. The Worker was first deployed 2026-08-05 (version `c8b9692c`) — before that, commit `879f567` had been written but never shipped, so the contact backend did not exist in production. Hosting is deployed and serving the prerendered site, both legal pages, and the crawler files.

## What this is

Single-page marketing site for Creativo@Work LLC, a Brooklyn web development studio. Its one job is converting a warm visitor into a contact conversation. Audience, voice, anti-references, and design principles are specified in `PRODUCT.md` and are binding on design work.

## Architecture

Static React SPA on Firebase Hosting, plus one serverless endpoint for the contact form.

```
Browser → Firebase Hosting (static dist/)
Contact form → Cloudflare Worker /contact → Resend → hello@creativoatwork.com
```

Firebase is a static host for the marketing site. It also now backs one private surface, `/admindash` — see below. There is still **no** Storage and no Cloud Functions, and **no Firebase SDK in the marketing bundle**. Do not introduce Firebase services speculatively.

## /admindash — private project dashboard

A second, isolated application surface added 2026-08-16. Marketing site and dashboard share design tokens and nothing else.

```
index.html      -> src/main.tsx        marketing, prerendered, zero Firebase
admindash.html  -> src/admin/main.tsx  dashboard, never prerendered
```

- **Isolation is a hard requirement, and it is verified.** The marketing dependency closure is `main.css` + shared React + `main.js` — no Firebase. All ~745KB of the SDK lives in the admin-only chunk. The two stylesheets are disjoint, kept apart by `@source` scoping in `src/index.css` and `src/admin/admin.css`; tokens live in `src/theme.css`, imported by both.
- **`firestore.rules` is the access control.** The email list in `src/admin/config.ts` only hides the UI — anyone signed in could call the Firestore REST API directly. The rules pin a UID allowlist and validate every field, enum, length, and timestamp on every write.
- **Enum lists and length limits are duplicated** in `firestore.rules` and `src/admin/data/types.ts`. Change them together or writes get rejected with `permission-denied`.
- **`create` accepts non-future timestamps; `update` pins `updatedAt` to now** and freezes `createdAt`. That asymmetry is deliberate: it lets `scripts/restore-projects.mjs` write historical timestamps under production rules, with no temporary rule relaxation. It also means an existing document cannot be overwritten with a historical `updatedAt` — which is why restore clears the collection before writing.
- **`npm run test:rules`** runs 47 emulator-backed rules tests. Requires a JDK. It is not part of `npm run build`.
- Development points at the Firestore emulator (`import.meta.env.DEV`), never the live database.
- Recovery is the dashboard's "Download JSON" plus `npm run restore:projects`. There is no PITR on the free plan.

## Stack

- Vite 6, React 18, TypeScript 5.6
- Tailwind CSS 4 via `@tailwindcss/vite`, CSS-first configuration — tokens live in `@theme` in **`src/theme.css`**, imported by both `src/index.css` (marketing) and `src/admin/admin.css` (dashboard). Each of those scopes Tailwind's content scanning with `@source` so the two surfaces emit disjoint utilities. There is no `tailwind.config.js` and one should not be added without cause.
- Geist / Geist Mono loaded from Google Fonts in `index.html`
- Cloudflare Worker (`worker/`), wrangler 3, `compatibility_date = 2024-10-22`
- Resend for transactional email

## Layout

- `src/App.tsx` — fixed section order: Header, [Hero, Services, Work, About, Contact], Footer
- `src/components/*.tsx` — one file per section, no shared component library
- `src/theme.css` — design tokens, shared by both surfaces
- `src/index.css` — marketing `base` / `components` / `utilities` layers
- `src/admin/**` — the /admindash application, the only place Firebase is imported
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

## Work grid rotation

`Work.tsx` holds a pool of 16 projects and shows 8 per visit, redrawn on every load.

Three constraints hold it together, and breaking any of them is a regression:

1. **Hydration.** The build prerenders, so randomising during render would make server and client markup disagree. The first render is a fixed `PROJECTS.slice(0, VISIBLE)`; the shuffle runs once in `useEffect` after mount. The section is below the fold, so the swap lands before it is scrolled to.
2. **Tiling.** Span is assigned by *position* — index 0 is `sm:col-span-2`, the rest standard — not stored per project. One wide plus seven standard is nine grid cells, which fills three rows exactly at desktop. A second wide card leaves holes.
3. **Resolution.** `MIN_SHARP = 6` guarantees six high-resolution cards per draw, and the wide slot is filled only from entries flagged `wideOk`. Six pool entries are 400×250 and look soft stretched across two columns.

The first eight entries in the array are what crawlers and no-JavaScript visitors see, since prerendering happens before any shuffle. Keep the strongest work at the top.

**Adding a project takes two steps**: drop the image in `public/img/img_cw/` *and* add an entry to `PROJECTS`. A card needs client, sector, and scope, none of which can be derived from a filename.

## Legal pages

`public/terms.html` (33 sections) and `public/privacy.html` (21 sections) are standalone HTML, served at `/terms` and `/privacy` via Hosting `cleanUrls`. They share the site's CSS variables but do not use Tailwind or React.

They cross-reference each other by section number, and Terms Section 12 incorporates the Privacy Policy by reference. **Renumbering sections in either document breaks references in the other.** Both are indexed, canonicalised, and listed in `sitemap.xml`.

Neither has been reviewed by counsel. See `backlog.md` before relying on either.

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
