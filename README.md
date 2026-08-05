# Creativo@Work

Marketing site for Creativo@Work LLC, a Brooklyn web development studio building corporate sites, eCommerce, and LMS platforms for small-to-midsize companies.

Single-page React site with one dynamic dependency: a contact form backed by a Cloudflare Worker that relays to Resend. There is no database, no authentication, and no user accounts.

Product intent, audience, voice, and design constraints live in [`PRODUCT.md`](./PRODUCT.md). Working context for AI-assisted development lives in [`.ai/`](./.ai/).

## Stack

| Layer | Choice |
| --- | --- |
| Build | Vite 6 |
| UI | React 18 + TypeScript 5.6 |
| Styling | Tailwind CSS 4 (CSS-first `@theme`, no `tailwind.config.js`) |
| Fonts | Geist / Geist Mono via Google Fonts |
| Hosting | Firebase Hosting (project `creativoatwork-54e65`) |
| Contact API | Cloudflare Worker (`creativoatwork-contact`) |
| Email | Resend |

## Prerequisites

- Node.js 20+ (developed on v25)
- `firebase-tools` for hosting deploys
- A Cloudflare account with `wrangler` access for the contact worker

## Local development

```bash
npm install
npm run dev          # http://localhost:5173
```

The contact form needs `VITE_CONTACT_URL` to point at a running worker. Copy the example file and fill in the deployed worker URL:

```bash
cp .env.example .env.local
```

```dotenv
VITE_CONTACT_URL=https://creativoatwork-contact.<account>.workers.dev/contact
```

Without this variable the form fails fast, shows a generic error, and logs a console warning — it does not silently no-op.

To run the worker locally instead:

```bash
cd worker
npm install
npm run dev          # wrangler dev, typically http://localhost:8787
```

Then set `VITE_CONTACT_URL=http://localhost:8787/contact`. The worker's CORS allowlist accepts any `http://localhost:<port>` or `http://127.0.0.1:<port>` origin, so local development works without changing the allowlist.

## Build

```bash
npm run build        # type-check → client build → SSR build → prerender  → dist/
npm run build:client # client build only, no prerender
npm run preview      # serve dist/ locally
```

`npm run build` is three stages:

1. `tsc -b && vite build` — type-check and bundle the client.
2. `vite build --ssr src/entry-server.tsx --outDir dist-ssr` — build a server render of the app.
3. `node scripts/prerender.mjs` — render the app to HTML, inject it into `dist/index.html`, and delete `dist-ssr/`.

**A successful build prints `prerender: injected N bytes of static HTML`.** If that line is missing, the build shipped an empty `<div id="root">` and every crawler that does not run JavaScript — which is most AI crawlers — sees a blank page. `prerender.mjs` throws rather than emit a near-empty page, so a silent failure should not be possible, but check the line before deploying.

Anything rendered at build time must be SSR-safe: no `window` or `document` access during render. Effects are fine, they don't run server-side.

Two further requirements for a production build:

- **`VITE_CONTACT_URL` must be present**, since Vite inlines it into the bundle. Put it in `.env.production`, which is gitignored. Building without it ships a contact form with no endpoint.
- The TypeScript build runs first, so a type error fails the build. This is still the only automated check in the repo — see [Known gaps](#known-gaps).

## Deploy

### Frontend → Firebase Hosting

```bash
npm run build
npx firebase deploy --only hosting
```

`firebase.json` configures the SPA rewrite, clean URLs, immutable caching for fingerprinted assets, `must-revalidate` for HTML/JSON, and baseline security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).

### Contact worker → Cloudflare

```bash
cd worker
npm run typecheck
npx wrangler secret put RESEND_API_KEY   # first deploy only
npm run deploy
npm run tail                             # live logs
```

`RESEND_API_KEY` is a Wrangler secret and must never enter the repository or a `.env` file that ships to the client.

Deploys are currently manual from a local machine. There is no CI pipeline.

## Contact form flow

```
Contact.tsx  --POST JSON-->  Worker /contact  --REST-->  Resend  -->  hello@creativoatwork.com
```

The worker (`worker/src/index.ts`):

- Restricts CORS to the production domains plus localhost.
- Serves only `POST /contact`; everything else is 404 or 405.
- Silently accepts and drops submissions where the `company` honeypot field is filled.
- Validates `name` (1–100 chars), `email` (5–200 chars, regex-checked), and `message` (5–5000 chars).
- Applies a **3 submissions per minute per IP** burst limit, keyed on `CF-Connecting-IP` (which Cloudflare overwrites at the edge, so a client cannot spoof it). Exceeding it returns 429 with `Retry-After`. The check runs *after* validation, so a visitor fixing a typo doesn't spend their budget, and it **fails open** — a limiter outage lets mail through rather than losing a real inquiry.
- HTML-escapes all user input before templating it into the email body.
- Sets `reply_to` to the sender so replying from the inbox reaches the prospect directly.

The client maps the worker's error codes (`invalid_input`, `invalid_email`, `rate_limited`, `send_failed`, `internal_error`, plus a local `network`) to human copy in `ERROR_COPY`. When adding a worker error code, add the matching copy in `src/components/Contact.tsx`.

