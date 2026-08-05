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
npm run build        # tsc -b && vite build  → dist/
npm run preview      # serve dist/ locally
```

`npm run build` runs the TypeScript project build first, so a type error fails the build. This is currently the only automated check in the repo — see [Known gaps](#known-gaps).

For a production build, `VITE_CONTACT_URL` must be present at build time (Vite inlines it into the bundle). Put it in `.env.production`, which is gitignored.

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
- HTML-escapes all user input before templating it into the email body.
- Sets `reply_to` to the sender so replying from the inbox reaches the prospect directly.

The client maps the worker's error codes (`invalid_input`, `invalid_email`, `send_failed`, `internal_error`, plus a local `network`) to human copy in `ERROR_COPY`. When adding a worker error code, add the matching copy in `src/components/Contact.tsx`.

## Project structure

```
src/
  main.tsx              React root
  App.tsx               Section composition order
  index.css             Design tokens (@theme) + base/component/utility layers
  components/           One file per page section
public/
  img/                  Static imagery (img_cw/ holds work previews)
  terms.html            Standalone page, served at /terms via cleanUrls
worker/
  src/index.ts          Contact endpoint
  wrangler.toml         Worker config
```

Sections render in a fixed order — Hero, Services, Work, About, Contact — and carry monospace numbering (`01 / Services` … `04 / Contact`) with anchor ids (`#home`, `#services`, `#work`, `#about`, `#contact`) used by the header nav. Renumber consistently if the order changes.

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

## Known gaps

These are tracked in [`.ai/backlog.md`](./.ai/backlog.md):

- No test framework, no linter, and no CI. Type-checking via `npm run build` is the only gate.
- The contact endpoint has no rate limiting; the honeypot is the only abuse control.
- Deploys are manual and untriggered by GitHub.
