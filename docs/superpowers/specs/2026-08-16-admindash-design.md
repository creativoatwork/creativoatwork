# `/admindash` — private multi-project aggregator

**Status:** design, awaiting approval
**Date:** 2026-08-16
**Repo:** creativoatwork (Vite + React + TS + Tailwind 4, Firebase Hosting, Cloudflare Worker)

A private dashboard for tracking the studio's projects — hosting, stack, status, notes — added
to this repository as a second, isolated application surface.

---

## 1. Rule overrides this feature requires

`.ai/CLAUDE.md` currently forbids three of the things below. Each is overridden by explicit
instruction, and each override is deliberately narrow. This section exists so the next session
does not read the feature as a violation and "fix" it.

| Existing rule | Override | Boundary |
|---|---|---|
| "This repository is a marketing site, not an application platform." | Lifted for `/admindash` only. | The marketing site remains a marketing site. No admin concern may leak into `src/components/` or `src/App.tsx`. |
| "Do not add Firebase Auth, Firestore, Storage, or Cloud Functions. Firebase is a static host here." | Auth and Firestore are now in use. | Admin entry point only. The marketing bundle must continue to contain zero Firebase code. Storage and Functions remain forbidden. |
| "Do not add a state manager, router, component library, or CSS framework alongside Tailwind." | A router is added. | `react-router-dom`, imported only under `src/admin/`. No state manager, no component library. |

`.ai/CONTEXT.md` states "no Firebase SDK in the client bundle." After this change that remains
true of the *marketing* bundle and false of the *admin* bundle. Both files get updated at
implementation time, and the override is recorded in `.ai/decisions.md`.

---

## 2. Constraints this design had to satisfy

1. **The marketing build prerenders.** `scripts/prerender.mjs` injects `renderToString(<App/>)`
   into `dist/index.html` and throws if the result is under 1000 bytes. Any change that breaks
   the `prerender: injected N bytes` line ships a blank page to crawlers.
2. **Hosting rewrites `**` → `/index.html`.** A naive `/admindash` route would therefore serve
   the prerendered *marketing* HTML and hydrate into the admin app — a mismatch and a visible
   flash of the wrong page.
3. **Bundle weight is a marketing-site concern.** The public bundle is 168KB / 53KB gzipped
   today. Firebase Auth + Firestore is roughly 200KB raw. No marketing visitor should pay it.
4. **CORS makes client-side domain inspection impossible.** A browser `fetch` to a third-party
   domain returns an opaque response with no readable headers.
5. **Client-side authorization is not authorization.** Firestore's REST API is reachable by any
   authenticated user with the public project ID. Security Rules are the only real gate.
6. **Firestore is not yet provisioned.** `firestore:databases:list` returns 403, API disabled.
7. **Spark (free) plan.** Firestore and Auth are both available on it. Nothing here requires
   Blaze.

---

## 3. Architecture

Two independent entry points in one Vite build.

```
index.html       →  src/main.tsx        marketing   prerendered   no Firebase
admindash.html   →  src/admin/main.tsx  admin       never prerendered
```

`vite.config.ts` gains a second Rollup input. The two graphs share Tailwind and nothing else;
Rollup will split common vendor chunks, but no Firebase import is reachable from `src/main.tsx`,
so the marketing entry's chunk set is unchanged.

`scripts/prerender.mjs` is untouched. It only ever reads `dist/index.html`, and the admin entry
produces `dist/admindash.html`, which it never looks at. This is the main reason for choosing
two entries over a shared router.

### Hosting

`firebase.json` already sets `cleanUrls: true`, which means `/admindash` resolves to
`dist/admindash.html` natively — no rewrite needed for the index route. Only the sub-route
needs one, and it must be listed **before** the existing catch-all:

```jsonc
"rewrites": [
  { "source": "/admindash/**", "destination": "/admindash.html" },
  { "source": "**",            "destination": "/index.html" }
]
```

Additional headers for the admin surface:

```jsonc
{ "source": "/admindash{,/**}", "headers": [
  { "key": "X-Robots-Tag",  "value": "noindex, nofollow" },
  { "key": "Cache-Control", "value": "no-store" }
]}
```

`no-store` matters because the existing `must-revalidate` rule for HTML is weaker than it should
be for a page behind auth.

### Routing

`react-router-dom`, mounted only in the admin entry, with `basename="/admindash"`:

```
/admindash        → ProjectsPage    table, search, filters, Add Project
/admindash/:id    → ProjectPage     editable detail
/admindash/*      → redirect to /admindash
```

### File layout