`RATE_LIMIT_PERIOD_SECONDS` in `index.ts` must stay in sync with `period` on the ratelimit binding in `wrangler.toml`; the binding accepts only 10 or 60.

## Project structure

```
src/
  main.tsx              Client entry — hydrates the prerendered markup
  entry-server.tsx      Build-time entry — rendered by the prerender step
  App.tsx               Section composition order
  index.css             Design tokens (@theme) + base/component/utility layers
  components/           One file per page section
scripts/
  prerender.mjs         Injects rendered HTML into dist/index.html
public/
  img/                  Static imagery (img_cw/ holds work previews)
  terms.html            Terms of Service, served at /terms via cleanUrls
  privacy.html          Privacy Policy, served at /privacy
  robots.txt            Crawl rules, explicitly allowing AI crawlers
  sitemap.xml           Three URLs: /, /privacy, /terms
  llms.txt              Structured studio summary for AI assistants
worker/
  src/index.ts          Contact endpoint
  wrangler.toml         Worker config
```

Sections render in a fixed order — Hero, Services, Work, About, Contact — and carry monospace numbering (`01 / Services` … `04 / Contact`) with anchor ids (`#home`, `#services`, `#work`, `#about`, `#contact`) used by the header nav. Renumber consistently if the order changes.

## Adding a project to the work grid

The grid shows 8 of 16 projects, redrawn at random on every page load. Adding one takes **two** steps:

1. Put the image in `public/img/img_cw/`.
2. Add an entry to `PROJECTS` in `src/components/Work.tsx`.

The image alone isn't enough — each card needs a `client`, `sector`, and `scope`, none of which can be derived from a filename.

```ts
{
  src: '/img/img_cw/example.webp',
  client: 'Example Co',
  sector: 'Industry · Location',
  scope: 'What you built',   // keep under ~23 characters
  wideOk: true,              // only if the source is ~1000px or wider
}
```

`scope` over roughly 23 characters wraps and collides with the client name on narrow cards. `wideOk` marks a source sharp enough for the double-width slot; the draw guarantees at least six high-resolution cards per visit.

The **first eight entries** are what crawlers and no-JavaScript visitors see, since prerendering happens before any shuffle. Keep the strongest work at the top.

### Preparing images

Screenshots come out of the browser at 1–2MB. Convert before committing:

```bash
cwebp -q 80 -resize 1000 0 source.png -o public/img/img_cw/name.webp   # standard card
cwebp -q 80 -resize 1600 0 source.png -o public/img/img_cw/name.webp   # wide card
```

That typically lands between 20KB and 45KB. Note that `sips` on macOS has **no WebP encoder** — use `cwebp`.

## Design system

All tokens are defined once in `src/index.css` under `@theme` and consumed as `var(--color-*)`. Colors are in OKLCH.

- **Paper / ink** — warm off-white backgrounds (`--color-paper`) with blue-leaning near-black text (`--color-ink`, `--color-ink-2`, `--color-ink-3` in descending emphasis).
- **Night** — dark section background (`--color-night`) used by Contact and Footer.
- **Accent** — a single warm accent (`--color-accent`) reserved for interaction. One accent color is a deliberate constraint from `PRODUCT.md`; do not introduce a second.
- **Type helpers** — `.display`, `.display-md`, `.lede`, `.body`, `.eyebrow` carry the typographic scale. Prefer these over ad-hoc font-size utilities.
- **Layout** — `.gutter` owns horizontal page padding at every breakpoint.

## Accessibility

`PRODUCT.md` sets a WCAG 2.2 AA floor. What the code currently enforces:

- A global `:focus-visible` ring in the accent color with offset.
- Every form field has a real `<label>`, not just a placeholder.
- Errors are announced via `role="alert"`; the form sets `aria-busy` while sending.
- The honeypot is `aria-hidden` and removed from the tab order.
- `prefers-reduced-motion: reduce` disables reveal animations, transitions, and smooth scrolling globally.

Verify keyboard navigation — including the mobile menu — after any header or form change.

## Legal pages

`/terms` and `/privacy` are standalone HTML in `public/`, sharing the site's CSS variables but using neither Tailwind nor React. They cross-reference each other by section number, and Terms §12 incorporates the Privacy Policy by reference — **renumbering sections in one breaks references in the other**.

Neither has been reviewed by counsel. Outstanding legal items, including GDPR Article 27 representation and DMCA agent registration, are in [`.ai/backlog.md`](./.ai/backlog.md).

## Known gaps

These are tracked in [`.ai/backlog.md`](./.ai/backlog.md):

- No test framework, no linter, and no CI. Type-checking via `npm run build` is the only gate.
- The contact endpoint has a 3/min per-IP burst limit but no sustained cap, so a bot pacing under it can still drip mail indefinitely. The honeypot remains the only bot-quality control.
- Deploys are manual and untriggered by GitHub.
- Six of the sixteen work images are only 400×250 and look soft on retina. The draw is weighted to limit their exposure rather than fix them.
- Neither legal document has been reviewed by counsel.