```
admindash.html                    admin entry HTML
src/admin/
  main.tsx                        React root, router, AuthProvider
  firebase.ts                     app init, auth + db singletons
  auth/
    AuthProvider.tsx              onAuthStateChanged → {user, loading, error}
    SignInCard.tsx                signed-out screen; shows UID after sign-in
    RequireAuth.tsx               gate; renders SignInCard or children
  data/
    projects.ts                   Firestore CRUD, typed
    types.ts                      Project, HostingProvider, TechStack, Status
  domain/
    inspect.ts                    client for the Worker /inspect endpoint
  pages/
    ProjectsPage.tsx
    ProjectPage.tsx
  components/
    ProjectTable.tsx
    FilterBar.tsx
    AddProjectModal.tsx
    ProjectForm.tsx
    Field.tsx                     labeled input primitive
    States.tsx                    Loading / Empty / ErrorBanner
firestore.rules
firestore.indexes.json
```

Each file has one job. `projects.ts` is the only module that imports `firebase/firestore`;
pages never touch the SDK directly, which keeps the data layer swappable and testable.

---

## 4. Authentication

Google sign-in via `signInWithPopup`. The signed-out state is a single card with one button —
no marketing chrome, no navigation, nothing that leaks the site's design system into a private
tool.

Two identities are permitted: `creativoatwork@gmail.com` and `simone@creativoatwork.com`.
Whether the second is a real Google identity is unconfirmed; the allowlist shape below holds
one or two entries and absorbs either outcome. If Google sign-in fails for it, an
email/password account is created by hand in the console and its UID added to the same list.

**The UI check is a convenience, not the gate.** `RequireAuth` compares the signed-in email
against the allowlist and renders the sign-in card if it does not match. This stops an
accidental wrong-account session. It stops nothing else, and the code says so in a comment.

**Bootstrap order** (Auth does not depend on Firestore, so there is no cycle):

1. Enable Firestore, deploy rules that deny everything.
2. Sign in at `/admindash`. The sign-in card displays the resulting UID.
3. Paste the UID(s) into `firestore.rules`, deploy.
4. Reload; the table loads.

The UID display is permanent, not scaffolding — it is the only convenient way to read a UID
when rules are locked, and it is visible only to someone already signed in.

---

## 5. Security Rules

These ship and are verified **before** any UI is deployed.

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null
        && request.auth.uid in [
             'UID_PLACEHOLDER_1',
             // 'UID_PLACEHOLDER_2',
           ];
    }

    match /projects/{projectId} {
      allow read: if isAdmin();
      allow create, update: if isAdmin()
        && request.resource.data.keys().hasOnly([
             'name','description','repoUrl','domain','host',
             'frontend','database','status','notes',
             'createdAt','updatedAt'
           ])
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() <= 200;
      allow delete: if isAdmin();
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Three deliberate choices:

- **UID allowlist, not email.** A UID is immutable and cannot be reassigned. `token.email`
  would additionally require an `email_verified` check to be safe.
- **The `hasOnly` field allowlist** stops a compromised or buggy client from writing arbitrary
  documents into `projects` — rules validate shape, not just identity.
- **The global `if false` catch-all** means adding a collection later requires a deliberate rule.
  Default-deny, not default-open.

`firebase.json` gains a `firestore` block pointing at `firestore.rules` and
`firestore.indexes.json`.

### Rule verification (before UI deploy)

Unauthenticated REST read must be refused:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  'https://firestore.googleapis.com/v1/projects/creativoatwork-54e65/databases/(default)/documents/projects'
# expect 403
```

This is a real check against the deployed rules, not a claim. It runs before and after the
UID is filled in, and the result goes in the session log.

---

## 6. Data model

Firestore collection `projects`, one document per project, auto-ID.

| Field | Type | Notes |
|---|---|---|
| `name` | string | required, 1–200 chars |
| `description` | string | freeform, may be empty |
| `repoUrl` | string | GitHub URL, validated shape, may be empty |
| `domain` | string | bare hostname, no scheme; the auto-population input |
| `host` | enum | `firebase` `digitalocean` `lovable` `vercel` `netlify` `cloudflare` `aws` `wordpress-host` `other` `unknown` |
| `frontend` | enum | `react` `next` `vue` `svelte` `astro` `wordpress` `static` `other` `unknown` |
| `database` | enum | `postgres` `mysql` `firestore` `mongo` `sqlite` `wordpress-mysql` `none` `unknown` |
| `status` | enum | `active` `maintenance` `archived` |
| `notes` | string | freeform developer/PM notes |
| `createdAt` | timestamp | `serverTimestamp()` on create |
| `updatedAt` | timestamp | `serverTimestamp()` on every write |

Enums are TypeScript union types with a matching `readonly` label array driving both the filter
controls and the form selects, so adding a value is a one-line change in `types.ts`.

`unknown` is a first-class value, not a null. A project whose stack has not been established is
a normal state, and the table renders it as a muted dash rather than blank.

### Querying

Single query: `orderBy('updatedAt', 'desc')`, no `limit`. Search and filtering are **client-side**.

This is deliberate. The realistic dataset is tens of documents, not thousands. Server-side
filtering across host + stack + status + text would need composite indexes and still could not
do substring search. Client-side filtering over a small array is instant, needs no indexes, and
supports search across every field at once. `firestore.indexes.json` ships effectively empty.

If the collection ever passes ~500 documents this needs revisiting; that threshold goes in
`backlog.md` rather than being pre-built.

---

## 7. Domain auto-population

### Endpoint

`GET /inspect?domain=<hostname>` added to the existing Cloudflare Worker.

Response:

```jsonc
{ "ok": true,
  "domain": "goodai.news",
  "hints": {
    "host":     { "value": "vercel",  "confidence": "high", "evidence": "x-vercel-id header" },
    "frontend": { "value": "next",    "confidence": "high", "evidence": "/_next/ assets" },
    "database": { "value": "unknown", "confidence": "none", "evidence": null }
  } }
```

Every hint carries its evidence, and the modal shows it. A field that says "Vercel — because
`x-vercel-id` was present" is trustworthy in a way that a bare prefilled dropdown is not.

### Signals

| Signal | Infers |
|---|---|
| `x-vercel-id`, `server: Vercel` | Vercel |
| `x-nf-request-id` | Netlify |
| `server: cloudflare` + `cf-ray` | Cloudflare (proxy — low confidence for origin) |
| `x-served-by: firebase`, `x-firebase-*` | Firebase Hosting |
| `server: DigitalOcean App Platform` | DigitalOcean |
| `<meta name="generator" content="WordPress …">`, `/wp-json/` 200 | WordPress + MySQL |
| `/_next/` asset paths, `__NEXT_DATA__` | Next.js |
| `<div id="root">` + Vite asset naming | React SPA |
| `x-powered-by` | varies |

Cloudflare's proxy masks the origin, which is exactly why hints are labeled with confidence
rather than silently filled. This site is itself behind Cloudflare — inspecting
`creativoatwork.com` would report "Cloudflare", not "Firebase", and that is correct behavior for
a header-based probe.

### Abuse controls — the part that matters

An endpoint that fetches arbitrary URLs on request is an open proxy unless constrained. Four
controls, all required:

1. **Firebase ID token required.** The client sends `Authorization: Bearer <idToken>`. The
   Worker verifies the RS256 signature against Google's published certs
   (`https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`,
   cached in memory by `kid`), checks `iss`, `aud` = project ID, `exp`, and that `sub` is in the
   UID allowlist. Rate limiting alone would cap volume without fixing the class of abuse.
2. **SSRF guards.** Reject anything that is not a public hostname: IP literals, `localhost`,
   `*.local`, `*.internal`, RFC1918 ranges, `169.254.0.0/16` (cloud metadata), non-`https`
   schemes, and any port. Re-check after each redirect; cap redirects at 3.
3. **Rate limit.** A second `[[unsafe.bindings]]` ratelimit binding, separate from the contact
   form's so abuse of one cannot starve the other.
4. **Bounded work.** `AbortSignal.timeout(5000)`, response body read to a 64KB cap, `GET` only.

The Worker returns hints only — never the fetched body — so it cannot be used to exfiltrate
content through your Cloudflare account.

### Client behavior

The modal takes a domain, calls `/inspect`, and prefills. **Every field stays editable**, the
probe is skippable, and a failed probe is not an error — it opens the form with everything
`unknown` and a quiet note. The domain is the only required input; a project can be saved with
nothing else filled in.

---

## 8. UI

Dense, keyboard-friendly, and visually distinct from the marketing site — this is a tool, and
making it look like the studio's brand work would be a category error. It reuses the Tailwind
tokens already in `index.css` for color and type, so it is coherent without being a pastiche.

**Table** — one row per project: name + domain, host, frontend, database, status pill, updated.
Row click navigates to the detail view. Column headers sort. Sticky header, `tabular-nums` for
dates, truncation with `title` on overflow.

**Filter bar** — a text input filtering across name, domain, description, and notes; three
selects (host, frontend/database, status); an active-filter count with one-click clear. Filter
state lives in the URL query string, so a filtered view is linkable and survives reload.

**Add Project modal** — domain input → Inspect → prefilled form → Save. Focus trapped, `Esc`
closes, focus returns to the trigger. Labels are real `<label>` elements.

**Detail view** — the same form component, populated. Explicit Save; no autosave. Dirty state
blocks navigation with a confirm. Delete sits behind a typed confirmation, not a bare button.

**States** — skeleton rows on first load, not a spinner. Empty state distinguishes "no projects
yet" from "no matches". Errors render an inline banner with the Firestore error code and a
Retry, never a silent failure. Save buttons disable and show progress while writing.

The accessibility floor from `PRODUCT.md` applies here too: visible focus rings, keyboard
reachability, real labels. Being private is not a reason to drop it.

---

## 9. Error handling

| Failure | Behavior |
|---|---|
| Not signed in | Sign-in card |
| Signed in, wrong account | Sign-in card + "that account does not have access", sign-out button |
| Firestore `permission-denied` | Banner: rules not yet configured for this UID, with the UID shown |
| Firestore unavailable / offline | Banner + Retry; cached data stays on screen |
| Write fails | Form stays populated and dirty; error banner; nothing is lost |
| `/inspect` fails, times out, or 401s | Form opens with `unknown` values and a quiet note |
| Unknown route under `/admindash` | Redirect to `/admindash` |

No `catch {}` that swallows. Every Firestore call surfaces its error code to the UI.

---

## 10. Build and deploy changes

**Changed files:** `vite.config.ts` (second input), `firebase.json` (rewrite, headers, firestore
block), `public/robots.txt` (`Disallow: /admindash`), `package.json` (`firebase`,
`react-router-dom`), `worker/src/index.ts` (`/inspect`), `worker/wrangler.toml` (second rate
limiter).

**New files:** `admindash.html`, everything under `src/admin/`, `firestore.rules`,
`firestore.indexes.json`.

**Untouched:** `src/App.tsx`, `src/components/*`, `src/main.tsx`, `src/entry-server.tsx`,
`scripts/prerender.mjs`, `public/*.html`, `sitemap.xml`.

### Deploy order

Rules before UI, always:

1. Enable the Firestore API; create the database (Native mode, `nam5`).
2. Deploy rules with the allowlist still holding only placeholder strings — no real UID matches,
   so this is a deny-all deployment. Verify the 403 curl.
3. Build and deploy Hosting. Confirm `prerender: injected N bytes` still prints.
4. Sign in, read the UID, fill the allowlist, redeploy rules.
5. Deploy the Worker (`cd worker && npm install && npx wrangler login && npm run deploy`).
6. Verify: 403 curl still fails unauthenticated; `/inspect` without a token returns 401.

### Verification

There is no test framework and this design does not add one — that would be a separate decision.
What gets verified, and how, honestly:

- `npm run build` — type-check, both entries, prerender line present
- `cd worker && npm run typecheck`
- Marketing bundle contains no Firebase — the marketing chunk must match zero times:
  `grep -c firebase dist/assets/index-*.js` (the admin chunk is expected to match; the entry
  loaded by `index.html` must not)
- Unauthenticated Firestore REST read → 403
- `/inspect` with no token → 401; with a token, against a known domain → sensible hints
- Browser: sign in, wrong-account rejection, create, edit, delete, filter, deep-link a filtered
  URL, reload the detail view directly, keyboard-only pass through the modal
- `/admindash` returns `X-Robots-Tag: noindex`
- The marketing site still renders identically — the JS hash should be unchanged

Nothing here is claimed as passing until it has actually been run.

---

## 11. Out of scope

Multiple users or roles; audit logging; project logos or file upload; pagination or virtual
scrolling; offline persistence; bulk import; automated dependency or uptime checks; any link
between `projects` and the public Work grid. The Work grid stays a hand-curated array in
`Work.tsx` — coupling it to Firestore would put the marketing site's content behind a database
and undo the prerender guarantee.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Worker change breaks the live contact form | `/inspect` is an additive branch; contact path untouched. Verify contact still works after deploy. |
| Firebase config mistaken for a secret | Web config is a public identifier. Hard-coded in `src/admin/firebase.ts` with a comment, **not** in a `VITE_` variable — today's `.env.production` incident showed how a missing env var silently breaks a build. |
| Rules deployed permissively "just to test" | Explicitly forbidden. The 403 check gates the UI deploy. |
| Admin bundle bloats the marketing site | Verified by grepping the built marketing chunk for `firebase`. |
| `/admindash` indexed | `X-Robots-Tag: noindex` + `robots.txt`. Neither is security; the rules are. |

## 13. Open items

- Whether `simone@creativoatwork.com` is a Google identity — resolved at bootstrap.
- Both UIDs are placeholders until step 4 of the deploy order.

## 14. Review

This touches authentication, authorization, and a public endpoint that makes outbound requests
— high-assurance under CCOS §14. This spec goes to Codex for adversarial plan review (§15)
before implementation begins, and the implementation gets an independent Codex review (§16)
before it ships.
